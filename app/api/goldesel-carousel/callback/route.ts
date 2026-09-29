import { NextResponse } from 'next/server'
import {
  applyCarouselCallbackStatus,
  setCarouselCaption,
  upsertCarouselSlides,
} from '@/lib/carousel'

export const dynamic = 'force-dynamic'

interface CallbackSlide {
  slide?: number | string
  slide_index?: number | string
  image_url?: string | null
  prompt?: string | null
  status?: string | null
}

/**
 * POST /api/goldesel-carousel/callback
 *
 * Progressive status sink for GrokBot. Accepts partial updates (a single slide
 * or a status change) and the final full payload. Idempotent: slides upsert by
 * (production_run_id, slide_index), so duplicate callbacks never create
 * duplicate productions or slides.
 *
 * Supported statuses: processing, article_analyzed, prompts_ready,
 * slide_1_complete … slide_5_complete, qa, completed, failed.
 */
export async function POST(request: Request) {
  let body: {
    production_run_id?: string
    production_id?: string
    status?: string | null
    error?: string | null
    instagram_caption?: string | null
    slides?: CallbackSlide[]
    slide?: CallbackSlide
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Ungültiger Request-Body.' },
      { status: 400 },
    )
  }

  // Correlate by the canonical id under either key (spec §15): the outbound
  // payload sends both production_id and production_run_id with the same value.
  const productionRunId = body?.production_run_id ?? body?.production_id
  if (!productionRunId) {
    return NextResponse.json(
      { ok: false, message: 'production_run_id ist erforderlich.' },
      { status: 400 },
    )
  }

  // Accept either a slides[] array or a single slide object.
  const rawSlides: CallbackSlide[] = Array.isArray(body.slides)
    ? body.slides
    : body.slide
      ? [body.slide]
      : []

  const slides = rawSlides
    .map((s) => ({
      slide_index: Number(s.slide ?? s.slide_index),
      image_url: s.image_url ?? null,
      prompt: s.prompt ?? null,
      status: s.status ?? null,
    }))
    .filter((s) => Number.isFinite(s.slide_index) && s.slide_index > 0)

  try {
    if (slides.length > 0) {
      await upsertCarouselSlides(productionRunId, slides)
    }
    // Caption belongs to the whole carousel; setCarouselCaption ignores
    // null/empty so a partial callback can't wipe an existing caption.
    if (body.instagram_caption != null) {
      await setCarouselCaption(productionRunId, body.instagram_caption)
    }
    await applyCarouselCallbackStatus(productionRunId, body.status ?? null, body.error ?? null)
    return NextResponse.json({ ok: true, production_run_id: productionRunId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] carousel callback error:', message)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
