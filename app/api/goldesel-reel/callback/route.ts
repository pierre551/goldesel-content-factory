import { NextResponse } from 'next/server'
import {
  REEL_CONTENT_TYPE,
  applyReelCallback,
  getReelRow,
  normalizeReelStatus,
  persistFinalReel,
} from '@/lib/reel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-reel/callback
 *
 * Progress + completion sink for the "FACTORY GOLDESEL REEL" routine. Accepts
 * intermediate stage updates and the final completed/failed payload. Correlates
 * strictly by the canonical production_id (spec §14) and production_type =
 * goldesel_reel. Idempotent: re-delivered callbacks converge on the same row.
 *
 * On completion the external Higgsfield MP4 is copied into the Factory's own
 * bucket so playback/download survive the external URL expiring (spec §15).
 */
export async function POST(request: Request) {
  let body: {
    production_run_id?: string
    production_id?: string
    production_type?: string
    status?: string | null
    error?: string | null
    output_video_url?: string | null
    output_url?: string | null
    original_filename?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Ungültiger Request-Body.' },
      { status: 400 },
    )
  }

  const productionRunId = body.production_run_id ?? body.production_id
  if (!productionRunId) {
    return NextResponse.json(
      { ok: false, message: 'production_run_id ist erforderlich.' },
      { status: 400 },
    )
  }

  // Guard against cross-workflow callbacks hitting the wrong sink.
  if (body.production_type && body.production_type !== REEL_CONTENT_TYPE) {
    return NextResponse.json(
      { ok: false, message: 'Falscher production_type für den Reel-Callback.' },
      { status: 400 },
    )
  }

  const row = await getReelRow(productionRunId)
  if (!row) {
    return NextResponse.json(
      { ok: false, message: 'Unbekannte production_run_id.' },
      { status: 404 },
    )
  }

  const status = normalizeReelStatus(body.status)
  const externalUrl = body.output_video_url ?? body.output_url ?? null

  try {
    let outputPath: string | null = null
    if (status === 'completed' && externalUrl) {
      // Persist the final asset durably; keep the external URL as fallback.
      outputPath = await persistFinalReel(
        productionRunId,
        externalUrl,
        body.original_filename ?? row.original_filename,
      )
    }

    await applyReelCallback({
      production_run_id: productionRunId,
      status: body.status ?? null,
      error: body.error ?? null,
      output_video_url: externalUrl,
      output_path: outputPath,
    })
    return NextResponse.json({ ok: true, production_run_id: productionRunId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] reel callback error:', message)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
