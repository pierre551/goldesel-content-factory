import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Data layer for the Goldesel News Carousel workflow.
 *
 * Carousels are stored in dedicated tables (see
 * scripts/001_create_goldesel_carousel.sql) but surfaced through the SAME
 * production feed as stories, so they appear under "Aktuelle Produktion" and
 * "Verlauf" alongside everything else.
 *
 * All reads are defensive: if the tables are missing (migration not applied) or
 * credentials are absent (e.g. preview), they degrade to empty/null instead of
 * throwing, mirroring lib/factory.ts.
 */

export const CAROUSEL_SLIDE_COUNT = 5

/**
 * content_type values stored in carousel_productions — the canonical, unique
 * module identifiers that keep the two Goldesel-News workflows separate.
 * `CAROUSEL_CONTENT_TYPE` is the value the Grok workflow is locked to
 * (production_type = "goldesel_news_carousel"). `LEGACY_CAROUSEL_CONTENT_TYPES`
 * are pre-rename values still present on older rows; carousel reads treat any
 * non-story row as a carousel so those rows keep working without a migration.
 */
export const CAROUSEL_CONTENT_TYPE = 'goldesel_news_carousel'
export const LEGACY_CAROUSEL_CONTENT_TYPES = ['carousel_goldesel_news', 'instagram_carousel']
export const STORY_CONTENT_TYPE = 'story_goldesel_news'

export interface CarouselProductionRow {
  production_run_id: string
  article_id: string
  article_url: string
  title: string
  published_at: string | null
  source: string
  content_type: string
  slide_count: number
  status: string
  error: string | null
  instagram_caption: string | null
  created_at?: string
  updated_at?: string
}

export interface CarouselSlideRow {
  id: string
  production_run_id: string
  slide_index: number
  image_url: string | null
  prompt: string | null
  status: string
  created_at?: string
  updated_at?: string
}

/** UI shape — compatible with the story `UiProductionItem`, plus carousel extras. */
export interface CarouselUiItem {
  kind: 'carousel'
  /** Distinguishes a single vertical Story from a 5-slide Carousel. */
  format: 'carousel' | 'story'
  storyId: string
  candidateId: string
  company: string
  ticker: string
  headline: string
  status: string
  createdAt: string | null
  contentType: string
  resultUrl: string | null
  slideCount: number
  slidesDone: number
  articleId: string
  articleUrl: string | null
  instagramCaption: string | null
  generations: {
    id: string
    version: string | null
    imageUrl: string | null
    status: string | null
    qaScore: number | null
  }[]
}

const TERMINAL = new Set(['completed', 'failed'])

function nowIso() {
  return new Date().toISOString()
}

/** Create the production row plus 5 pending slide rows. Idempotent per run id. */
export async function createCarouselProduction(input: {
  production_run_id: string
  article_id: string
  article_url: string
  title: string
  published_at: string | null
  source: string
}): Promise<void> {
  const db = createAdminClient()
  const ts = nowIso()

  const { error: prodErr } = await db.from('carousel_productions').upsert(
    {
      production_run_id: input.production_run_id,
      article_id: input.article_id,
      article_url: input.article_url,
      title: input.title,
      published_at: input.published_at,
      source: input.source || 'goldesel_news',
      content_type: CAROUSEL_CONTENT_TYPE,
      slide_count: CAROUSEL_SLIDE_COUNT,
      // queued → set to 'processing' once GrokBot accepts the webhook.
      status: 'queued',
      error: null,
      updated_at: ts,
    },
    { onConflict: 'production_run_id' },
  )
  if (prodErr) throw new Error(prodErr.message)

  const slides = Array.from({ length: CAROUSEL_SLIDE_COUNT }, (_, i) => ({
    production_run_id: input.production_run_id,
    slide_index: i + 1,
    status: 'pending',
    updated_at: ts,
  }))
  const { error: slideErr } = await db
    .from('carousel_slides')
    .upsert(slides, { onConflict: 'production_run_id,slide_index' })
  if (slideErr) throw new Error(slideErr.message)
}

/**
 * Latest still-running CAROUSEL production for an article, used to dedupe
 * re-clicks. Scoped to "anything that is not a Story" (current
 * `carousel_goldesel_news` plus legacy `instagram_carousel`) so that a running
 * Story production for the same article can never dedupe/block a Carousel
 * (the two formats are independent).
 */
