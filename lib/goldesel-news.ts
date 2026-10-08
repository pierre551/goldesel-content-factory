import 'server-only'

/**
 * Server-side reader for published Goldesel articles.
 *
 * Uses the goldesel.de JSON endpoint. SECURITY: the upstream response carries
 * additional account/user data that must never leave this function. Only the
 * whitelisted article fields (headline, previewImg, previewText, publishDate,
 * directLink) are copied into a fresh object; the raw payload is never
 * returned, logged, cached (`cache: 'no-store'`) or persisted.
 */

const SOURCE_URL =
  'https://goldesel.de/api/app/content/getblogposts?take=20&lastId=0&contentType=1&onlyFavorite=false&subCategoryId=0'
const SITE_ORIGIN = 'https://goldesel.de'
const MAX_ARTICLES = 20

export interface GoldeselArticle {
  id: string
  url: string
  title: string
  image: string | null
  publishedAt: string | null
  isin: string | null
  teaser: string | null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function absoluteUrl(u: string): string | null {
  try {
    const url = new URL(u, SITE_ORIGIN)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function slugFromUrl(url: string): string | null {
  const slug = new URL(url).pathname.replace(/\/$/, '').split('/').pop()
  return slug || null
}

/** Copies ONLY the explicitly allowed article fields out of one upstream item. */
function pickArticle(item: unknown): GoldeselArticle | null {
  if (!item || typeof item !== 'object') return null
  const src = item as Record<string, unknown>

  const title = str(src.headline)
  const link = str(src.directLink)
  const url = link ? absoluteUrl(link) : null
  if (!title || !url) return null
  const id = slugFromUrl(url)
  if (!id) return null

  const img = str(src.previewImg)
  return {
    id,
    url,
    title,
    image: img ? absoluteUrl(img) : null,
    publishedAt: str(src.publishDate),
    isin: null,
    teaser: str(src.previewText),
  }
}

export async function fetchGoldeselNews(): Promise<GoldeselArticle[]> {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GoldeselContentFactory/1.0)',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('goldesel articles API HTTP', res.status)
      return []
    }
    const payload: unknown = await res.json()
    if (!Array.isArray(payload)) {
      console.error('goldesel articles API: unexpected response shape')
      return []
    }

    const seen = new Set<string>()
    const articles: GoldeselArticle[] = []
    for (const item of payload) {
      const article = pickArticle(item)
      if (!article || seen.has(article.id)) continue
      seen.add(article.id)
      articles.push(article)
      if (articles.length >= MAX_ARTICLES) break
    }
    articles.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
      return tb - ta
    })
    return articles
  } catch (err) {
    console.error(
      'goldesel articles API fetch error:',
      err instanceof Error ? err.message : 'unknown error',
    )
    return []
  }
}
