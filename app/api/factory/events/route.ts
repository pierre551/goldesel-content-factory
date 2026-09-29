import { NextResponse } from 'next/server'
import {
  IMAGE_EVENTS,
  IN_PRODUCTION,
  deleteCandidates,
  getRun,
  insertCandidates,
  insertGeneration,
  logEvent,
  resolveStoryId,
  setRunStatus,
  setStoryStatus,
  type IncomingCandidate,
} from '@/lib/factory'

export const dynamic = 'force-dynamic'

/**
 * Callback endpoint the Goldesel Manager POSTs into. Handles two kinds of
 * callbacks:
 *
 * 1. Research results  — body carries a `candidates` array.
 * 2. Production status  — body carries an `event_type` (content_started,
 *    image_v1_created, production_completed, production_error, …).
 */
export async function POST(request: Request) {
  // Optional shared-secret check: accept either configured webhook key.
  const auth = request.headers.get('authorization')
  const researchKey = process.env.CURSOR_FACTORY_WEBHOOK_KEY
  const selectionKey = process.env.CURSOR_FACTORY_SUBMIT_SELECTION_KEY
  if (auth) {
    const ok =
      (researchKey && auth === `Bearer ${researchKey}`) ||
      (selectionKey && auth === `Bearer ${selectionKey}`)
    if (!ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  // Route by payload shape.
  if (Array.isArray(body.candidates)) {
    return handleResearchResults(body)
  }
  if (typeof body.event_type === 'string') {
    return handleProductionEvent(body)
  }
  return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
}

/* ------------------------------ Research ------------------------------ */

async function handleResearchResults(body: any) {
  const runId = body?.research_run_id
  const status = typeof body?.status === 'string' ? body.status : 'awaiting_selection'
  const candidates = Array.isArray(body?.candidates) ? body.candidates : null

  if (typeof runId !== 'string' || !candidates) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  try {
    const run = await getRun(runId)
    if (!run) {
      return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
    }

    await deleteCandidates(runId)

    const clean: IncomingCandidate[] = candidates
      .filter((c: any) => c && typeof c.company === 'string' && typeof c.ticker === 'string')
      .map((c: any) => ({
        company: String(c.company),
        ticker: String(c.ticker),
        headline: String(c.headline ?? ''),
        summary: typeof c.summary === 'string' ? c.summary : undefined,
        source_urls: Array.isArray(c.source_urls)
          ? c.source_urls.filter((u: unknown) => typeof u === 'string')
          : undefined,
        relevance_score:
          typeof c.relevance_score === 'number' ? c.relevance_score : undefined,
        viral_score: typeof c.viral_score === 'number' ? c.viral_score : undefined,
      }))

    if (clean.length) {
      await insertCandidates(runId, clean)
    }

    await setRunStatus(runId, status)
    await logEvent('research.completed', runId, { count: clean.length, status })

    return NextResponse.json({ ok: true, inserted: clean.length, status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] research callback error:', message)
    await logEvent('research.error', runId, { reason: 'callback_failed', message })
    try {
      await setRunStatus(runId, 'error')
    } catch {
      // ignore secondary failure
    }
    return NextResponse.json({ error: 'processing_failed', message }, { status: 500 })
  }
}

/* ----------------------------- Production ----------------------------- */

async function handleProductionEvent(body: any) {
  const eventType = String(body.event_type)
  const runId = typeof body.research_run_id === 'string' ? body.research_run_id : null
  const storyId = typeof body.story_id === 'string' ? body.story_id : null
  const candidateId = typeof body.candidate_id === 'string' ? body.candidate_id : null

  try {
    // 1) Persist every callback verbatim.
    await logEvent(eventType, runId, body)

    // 2) Resolve the target story (by id, or via run + candidate).
    const resolvedStoryId = await resolveStoryId({ storyId, runId, candidateId })

    // 3) Reflect the status on the story (stored verbatim, no fabrication).
    if (resolvedStoryId || (runId && candidateId)) {
      await setStoryStatus({
        storyId: resolvedStoryId,
        runId,
        candidateId,
        status: eventType,
      }).catch((e) => console.log('[v0] setStoryStatus warn:', e?.message))
    }

    // 4) Store an image generation when the callback carries one.
    const p = body.payload && typeof body.payload === 'object' ? body.payload : {}
    const imageUrl =
      typeof body.image_url === 'string'
        ? body.image_url
        : typeof p.image_url === 'string'
          ? p.image_url
          : null

    if (imageUrl && resolvedStoryId && (IMAGE_EVENTS.has(eventType) || body.image_url || p.image_url)) {
      const version = body.version ?? p.version
      const genStatus = typeof body.image_status === 'string' ? body.image_status : eventType
      const qaScore =
        typeof body.qa_score === 'number'
          ? body.qa_score
          : typeof p.qa_score === 'number'
            ? p.qa_score
            : undefined
      await insertGeneration({
        story_id: resolvedStoryId,
        version: version !== undefined ? version : undefined,
        image_url: imageUrl,
        status: genStatus,
        qa_score: qaScore,
      })
    }

    // 5) Keep the run marked as in production while events flow in.
    if (runId) {
      await setRunStatus(runId, IN_PRODUCTION).catch(() => {})
    }

    return NextResponse.json({ ok: true, event: eventType })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] production callback error:', message)
    return NextResponse.json({ error: 'processing_failed', message }, { status: 500 })
  }
}