export async function findActiveCarouselByArticle(
  articleId: string,
): Promise<CarouselProductionRow | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('carousel_productions')
      .select('*')
      .eq('article_id', articleId)
      .neq('content_type', STORY_CONTENT_TYPE)
      .not('status', 'in', '(completed,failed)')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) return null
    return (data?.[0] as CarouselProductionRow) ?? null
  } catch {
    return null
  }
}

/**
 * Create a Goldesel STORY production. Reuses the carousel tables so the job
 * appears in the same production feed (Aktuelle Produktion / Verlauf) — it is
 * distinguished only by content_type = 'story_goldesel_news' and slide_count = 1.
 * Idempotent per production_run_id.
 */
export async function createStoryProduction(input: {
  production_run_id: string
  article_id: string
  article_url: string
  title: string
  published_at: string | null
  source: string
}): Promise<void> {
  const db = createAdminClient()
  const ts = nowIso()

  const { error: prodErr } = await db.from('carousel_productions').upsert(
    {
      production_run_id: input.production_run_id,
      article_id: input.article_id,
      article_url: input.article_url,
      title: input.title,
      published_at: input.published_at,
      source: input.source || 'goldesel_news',
      content_type: STORY_CONTENT_TYPE,
      slide_count: 1,
      // queued → set to 'processing' once GrokBot accepts the webhook.
      status: 'queued',
      error: null,
      updated_at: ts,
    },
    { onConflict: 'production_run_id' },
  )
  if (prodErr) throw new Error(prodErr.message)

  const { error: slideErr } = await db
    .from('carousel_slides')
    .upsert(
      { production_run_id: input.production_run_id, slide_index: 1, status: 'pending', updated_at: ts },
      { onConflict: 'production_run_id,slide_index' },
    )
  if (slideErr) throw new Error(slideErr.message)
}

/** Latest still-running STORY production for an article, used to dedupe re-clicks. */
export async function findActiveStoryByArticle(
  articleId: string,
): Promise<CarouselProductionRow | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('carousel_productions')
      .select('*')
      .eq('article_id', articleId)
      .eq('content_type', STORY_CONTENT_TYPE)
      .not('status', 'in', '(completed,failed)')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) return null
    return (data?.[0] as CarouselProductionRow) ?? null
  } catch {
    return null
  }
}

/**
 * Apply a Story callback's status. Unlike a carousel (5 slides), a Story is
 * done as soon as its single image exists. Explicit status from GrokBot always
 * wins; otherwise completion is derived from the one slide having an image.
 */
export async function applyStoryCallbackStatus(
  productionRunId: string,
  status?: string | null,
  error?: string | null,
): Promise<void> {
  const db = createAdminClient()
  let nextStatus = status ?? undefined

  if (!nextStatus) {
    const { data } = await db
      .from('carousel_slides')
      .select('image_url')
      .eq('production_run_id', productionRunId)
    const hasImage = (data ?? []).some((s: { image_url: string | null }) => s.image_url)
    if (hasImage) nextStatus = 'completed'
  }

  const patch: Record<string, unknown> = { updated_at: nowIso() }
  if (nextStatus) patch.status = nextStatus
  if (error != null) patch.error = String(error)
  const { error: err } = await db
    .from('carousel_productions')
    .update(patch)
    .eq('production_run_id', productionRunId)
  if (err) throw new Error(err.message)
}

export interface StoryStatusInfo {
  productionRunId: string
  status: string
}

/**
 * Map article id → latest Story production status, for the Story page so each
 * card can show whether a Story is running / completed. Only inspects
 * content_type = 'story_goldesel_news', so Carousel productions never affect it.
 */
export async function getStoryStatusByArticleIds(
  articleIds: string[],
): Promise<Record<string, StoryStatusInfo>> {
  if (articleIds.length === 0) return {}
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('carousel_productions')
      .select('production_run_id, article_id, status, created_at')
      .eq('content_type', STORY_CONTENT_TYPE)
      .in('article_id', articleIds)
      .order('created_at', { ascending: false })
    if (error || !data) return {}
    const map: Record<string, StoryStatusInfo> = {}
    for (const row of data as {
      production_run_id: string
      article_id: string
      status: string
    }[]) {
      // Rows arrive newest-first; keep the first (latest) per article.
      if (!map[row.article_id]) {
        map[row.article_id] = {
          productionRunId: row.production_run_id,
          status: row.status,
        }
      }
    }
    return map
  } catch {
    return {}
  }
}

/**
 * Map article id → latest CAROUSEL production status, for the Carousel page so
 * each card can show "In Produktion" / "fertig" and block a duplicate start —
 * persistently, across reloads (the DB is the source of truth, not React
 * state). Excludes story rows, so a running Story never marks a card here.
 */
