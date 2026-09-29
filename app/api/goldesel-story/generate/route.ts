import { NextResponse } from 'next/server'
import {
  createStoryProduction,
  findActiveStoryByArticle,
  setCarouselStatus,
} from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-story/generate
 *
 * Starts a single vertical Story (9:16) from a Goldesel News article. Mirrors
 * the carousel generate flow and REUSES the same production storage + GrokBot
 * webhook channel — it only differs by production_type ('story_goldesel_news')
 * and output shape. It persists the production immediately (so it shows under
 * "Aktuelle Produktion" right away) and does NOT wait for the image; GrokBot
 * reports progress back through the callback endpoint.
 *
 * Producing a Story is fully independent from producing a Carousel for the same
 * article — this never touches carousel productions.
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

  // Reuse the existing Goldesel GrokBot channel (no new secret). The Manager
  // routes by production_type, so a Story and a Carousel can share it.
  const webhookUrl = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL
  const webhookKey = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_KEY
  if (!webhookUrl || !webhookKey) {
    return NextResponse.json(
      {
        status: 'error',
        message:
          'Story-Webhook ist nicht konfiguriert (FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL/KEY fehlt).',
      },
      { status: 500 },
    )
  }

  // Dedupe rapid re-clicks: reuse an already-running Story for this article.
  const existing = await findActiveStoryByArticle(article_id)
  if (existing) {
    return NextResponse.json({
      status: 'ok',
      production_run_id: existing.production_run_id,
      deduped: true,
    })
  }

  const production_run_id = crypto.randomUUID()

  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const callback_url = `${proto}://${host}/api/goldesel-story/callback`

  // Persist first so the production is visible under "Aktuelle Produktion"
  // immediately, even before GrokBot acknowledges the job.
  try {
    await createStoryProduction({
      production_run_id,
      article_id,
      article_url,
      title,
      published_at: published_at ?? null,
      source: source ?? 'goldesel_news',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] story persist error:', message)
    return NextResponse.json(
      {
        status: 'error',
        message: `Produktion konnte nicht gespeichert werden: ${message}`,
      },
      { status: 500 },
    )
  }

  const payload = {
    action: 'generate_goldesel_story',
    // production_id is the canonical id used for all callbacks.
    production_id: production_run_id,
    production_run_id,
    production_type: 'story_goldesel_news',
    article_id,
    article_url,
    headline: title,
    source: source ?? 'goldesel_news',
    output: {
      type: 'story',
      count: 1,
      aspect_ratio: '9:16',
    },
    width: 1080,
    height: 1920,
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
      console.log('[v0] story webhook rejected:', res.status, text.slice(0, 200))
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
    console.log('[v0] story webhook error:', message)
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
