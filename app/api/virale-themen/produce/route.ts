import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CAROUSEL_CONTENT_TYPE, findActiveCarouselByArticle, setCarouselStatus } from '@/lib/carousel'
import { getLatestViralRound, viralArticleId } from '@/lib/viral-topics'

export const dynamic = 'force-dynamic'

const BEITRAG_SLIDES = 4

export async function POST(request: Request) {
  let body: { topic_id?: string; type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: 'Ungültiger Request-Body.' }, { status: 400 })
  }
  const { topic_id, type } = body
  if (!topic_id || (type !== 'beitrag' && type !== 'reel')) {
    return NextResponse.json(
      { status: 'error', message: 'topic_id und type (beitrag|reel) sind erforderlich.' },
      { status: 400 },
    )
  }

  if (type === 'reel') {
    // The existing reel pipeline only accepts an uploaded source video; there is
    // no topic-based reel routine yet, so we report that honestly.
    return NextResponse.json(
      {
        status: 'error',
        message:
          'Reel-Produktion aus Themen ist noch nicht angebunden. Erforderlich: FACTORY_GOLDESEL_REEL_WEBHOOK_URL/KEY und eine Grok-Routine für Reels ohne Quellvideo (1080×1920, Hook-, Content- und Logo-Overlay).',
      },
      { status: 501 },
    )
  }

  const current = await getLatestViralRound()
  if (!current.ok) {
    return NextResponse.json({ status: 'error', message: current.setupHint }, { status: 503 })
  }
  const topic = current.round?.topics.find((t) => t.id === topic_id)
  if (!topic) {
    return NextResponse.json(
      { status: 'error', message: 'Thema nicht gefunden – bitte Seite neu laden.' },
      { status: 404 },
    )
  }

  const webhookUrl = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL
  const webhookKey = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_KEY
  if (!webhookUrl || !webhookKey) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Carousel-Webhook ist nicht konfiguriert (FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL/KEY fehlt).',
      },
      { status: 503 },
    )
  }

  const article_id = viralArticleId(topic.id)
  const existing = await findActiveCarouselByArticle(article_id)
  if (existing) {
    return NextResponse.json({ status: 'ok', production_run_id: existing.production_run_id, deduped: true })
  }

  const production_run_id = crypto.randomUUID()
  const article_url = topic.sources[0]?.url ?? ''
  const ts = new Date().toISOString()

  try {
    const db = createAdminClient()
    const { error: prodErr } = await db.from('carousel_productions').insert({
      production_run_id,
      article_id,
      article_url,
      title: topic.headline,
      published_at: null,
      source: 'virale_themen',
      content_type: CAROUSEL_CONTENT_TYPE,
      slide_count: BEITRAG_SLIDES,
      status: 'queued',
      error: null,
      updated_at: ts,
    })
    if (prodErr) throw new Error(prodErr.message)
    const { error: slideErr } = await db.from('carousel_slides').insert(
      Array.from({ length: BEITRAG_SLIDES }, (_, i) => ({
        production_run_id,
        slide_index: i + 1,
        status: 'pending',
        updated_at: ts,
      })),
    )
    if (slideErr) throw new Error(slideErr.message)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json(
      { status: 'error', message: `Produktion konnte nicht gespeichert werden: ${message}` },
      { status: 500 },
    )
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webhookKey}` },
      body: JSON.stringify({
        action: 'generate_goldesel_carousel',
        production_id: production_run_id,
        production_run_id,
        production_type: CAROUSEL_CONTENT_TYPE,
        article_id,
        article_url,
        headline: topic.headline,
        title: topic.headline,
        summary: topic.summary,
        category: topic.category,
        sources: topic.sources,
        published_at: null,
        source: 'virale_themen',
        output: {
          type: 'carousel',
          slides: BEITRAG_SLIDES,
          width: 1080,
          height: 1350,
          aspect_ratio: '4:5',
          renderer: 'higgsfield',
          model: 'nano_banana_pro',
        },
        callback_url: `${proto}://${host}/api/goldesel-carousel/callback`,
      }),
    })
    if (!res.ok) {
      await setCarouselStatus(production_run_id, 'failed', `GrokBot HTTP ${res.status}`).catch(() => {})
      return NextResponse.json(
        { status: 'error', message: `GrokBot hat die Anfrage abgelehnt (HTTP ${res.status}).` },
        { status: 502 },
      )
    }
    await setCarouselStatus(production_run_id, 'processing').catch(() => {})
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Netzwerkfehler'
    await setCarouselStatus(production_run_id, 'failed', message).catch(() => {})
    return NextResponse.json(
      { status: 'error', message: `Verbindung zu GrokBot fehlgeschlagen: ${message}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ status: 'ok', production_run_id })
}
