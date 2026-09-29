import 'server-only'

/**
 * Server-side reader for published Goldesel News articles.
 *
 * goldesel.de/aktien/news exposes no JSON API and no NewsArticle structured
 * data — only server-rendered <article> markup — so we parse that HTML here on
 * the server (never in the browser). Fully defensive: any failure or markup
 * change degrades to an empty list rather than throwing.
 */

const SOURCE_URL = 'https://goldesel.de/aktien/news'

export interface GoldeselArticle {
  id: string
  url: string
  title: string
  image: string | null
  publishedAt: string | null
  isin: string | null
}

function decodeEntities(s: string): string {
  return s
    // Numeric entities first (decimal &#252; and hex &#xFC;).
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    // Ampersand last so it can't double-decode the entities above.
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function absoluteUrl(u: string): string {
  if (!u) return u
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('/')) return `https://goldesel.de${u}`
  return u
}

function titleFromSlug(id: string): string {
  return id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export async function fetchGoldeselNews(): Promise<GoldeselArticle[]> {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoldeselContentFactory/1.0)',
      },
      // Cache for 5 minutes so the page is fast and we are polite to the source.
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      console.log('[v0] goldesel news HTTP', res.status)
      return []
    }
    const html = await res.text()
    const items: GoldeselArticle[] = []
    const seen = new Set<string>()

    const articleRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi
    let m: RegExpExecArray | null
    while ((m = articleRe.exec(html))) {
      const outer = m[0]
      const inner = m[1]

      const href =
        (outer.match(/href="([^"]*\/aktien\/news\/[^"#?]+)"/i) ??
          inner.match(/href="([^"]*\/aktien\/news\/[^"#?]+)"/i))?.[1]
      if (!href) continue

      const url = absoluteUrl(href)
      const id =
        url
          .replace(/[#?].*$/, '')
          .replace(/\/$/, '')
          .split('/')
          .pop() || url
      if (!id || id === 'news' || seen.has(id)) continue

      const rawTitle =
        inner.match(/<img[^>]+alt="([^"]+)"/i)?.[1] ??
        inner.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] ??
        inner.match(/\/aktien\/news\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
        ''
      let title = decodeEntities(rawTitle.replace(/<[^>]+>/g, ' '))
      if (!title || title.length < 6) title = titleFromSlug(id)

      const rawImg =
        inner.match(/<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"/i)?.[1] ?? ''
      const image = rawImg ? absoluteUrl(rawImg) : null

      const rawDate =
        inner.match(/datetime="([^"]+)"/i)?.[1] ??
        inner.match(/<time[^>]*>([\s\S]*?)<\/time>/i)?.[1] ??
        null
      const publishedAt = rawDate ? decodeEntities(rawDate) : null

      const rawIsin =
        outer.match(/data-isins?="([^"]+)"/i)?.[1] ??
        inner.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/)?.[1] ??
        null
      const isin = rawIsin ? rawIsin.split(/[,\s]/)[0] : null

      items.push({ id, url, title, image, publishedAt, isin })
      seen.add(id)
      if (items.length >= 30) break
    }

    return items
  } catch (err) {
    console.log(
      '[v0] goldesel news fetch error:',
      err instanceof Error ? err.message : err,
    )
    return []
  }
}
