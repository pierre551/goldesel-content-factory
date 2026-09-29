import { NextResponse } from 'next/server'
import {
  REEL_CONTENT_TYPE,
  createReelProduction,
  createReelSignedUrl,
  getReelRow,
  reelObjectExists,
  setReelStatus,
} from '@/lib/reel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-reel/generate
 *
 * Called after the source video was uploaded directly to Storage (via
 * /upload-url). It:
 *   1. verifies the persisted input exists,
 *   2. creates the canonical production record BEFORE any webhook (spec §7),
 *   3. hands the job to the "FACTORY GOLDESEL REEL" Grok routine server-side.
 *
 * The same production_id flows Factory → Grok → Designer → Higgsfield →
 * Callback → Factory unchanged. Progress is reported back via /callback.
 */
export async function POST(request: Request) {
  let body: {
    production_run_id?: string
    path?: string
    original_filename?: string
    title?: string | null
    file_size?: number | null
    duration?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Ungültiger Request-Body.' },
      { status: 400 },
    )
  }

  const { production_run_id, path, original_filename } = body
  if (!production_run_id || !path || !original_filename) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'production_run_id, path und original_filename sind erforderlich.',
      },
      { status: 400 },
    )
  }

  // Duplicate protection (spec §20): if this production already exists and is
  // still running/terminal, never start it again — the id is idempotent.
  const existing = await getReelRow(production_run_id)
  if (existing) {
    return NextResponse.json({
      status: 'ok',
      production_run_id,
      deduped: true,
    })
  }

  // The webhook must be configured before we create anything downstream
  // (spec §10). Never invent or echo the key — only report which is missing.
  const webhookUrl = process.env.FACTORY_GOLDESEL_REEL_WEBHOOK_URL
  const webhookKey = process.env.FACTORY_GOLDESEL_REEL_WEBHOOK_KEY
  if (!webhookUrl || !webhookKey) {
    return NextResponse.json(
      {
        status: 'error',
        message:
          'Reel-Webhook ist nicht konfiguriert (FACTORY_GOLDESEL_REEL_WEBHOOK_URL/KEY fehlt).',
      },
      { status: 500 },
    )
  }

  // Confirm the uploaded source actually landed in Storage before proceeding.
  const exists = await reelObjectExists(path)
  if (!exists) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Das hochgeladene Video wurde im Speicher nicht gefunden.',
      },
      { status: 400 },
    )
  }

  // Long-lived signed URL so Grok/Higgsfield can fetch the source during the
  // whole render. Stored on the row for reference; not a secret.
  const inputVideoUrl = await createReelSignedUrl(path, {
    expiresIn: 60 * 60 * 24 * 7,
  })
  if (!inputVideoUrl) {
    return NextResponse.json(
      { status: 'error', message: 'Signierte Video-URL konnte nicht erstellt werden.' },
      { status: 500 },
    )
  }

  // Persist first so the production shows up under "Aktuelle Produktion"
  // immediately, even before Grok acknowledges (spec §9). Status = video_ready.
  try {
    await createReelProduction({
      production_run_id,
      original_filename,
      title: body.title ?? null,
      input_path: path,
      input_video_url: inputVideoUrl,
      file_size: typeof body.file_size === 'number' ? body.file_size : null,
      duration: typeof body.duration === 'number' ? body.duration : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] reel persist error:', message)
    return NextResponse.json(
      {
        status: 'error',
        message: `Produktion konnte nicht gespeichert werden: ${message}`,
      },
      { status: 500 },
    )
  }

  // Absolute callback URL back into this Factory deployment.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const callback_url = `${proto}://${host}/api/goldesel-reel/callback`

  // Payload per spec §11. Canonical id under both production_id and
  // production_run_id so the callback correlates regardless of which the locked
  // Grok routine echoes back.
  const payload = {
    action: 'generate_goldesel_reel',
    production_id: production_run_id,
    production_run_id,
    production_type: REEL_CONTENT_TYPE,
    input_video_url: inputVideoUrl,
    original_filename,
    output: {
      type: 'reel',
      aspect_ratio: '9:16',
      format: 'mp4',
      preset: 'Monochrom Vibes',
    },
    callback_url,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webhookKey}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      await setReelStatus(production_run_id, 'failed', `Grok HTTP ${res.status}`).catch(() => {})
      console.log('[v0] reel webhook rejected:', res.status, text.slice(0, 200))
      return NextResponse.json(
        {
          status: 'error',
          message: `Grok hat die Anfrage abgelehnt (HTTP ${res.status}).`,
          production_run_id,
        },
        { status: 502 },
      )
    }
    // Grok accepted the job → move from video_ready into processing.
    await setReelStatus(production_run_id, 'designer_processing').catch(() => {})
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Netzwerkfehler'
    await setReelStatus(production_run_id, 'failed', message).catch(() => {})
    console.log('[v0] reel webhook error:', message)
    return NextResponse.json(
      {
        status: 'error',
        message: `Verbindung zu Grok fehlgeschlagen: ${message}`,
        production_run_id,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ status: 'ok', production_run_id })
}