export async function getCarouselStatusByArticleIds(
  articleIds: string[],
): Promise<Record<string, StoryStatusInfo>> {
  if (articleIds.length === 0) return {}
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('carousel_productions')
      .select('production_run_id, article_id, status, created_at')
      .neq('content_type', STORY_CONTENT_TYPE)
      .in('article_id', articleIds)
      .order('created_at', { ascending: false })
    if (error || !data) return {}
    const map: Record<string, StoryStatusInfo> = {}
    for (const row of data as {
      production_run_id: string
      article_id: string
      status: string
    }[]) {
      // Rows arrive newest-first; keep the first (latest) per article.
      if (!map[row.article_id]) {
        map[row.article_id] = {
          productionRunId: row.production_run_id,
          status: row.status,
        }
      }
    }
    return map
  } catch {
    return {}
  }
}

export async function setCarouselStatus(
  productionRunId: string,
  status: string,
  error?: string | null,
): Promise<void> {
  const db = createAdminClient()
  const patch: Record<string, unknown> = { status, updated_at: nowIso() }
  if (error !== undefined) patch.error = error
  const { error: err } = await db
    .from('carousel_productions')
    .update(patch)
    .eq('production_run_id', productionRunId)
  if (err) throw new Error(err.message)
}

/** Upsert slide assets from a callback. Only overwrites fields that are present. */
export async function upsertCarouselSlides(
  productionRunId: string,
  slides: { slide_index: number; image_url?: string | null; prompt?: string | null; status?: string | null }[],
): Promise<void> {
  if (slides.length === 0) return
  const db = createAdminClient()
  const ts = nowIso()
  const rows = slides
    .filter((s) => Number.isFinite(s.slide_index) && s.slide_index > 0)
    .map((s) => {
      const row: Record<string, unknown> = {
        production_run_id: productionRunId,
        slide_index: s.slide_index,
        updated_at: ts,
      }
      if (s.image_url != null) row.image_url = s.image_url
      if (s.prompt != null) row.prompt = s.prompt
      row.status = s.status ?? (s.image_url ? 'complete' : 'pending')
      return row
    })
  if (rows.length === 0) return
  const { error } = await db
    .from('carousel_slides')
    .upsert(rows, { onConflict: 'production_run_id,slide_index' })
  if (error) throw new Error(error.message)
}

/**
 * Persist the carousel-level Instagram caption. Idempotent and non-destructive:
 * a null/empty incoming caption is ignored so a late partial callback can never
 * wipe a caption that a previous callback already stored.
 */
export async function setCarouselCaption(
  productionRunId: string,
  caption: string | null | undefined,
): Promise<void> {
  const clean = typeof caption === 'string' ? caption.trim() : ''
  if (!clean) return
  const db = createAdminClient()
  const { error } = await db
    .from('carousel_productions')
    .update({ instagram_caption: clean, updated_at: nowIso() })
    .eq('production_run_id', productionRunId)
  if (error) throw new Error(error.message)
}

/**
 * Apply a callback's status. If no explicit status is given, derive it: all
 * slides with images → completed, otherwise leave the row's status untouched.
 */
export async function applyCarouselCallbackStatus(
  productionRunId: string,
  status?: string | null,
  error?: string | null,
): Promise<void> {
  const db = createAdminClient()
  let nextStatus = status ?? undefined

  // Completion rule (spec §18): a carousel is COMPLETED only when all five
  // slides actually exist as images. This guards both the derived path (no
  // explicit status) and an explicit 'completed' arriving before every slide
  // has rendered — in the latter case we hold at 'qa' until the last image
  // lands, so a premature 'completed' can never hide missing slides.
  if (!nextStatus || nextStatus === 'completed') {
    const { data } = await db
      .from('carousel_slides')
      .select('image_url')
      .eq('production_run_id', productionRunId)
    const done = (data ?? []).filter((s: { image_url: string | null }) => s.image_url).length
    if (done >= CAROUSEL_SLIDE_COUNT) nextStatus = 'completed'
    else if (nextStatus === 'completed') nextStatus = 'qa'
  }

  const patch: Record<string, unknown> = { updated_at: nowIso() }
  if (nextStatus) patch.status = nextStatus
  if (error != null) patch.error = String(error)
  const { error: err } = await db
    .from('carousel_productions')
    .update(patch)
    .eq('production_run_id', productionRunId)
  if (err) throw new Error(err.message)
}

