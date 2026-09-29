import { NextResponse } from 'next/server'
import { applyStoryCallbackStatus, upsertCarouselSlides } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-story/callback
 *
 * Progressive status sink for a Goldesel Story production. GrokBot may post
 * intermediate stage updates and a final payload carrying the single vertical
 * image. Idempotent: the story image upserts as slide_index = 1 into the shared
 * carousel_slides table, so duplicate callbacks never create duplicates.
 *
 * Accepts the final image under any of: image_url, final_image_url, result_url,
 * slide.image_url, slides[0].image_url. The canonical id is production_id
 * (production_run_id is accepted as an alias).
 */
export async function POST(request: Request) {
  let body: {
    production_id?: string
    production_run_id?: string
    status?: string | null
    stage?: string | null
    error?: string | null
    qa?: unknown
    image_url?: string | null
    final_image_url?: string | null
    result_url?: string | null
    slide?: { image_url?: string | null; prompt?: string | null; status?: string | null }
    slides?: { image_url?: string | null; prompt?: string | null; status?: string | null }[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Ungültiger Request-Body.' },
      { status: 400 },
    )
  }

  const productionRunId = body?.production_id ?? body?.production_run_id
  if (!productionRunId) {
    return NextResponse.json(
      { ok: false, message: 'production_id ist erforderlich.' },
      { status: 400 },
    )
  }

  // Resolve the single story image from whichever field GrokBot used.
  const imageUrl =
    body.image_url ??
    body.final_image_url ??
    body.result_url ??
    body.slide?.image_url ??
    (Array.isArray(body.slides) ? body.slides[0]?.image_url : null) ??
    null

  // A stage without an explicit status maps to the running row's status verb.
  const status = body.status ?? (body.stage ? String(body.stage) : null)

  try {
    if (imageUrl) {
      await upsertCarouselSlides(productionRunId, [
        { slide_index: 1, image_url: imageUrl, status: 'complete' },
      ])
    }
    await applyStoryCallbackStatus(productionRunId, status, body.error ?? null)
    return NextResponse.json({ ok: true, production_run_id: productionRunId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] story callback error:', message)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
