import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchGoldeselNews, type GoldeselArticle } from '@/lib/goldesel-news'

/**
 * Persisted Goldesel article pool.
 *
 * This is the SHARED, persisted source for the Story Content → Goldesel News
 * page. It reuses the same live ingestion (lib/goldesel-news.ts) as the
 * Carousel Goldesel News page — no second scraper — but writes the results to
 * the `goldesel_articles` table so the list survives reload / navigation /
 * browser reopen and a page load never silently re-fetches.
 *
 * Fully defensive, mirroring lib/carousel.ts and lib/factory.ts: if the table
 * is missing (migration 004 not applied yet) or credentials are absent, reads
 * degrade to `null`/`[]` and the page falls back to a live (non-persisted)
 * read so it is never blank.
 */

export interface PooledArticle extends GoldeselArticle {
  ticker: string | null
  teaser: string | null
  firstSeenAt: string | null
  syncedAt: string | null
}

interface ArticleRow {
  id: string
  url: string
  title: string
  image: string | null
  published_at: string | null
  isin: string | null
  ticker: string | null
  teaser: string | null
  source: string
  first_seen_at: string | null
  synced_at: string | null
}

function rowToArticle(r: ArticleRow): PooledArticle {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    image: r.image,
    publishedAt: r.published_at,
    isin: r.isin,
    ticker: r.ticker,
    teaser: r.teaser,
    firstSeenAt: r.first_seen_at,
    syncedAt: r.synced_at,
  }
}

/** Newest first: valid publication date desc, then first-seen desc. */
function sortNewest(a: PooledArticle, b: PooledArticle): number {
  const ta = a.publishedAt ? Date.parse(a.publishedAt) : NaN
  const tb = b.publishedAt ? Date.parse(b.publishedAt) : NaN
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta
  return (b.firstSeenAt ?? '').localeCompare(a.firstSeenAt ?? '')
}

/**
 * Read the persisted pool.
 *   - returns an array (possibly empty) when the table is reachable
 *   - returns null when the table is missing / credentials absent (so callers
 *     can fall back to a live read instead of showing an empty pool)
 */
export async function getStoredArticles(limit = 20): Promise<PooledArticle[] | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('goldesel_articles')
      .select('*')
      .order('first_seen_at', { ascending: false })
      .limit(200)
    if (error) return null
    const articles = ((data as ArticleRow[]) ?? []).map(rowToArticle)
    articles.sort(sortNewest)
    return articles.slice(0, limit)
  } catch {
    return null
  }
}

export interface StoryArticlesResult {
  articles: PooledArticle[]
  /** true when served from the persisted pool, false when live fallback. */
  persisted: boolean
}

/**
 * Articles for the Story page. Prefers the persisted pool; only when the pool
 * is missing or still empty does it fall back to a single live read so the page
 * is never blank before the first sync. A page load NEVER writes the pool.
 */
/**
 * Workflow-agnostic name for the same persisted pool read. Both the Story and
 * the Carousel Goldesel-News pages share ONE pool (see migration 004); this
 * alias lets the Carousel page read it without implying the data is
 * story-specific.
 */
export function getPooledArticles(limit = 20): Promise<StoryArticlesResult> {
  return getStoryArticles(limit)
}

export async function getStoryArticles(limit = 20): Promise<StoryArticlesResult> {
  const stored = await getStoredArticles(limit)
  if (stored && stored.length > 0) {
    return { articles: stored, persisted: true }
  }
  // Fallback (pool empty or table missing): live read, not persisted.
  const live = await fetchGoldeselNews()
  const articles: PooledArticle[] = live.slice(0, limit).map((a) => ({
    ...a,
    ticker: null,
    firstSeenAt: null,
    syncedAt: null,
  }))
  return { articles, persisted: false }
}

export interface SyncResult {
  ok: boolean
  count: number
  inserted: number
  /** Whether the fresh list was written to the pool. */
  persisted: boolean
  /** Sanitized (whitelisted) articles from the fresh API read. */
  articles: GoldeselArticle[]
  message?: string
}

/**
 * Manual / scheduled sync: live-read the source and upsert into the pool. This
 * is the ONLY path (besides a scheduled job hitting the same route) that may
 * replace/update the pool. Existing rows keep their first_seen_at.
 *
 * When the pool table is unavailable the fresh list is still returned
 * (persisted: false) so "Aktualisieren" always reflects the current API.
 */
export async function syncArticlesFromSource(): Promise<SyncResult> {
  const live = await fetchGoldeselNews()
  if (live.length === 0) {
    return {
      ok: false,
      count: 0,
      inserted: 0,
      persisted: false,
      articles: [],
      message: 'Quelle lieferte keine Artikel.',
    }
  }

  const notPersisted = (message: string): SyncResult => ({
    ok: true,
    count: live.length,
    inserted: 0,
    persisted: false,
    articles: live,
    message,
  })

  let db: ReturnType<typeof createAdminClient>
  try {
    db = createAdminClient()
  } catch {
    return notPersisted('Artikel-Pool nicht konfiguriert — Liste nur live geladen.')
  }
  const ts = new Date().toISOString()

  // Which ids already exist — so we can keep their first_seen_at and report new ones.
  const ids = live.map((a) => a.id)
  const { data: existing, error: existErr } = await db
    .from('goldesel_articles')
    .select('id, image')
    .in('id', ids)
  if (existErr) {
    return notPersisted(
      'Tabelle goldesel_articles fehlt (Migration 004) — Liste nur live geladen, nicht gespeichert.',
    )
  }
  const storedImage = new Map(
    (existing ?? []).map((r: { id: string; image: string | null }) => [r.id, r.image] as const),
  )
  const existingIds = new Set(storedImage.keys())

  const rows = live.map((a) => {
    const row: Record<string, unknown> = {
      id: a.id,
      url: a.url,
      title: a.title,
      // Fill missing images from the feed, but never wipe a stored one.
      image: a.image ?? storedImage.get(a.id) ?? null,
      published_at: a.publishedAt,
      isin: a.isin,
      teaser: a.teaser,
      source: 'goldesel_news',
      synced_at: ts,
    }
    // Only set first_seen_at for genuinely new articles; keep it for existing.
    if (!existingIds.has(a.id)) row.first_seen_at = ts
    return row
  })

  const { error: upErr } = await db
    .from('goldesel_articles')
    .upsert(rows, { onConflict: 'id' })
  if (upErr) {
    return notPersisted('Artikel-Pool konnte nicht aktualisiert werden — Liste nur live geladen.')
  }

  const inserted = rows.filter((r) => r.first_seen_at === ts).length
  return { ok: true, count: rows.length, inserted, persisted: true, articles: live }
}
