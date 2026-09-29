import { NextResponse } from 'next/server'
import {
  IN_PRODUCTION,
  createStoriesForSelection,
  getRun,
  getSelectedPoolCandidates,
  logEvent,
  markCandidatesSelected,
  setRunStatus,
  setStoryStatus,
  MAX_SELECTION,
} from '@/lib/factory'

export const dynamic = 'force-dynamic'

const CALLBACK_URL = 'https://goldesel-content-factory.vercel.app/api/factory/events'

/**
 * "Auswahl produzieren" handler.
 *
 * Reads the selected candidates from Supabase, requires 1–2 of them, POSTs the
 * submit_selection webhook to the Goldesel Manager (server-side only), then
 * persists the production hand-off: selected=true, story rows, run status and a
 * selection.submitted event. The actual production pipeline runs in the manager.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const runId = body?.research_run_id
  if (typeof runId !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  let selectedIds: string[]
  try {
    const run = await getRun(runId)
    if (!run) {
      return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
    }

    // Only pool candidates (not already produced) are eligible, so a second
    // production run never re-submits stories that are already in production.
    const selected = await getSelectedPoolCandidates(runId)
    selectedIds = selected.map((c) => c.id)

    if (selectedIds.length < 1) {
      return NextResponse.json({ error: 'no_selection' }, { status: 409 })
    }
    if (selectedIds.length > MAX_SELECTION) {
      return NextResponse.json({ error: 'too_many' }, { status: 409 })
    }

    // Server-side webhook secrets (production only).
    const url = process.env.CURSOR_FACTORY_SUBMIT_SELECTION_URL
    const key = process.env.CURSOR_FACTORY_SUBMIT_SELECTION_KEY
    if (!url || !key) {
      await logEvent('selection.error', runId, { reason: 'webhook_not_configured' })
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Der Produktions-Webhook ist nur in der Produktionsumgebung konfiguriert. In der Vorschau kann keine Produktion gestartet werden.',
        },
        { status: 200 },
      )
    }

    // ------------------------------------------------------------------
    // Persist the production hand-off FIRST, before contacting GrokBot.
    // A story row per selected candidate is the local twin of the GrokBot
    // job, so "Aktuelle Produktion" reflects the job immediately and never
    // depends on webhook timing. (Mirrors the carousel generate route.)
    // ------------------------------------------------------------------
    await markCandidatesSelected(runId, selectedIds)
    const stories = await createStoriesForSelection(runId, selected)

    // Every selected candidate MUST end up with a persisted story. If not, the
    // stories table could not accept the insert — surface it instead of
    // silently starting an untracked GrokBot job that would never appear.
    const persistedCandidateIds = new Set(
      stories.map((s) => s.news_candidate_id).filter(Boolean) as string[],
    )
    const missing = selectedIds.filter((id) => !persistedCandidateIds.has(id))
    if (missing.length > 0) {
      await logEvent('selection.error', runId, {
        reason: 'story_persist_failed',
        missing_candidate_ids: missing,
      })
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Die Produktion konnte nicht gespeichert werden (stories-Tabelle hat den Eintrag abgelehnt). Es wurde kein GrokBot-Job gestartet.',
        },
        { status: 200 },
      )
    }

    await setRunStatus(runId, IN_PRODUCTION)
    await logEvent('selection.submitted', runId, {
      selected_candidate_ids: selectedIds,
      story_count: stories.length,
    })

    // ------------------------------------------------------------------
    // Now hand the job to GrokBot. The production is already persisted, so a
    // webhook failure marks the stories as errored (still visible under
    // "Aktuelle Produktion") rather than discarding the production silently.
    // ------------------------------------------------------------------
    const markStoriesErrored = () =>
      Promise.all(
        stories.map((s) =>
          setStoryStatus({ storyId: s.id, status: 'production_error' }).catch(() => {}),
        ),
      )

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submit_selection',
          research_run_id: runId,
          selected_candidate_ids: selectedIds,
          callback_url: CALLBACK_URL,
        }),
      })
    } catch (netErr) {
      const message = netErr instanceof Error ? netErr.message : 'Netzwerkfehler'
      await markStoriesErrored()
      await logEvent('selection.webhook_failed', runId, { reason: 'network', message })
      return NextResponse.json(
        {
          status: 'error',
          message: `Verbindung zu GrokBot fehlgeschlagen: ${message}. Die Produktion ist gespeichert und als fehlgeschlagen markiert.`,
          story_count: stories.length,
        },
        { status: 200 },
      )
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      await markStoriesErrored()
      await logEvent('selection.webhook_failed', runId, {
        upstream_status: res.status,
        snippet: text.slice(0, 200),
      })
      return NextResponse.json(
        {
          status: 'error',
          message: `GrokBot hat die Anfrage abgelehnt (HTTP ${res.status}). Die Produktion ist gespeichert und als fehlgeschlagen markiert.`,
          story_count: stories.length,
        },
        { status: 200 },
      )
    }

    return NextResponse.json({ ok: true, status: IN_PRODUCTION, story_count: stories.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] submit selection error:', message)
    await logEvent('selection.error', runId, { reason: 'submit_failed', message })
    return NextResponse.json(
      {
        status: 'error',
        message: 'Die Produktion konnte nicht gestartet werden (Webhook-Fehler).',
      },
      { status: 200 },
    )
  }
}
