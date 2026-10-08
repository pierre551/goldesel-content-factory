import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CAROUSEL_CONTENT_TYPE, findActiveCarouselByArticle, setCarouselStatus } from '@/lib/carousel'
import { fetchGoldeselAktienduelle } from '@/lib/goldesel-aktienduelle'
import { fetchGoldeselTopstories } from '@/lib/goldesel-topstories'
import { getPooledArticles } from '@/lib/goldesel-articles'
import { fetchGoldeselNews } from '@/lib/goldesel-news'
import {
  BEITRAG_SLIDES,
  FORMAT_LABEL,
  OUTPUT_SPECS,
  masterFor,
  reelSetupMessage,
  type ContentFormat,
} from '@/lib/production-masters'
import { contentArticleId } from '@/lib/content-ids'

export const dynamic = 'force-dynamic'

type FeedFormat = Extract<ContentFormat, 'aktienduell' | 'topstory' | 'artikel'>
const FEED_FORMATS: FeedFormat[] = ['aktienduell', 'topstory', 'artikel']

interface ContentItem {
  id: string
  url: string
  title: string
  image: string | null
  teaser: string | null
  publishedAt: string | null
}

/** Re-reads the item server-side so only real, whitelisted feed content reaches production. */
async function resolveItem(format: FeedFormat, id: string): Promise<ContentItem | null> {
  if (format === 'aktienduell') {
    const r = await fetchGoldeselAktienduelle()
    return r.ok ? (r.duels.find((d) => d.id === id) ?? null) : null
  }
  if (format === 'topstory') {
    const r = await fetchGoldeselTopstories()
    return r.ok ? (r.topstories.find((t) => t.id === id) ?? null) : null
  }
  const pooled = await getPooledArticles(50)
  const hit = pooled.articles.find((a) => a.id === id) ?? (await fetchGoldeselNews()).find((a) => a.id === id)
  return hit
    ? { id: hit.id, url: hit.url, title: hit.title, image: hit.image, teaser: hit.teaser, publishedAt: hit.publishedAt }
    : null
}

const fail = (message: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ status: 'error', message, ...extra }, { status })

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { format?: string; item_id?: string; type?: string }
    | null
  const format = body?.format as FeedFormat
  const itemId = typeof body?.item_id === 'string' ? body.item_id : ''
  const type = body?.type
  if (!FEED_FORMATS.includes(format) || !itemId || (type !== 'beitrag' && type !== 'reel')) {
    return fail('format, item_id und type (beitrag|reel) sind erforderlich.', 400)
  }

  if (type === 'reel') {
    return fail(reelSetupMessage(), 503, { setup_required: true })
  }

  const webhookUrl = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL
  const webhookKey = process.env.FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_KEY
  if (!webhookUrl || !webhookKey) {
    return fail('Einrichtung erforderlich: FACTORY_GOLDESEL_CAROUSEL_WEBHOOK_URL/KEY fehlt.', 503, {
      setup_required: true,
    })
  }

  const item = await resolveItem(format, itemId)
  if (!item) return fail('Inhalt nicht mehr im Feed gefunden – bitte aktualisieren.', 404)

  const article_id = contentArticleId(format, item.id)
  const existing = await findActiveCarouselByArticle(article_id)
  if (existing) {
    return NextResponse.json({ status: 'ok', production_run_id: existing.production_run_id, deduped: true })
  }

  const production_run_id = crypto.randomUUID()
  const ts = new Date().toISOString()
  const source = format === 'artikel' ? 'goldesel_news' : format

  try {
    const db = createAdminClient()
    const { error: prodErr } = await db.from('carousel_productions').insert({
      production_run_id,
      article_id,
      article_url: item.url,
      title: item.title,
      published_at: item.publishedAt,
      source,
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
    return fail(`Produktion konnte nicht gespeichert werden: ${err instanceof Error ? err.message : 'Unbekannt'}`, 500)
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const master = masterFor(format)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webhookKey}` },
      body: JSON.stringify({
        action: 'generate_goldesel_carousel',
        production_id: production_run_id,
        production_run_id,
        production_type: CAROUSEL_CONTENT_TYPE,
        format,
        format_label: FORMAT_LABEL[format],
        master,
        article_id,
        article_url: item.url,
        headline: item.title,
        title: item.title,
        summary: item.teaser,
        original_image_url: item.image,
        sources: [{ title: item.title, url: item.url, publishedAt: item.publishedAt }],
        published_at: item.publishedAt,
        source,
        output: { ...OUTPUT_SPECS.beitrag, renderer: 'higgsfield', model: 'nano_banana_pro' },
        callback_url: `${proto}://${host}/api/goldesel-carousel/callback`,
      }),
    })
    if (!res.ok) {
      await setCarouselStatus(production_run_id, 'failed', `GrokBot HTTP ${res.status}`).catch(() => {})
      return fail(`Produktionsdienst hat die Anfrage abgelehnt (HTTP ${res.status}).`, 502)
    }
    await setCarouselStatus(production_run_id, 'processing').catch(() => {})
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Netzwerkfehler'
    await setCarouselStatus(production_run_id, 'failed', message).catch(() => {})
    return fail(`Verbindung zum Produktionsdienst fehlgeschlagen: ${message}`, 502)
  }

  return NextResponse.json({ status: 'ok', production_run_id })
}
