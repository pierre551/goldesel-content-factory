import { NextResponse } from 'next/server'
import {
  createReelSignedUrl,
  getReelRow,
  reelOutputFilename,
} from '@/lib/reel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/goldesel-reel/:id/download
 *   ?variant=original → the uploaded source video
 *   (default)         → the final rendered reel
 *
 * Redirects to a short-lived signed Storage URL that carries a
 * Content-Disposition download filename, so the large video is served straight
 * from Storage (never proxied through this route, spec §26). Filename derives
 * from the original upload: market-update.mov → market-update-goldesel-reel.mp4
 * (spec §17).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const { searchParams } = new URL(request.url)
  const variant = searchParams.get('variant') === 'original' ? 'original' : 'output'

  const row = await getReelRow(id)
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (variant === 'original') {
    if (!row.input_path) {
      return NextResponse.json({ ok: false, error: 'no_source' }, { status: 404 })
    }
    const url = await createReelSignedUrl(row.input_path, {
      download: row.original_filename,
      expiresIn: 60 * 10,
    })
    if (!url) {
      return NextResponse.json({ ok: false, error: 'sign_failed' }, { status: 502 })
    }
    return NextResponse.redirect(url)
  }

  // Prefer the durable copy; fall back to the external render URL only if the
  // copy was never persisted.
  const filename = reelOutputFilename(row.original_filename)
  if (row.output_path) {
    const url = await createReelSignedUrl(row.output_path, {
      download: filename,
      expiresIn: 60 * 10,
    })
    if (url) return NextResponse.redirect(url)
  }
  if (row.output_video_url) {
    return NextResponse.redirect(row.output_video_url)
  }
  return NextResponse.json({ ok: false, error: 'not_ready' }, { status: 404 })
}
