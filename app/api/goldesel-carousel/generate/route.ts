import { NextResponse } from 'next/server'
import {
  CAROUSEL_CONTENT_TYPE,
  createCarouselProduction,
  findActiveCarouselByArticle,
  setCarouselStatus,
} from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-carousel/generate
 *
 * Receives an article selected in the Goldesel News UI, persists a production
 * record, then hands the job to the existing GrokBot "FACTORY GOLDESEL
 * CAROUSEL" routine via a server-only webhook. It does NOT wait for the five
 * images — GrokBot reports progress back through the callback endpoint.
 */
export async function POST(request: Request) {
  let body: {
    article_id?: string
    article_url?: string
    title?: string
    published_at?: string | null
    source?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Ungültiger Request-Body.' },
      { status: 400 },
    )
  }

  const { article_id, article_url, title, published_at, source } = body ?? {}
  if (!article_id || !article_url || !title) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'article_id, article_url und title sind erforderlich.',
      },
      { status: 400 },
    )
  }

  const webhookUrl = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL
  const webhookKey = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_KEY
  if (!webhookUrl || !webhookKey) {
    // Never echo the key; only report which piece is missing.
    return NextResponse.json(
      {
        status: 'error',
        message:
          'Carousel-Webhook ist nicht konfiguriert (FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL/KEY fehlt).',
      },
      { status: 500 },
    )
  }

  // Dedupe rapid re-clicks: reuse an already-running production for this article.
  const existing = await findActiveCarouselByArticle(article_id)
  if (existing) {
    return NextResponse.json({
      status: 'ok',
      production_run_id: existing.production_run_id,
      deduped: true,
    })
  }

  const production_run_id = crypto.randomUUID()

  // Absolute callback URL back into this Content Factory deployment.
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const callback_url = `${proto}://${host}/api/goldesel-carousel/callback`

  // Persist first so the production shows up under "Aktuelle Produktion"
  // immediately, even before GrokBot acknowledges.
  try {
    await createCarouselProduction({
      production_run_id,
      article_id,
      article_url,
      title,
      published_at: published_at ?? null,
      source: source ?? 'goldesel_news',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] carousel persist error:', message)
    return NextResponse.json(
      {
        status: 'error',
        message: `Produktion konnte nicht gespeichert werden: ${message}`,
      },
      { status: 500 },
    )
  }

  // Payload shape per spec §11. We send the canonical id under both
  // `production_id` and `production_run_id`, and the headline under both
  // `headline` and `title`, so the callback correlates no matter which key the
  // locked Grok workflow echoes back. callback_url tells GrokBot where to
  // report progress; it is not a secret.
  const payload = {
    action: 'generate_goldesel_carousel',
    production_id: production_run_id,
    production_run_id,
    production_type: CAROUSEL_CONTENT_TYPE,
    article_id,
    article_url,
    headline: title,
    title,
    published_at: published_at ?? null,
    source: source ?? 'goldesel_news',
    output: {
      type: 'carousel',
      slides: 5,
      width: 1080,
      height: 1350,
      aspect_ratio: '4:5',
      renderer: 'higgsfield',
      model: 'nano_banana_pro',
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
      await setCarouselStatus(production_run_id, 'failed', `GrokBot HTTP ${res.status}`).catch(
        () => {},
      )
      console.log('[v0] carousel webhook rejected:', res.status, text.slice(0, 200))
      return NextResponse.json(
        {
          status: 'error',
          message: `GrokBot hat die Anfrage abgelehnt (HTTP ${res.status}).`,
          production_run_id,
        },
        { status: 502 },
      )
    }
    // GrokBot accepted the job: queued → processing.
    await setCarouselStatus(production_run_id, 'processing').catch(() => {})
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Netzwerkfehler'
    await setCarouselStatus(production_run_id, 'failed', message).catch(() => {})
    console.log('[v0] carousel webhook error:', message)
    return NextResponse.json(
      {
        status: 'error',
        message: `Verbindung zu GrokBot fehlgeschlagen: ${message}`,
        production_run_id,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ status: 'ok', production_run_id })
}