export async function getCarousel(
  productionRunId: string,
): Promise<{ production: CarouselProductionRow; slides: CarouselSlideRow[] } | null> {
  try {
    const db = createAdminClient()
    const { data: prod, error } = await db
      .from('carousel_productions')
      .select('*')
      .eq('production_run_id', productionRunId)
      .limit(1)
    if (error || !prod?.[0]) return null
    const { data: slides } = await db
      .from('carousel_slides')
      .select('*')
      .eq('production_run_id', productionRunId)
      .order('slide_index', { ascending: true })
    return {
      production: prod[0] as CarouselProductionRow,
      slides: (slides as CarouselSlideRow[]) ?? [],
    }
  } catch {
    return null
  }
}

function toUiItem(prod: CarouselProductionRow, slides: CarouselSlideRow[]): CarouselUiItem {
  const ordered = [...slides].sort((a, b) => a.slide_index - b.slide_index)
  const isStory = prod.content_type === STORY_CONTENT_TYPE
  return {
    kind: 'carousel',
    format: isStory ? 'story' : 'carousel',
    storyId: prod.production_run_id,
    candidateId: '',
    company: '',
    ticker: '',
    headline: prod.title,
    status: prod.status,
    createdAt: prod.created_at ?? null,
    contentType: isStory ? 'Goldesel News / Story' : 'Goldesel Carousel',
    resultUrl: null,
    slideCount: prod.slide_count ?? (isStory ? 1 : CAROUSEL_SLIDE_COUNT),
    slidesDone: ordered.filter((s) => s.image_url).length,
    articleId: prod.article_id,
    articleUrl: prod.article_url ?? null,
    instagramCaption: prod.instagram_caption ?? null,
    generations: ordered.map((s) => ({
      id: s.id,
      version: String(s.slide_index),
      imageUrl: s.image_url,
      status: s.status,
      qaScore: null,
    })),
  }
}

/**
 * Carousel items for the production feed.
 *   scope 'active'    → still running: status NOT IN (completed, failed)
 *   scope 'completed' → TERMINAL: status IN (completed, failed) — for Verlauf
 *
 * A failed production is terminal, so it leaves "Aktuelle Produktion" and stays
 * visible in "Verlauf" (never silently dropped).
 */
export async function getCarouselItems(
  scope: 'active' | 'completed',
): Promise<CarouselUiItem[]> {
  try {
    const db = createAdminClient()
    const query = db
      .from('carousel_productions')
      .select('*')
      .order('created_at', { ascending: false })
    const { data, error } =
      scope === 'completed'
        ? await query.in('status', ['completed', 'failed'])
        : await query.not('status', 'in', '(completed,failed)')
    if (error || !data || data.length === 0) return []

    const ids = (data as CarouselProductionRow[]).map((p) => p.production_run_id)
    const { data: allSlides } = await db
      .from('carousel_slides')
      .select('*')
      .in('production_run_id', ids)
    const byRun = new Map<string, CarouselSlideRow[]>()
    for (const s of (allSlides as CarouselSlideRow[]) ?? []) {
      const arr = byRun.get(s.production_run_id) ?? []
      arr.push(s)
      byRun.set(s.production_run_id, arr)
    }
    return (data as CarouselProductionRow[]).map((p) =>
      toUiItem(p, byRun.get(p.production_run_id) ?? []),
    )
  } catch (err) {
    console.log(
      '[v0] carousel feed error:',
      err instanceof Error ? err.message : err,
    )
    return []
  }
}

export function isCarouselTerminal(status: string): boolean {
  return TERMINAL.has(status)
}

export interface CarouselDashboardSummary {
  /** Carousel productions currently running (not completed, not failed). */
  active: number
  /** Carousel productions completed today (local day). */
  completedToday: number
}

/**
 * Carousel KPIs for the dashboard. Defensive: missing table/credentials → zeros.
 */
export async function getCarouselDashboardSummary(): Promise<CarouselDashboardSummary> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('carousel_productions')
      .select('status, created_at, updated_at')
    if (error || !data) return { active: 0, completedToday: 0 }
    const rows = data as { status: string; created_at?: string; updated_at?: string }[]
    const now = new Date()
    const sameDay = (iso?: string) => {
      if (!iso) return false
      const d = new Date(iso)
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      )
    }
    const active = rows.filter((r) => r.status !== 'completed' && r.status !== 'failed').length
    const completedToday = rows.filter(
      (r) => r.status === 'completed' && sameDay(r.updated_at ?? r.created_at),
    ).length
    return { active, completedToday }
  } catch {
    return { active: 0, completedToday: 0 }
  }
}
