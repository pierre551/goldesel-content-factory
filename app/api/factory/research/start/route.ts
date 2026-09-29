import { NextResponse } from 'next/server'
import {
  AKTIEN_CATEGORY,
  createResearchRun,
  logEvent,
  setRunStatus,
} from '@/lib/factory'

export const dynamic = 'force-dynamic'

const CALLBACK_URL = 'https://goldesel-content-factory.vercel.app/api/factory/events'

/** Map an upstream HTTP status to a stable internal error code. */
function classifyWebhookStatus(status: number): string {
  switch (status) {
    case 400:
      return 'webhook_bad_request'
    case 401:
      return 'webhook_unauthorized'
    case 403:
      return 'webhook_forbidden'
    case 404:
      return 'webhook_not_found'
    case 408:
      return 'webhook_timeout'
    case 429:
      return 'webhook_rate_limited'
    default:
      if (status >= 500) return 'webhook_server_error'
      return 'webhook_error'
  }
}

/**
 * Produce a short, safe snippet of the upstream response body. Collapses
 * whitespace and truncates so nothing large or noisy reaches the client. The
 * upstream body never contains our webhook URL/key/token, but we still cap it
 * defensively.
 */
function sanitizeSnippet(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return '(leere Antwort)'
  return cleaned.length > 160 ? `${cleaned.slice(0, 160)}…` : cleaned
}

export async function POST(request: Request) {
  let category = AKTIEN_CATEGORY
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.category === 'string' && body.category) category = body.category
  } catch {
    // ignore — default category
  }

  // 1) Create the research run first so we always have an id to track.
  let runId: string
  try {
    const run = await createResearchRun(category)
    runId = run.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] createResearchRun error:', message)
    return NextResponse.json(
      { error: 'db_error', message: 'Research-Run konnte nicht angelegt werden.' },
      { status: 500 },
    )
  }

  // 2) Fire the server-side webhook to the Goldesel Manager.
  const webhookUrl = process.env.CURSOR_FACTORY_WEBHOOK_URL
  const webhookKey = process.env.CURSOR_FACTORY_WEBHOOK_KEY

  if (!webhookUrl || !webhookKey) {
    // Preview environment: webhook secrets are production-only.
    await setRunStatus(runId, 'error')
    await logEvent('research.error', runId, { reason: 'webhook_not_configured' })
    return NextResponse.json(
      {
        research_run_id: runId,
        status: 'error',
        message:
          'Webhook ist nur in der Produktionsumgebung konfiguriert. In der Vorschau kann keine Recherche gestartet werden.',
      },
      { status: 200 },
    )
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${webhookKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'start_research',
        research_run_id: runId,
        category,
        callback_url: CALLBACK_URL,
      }),
    })

    if (!res.ok) {
      const rawBody = await res.text().catch(() => '')
      const upstreamStatus = res.status
      const code = classifyWebhookStatus(upstreamStatus)
      const snippet = sanitizeSnippet(rawBody)
      console.log('[v0] webhook POST error:', code, upstreamStatus, snippet)
      await setRunStatus(runId, 'error')
      await logEvent('research.error', runId, {
        reason: 'webhook_failed',
        code,
        upstreamStatus,
        snippet,
      })
      return NextResponse.json(
        {
          research_run_id: runId,
          status: 'error',
          message: 'Die Recherche konnte nicht gestartet werden (Webhook-Fehler).',
          // Non-secret diagnostic only: upstream status, internal code, and a
          // short sanitized snippet of the upstream response body. Never the
          // webhook URL, key, bearer token, or any env value.
          upstreamStatus,
          code,
          snippet,
        },
        { status: 200 },
      )
    }
  } catch (err) {
    // Network-level failure: no upstream HTTP status is available.
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] webhook POST network error:', message)
    await setRunStatus(runId, 'error')
    await logEvent('research.error', runId, {
      reason: 'webhook_failed',
      code: 'webhook_unreachable',
    })
    return NextResponse.json(
      {
        research_run_id: runId,
        status: 'error',
        message: 'Die Recherche konnte nicht gestartet werden (Webhook-Fehler).',
        upstreamStatus: null,
        code: 'webhook_unreachable',
        snippet: 'Keine Antwort vom Webhook (Netzwerkfehler oder Timeout).',
      },
      { status: 200 },
    )
  }

  await logEvent('research.started', runId, { category })
  return NextResponse.json({ research_run_id: runId, status: 'researching' })
}
