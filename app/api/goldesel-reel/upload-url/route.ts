import { NextResponse } from 'next/server'
import { createReelUploadUrl, ensureReelBucket, reelInputPath } from '@/lib/reel'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['video/mp4', 'video/quicktime'])
const ALLOWED_EXT = /\.(mp4|mov)$/i

/**
 * POST /api/goldesel-reel/upload-url
 *
 * Mints the canonical production_id and a one-shot signed upload URL so the
 * browser can push the source video straight to Storage (no serverless body
 * limit, spec §26). Production is NOT created here — only after the upload is
 * confirmed, via /generate.
 */
export async function POST(request: Request) {
  let body: { filename?: string; content_type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Ungültiger Request-Body.' },
      { status: 400 },
    )
  }

  const filename = (body.filename ?? '').trim()
  const contentType = (body.content_type ?? '').trim().toLowerCase()
  if (!filename) {
    return NextResponse.json(
      { status: 'error', message: 'filename ist erforderlich.' },
      { status: 400 },
    )
  }
  const typeOk = contentType ? ALLOWED.has(contentType) : true
  if (!ALLOWED_EXT.test(filename) || !typeOk) {
    return NextResponse.json(
      { status: 'error', message: 'Nur MP4- und MOV-Videos werden unterstützt.' },
      { status: 415 },
    )
  }

  try {
    await ensureReelBucket()
    const production_run_id = crypto.randomUUID()
    const path = reelInputPath(production_run_id, filename)
    const upload = await createReelUploadUrl(path)
    return NextResponse.json({
      status: 'ok',
      production_run_id,
      bucket: 'factory-media',
      path: upload.path,
      token: upload.token,
      signed_url: upload.signedUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] reel upload-url error:', message)
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
