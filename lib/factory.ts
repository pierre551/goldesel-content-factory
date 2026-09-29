import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server-only data access for the Aktien-News research workflow.
 *
 * Schema contract (existing Supabase tables):
 *   research_runs   : id (uuid), category (text), status (text), created_at
 *   news_candidates : id (uuid), research_run_id (uuid fk), company, ticker,
 *                     headline, summary, source_urls (text[]/jsonb),
 *                     relevance_score (int), viral_score (int), selected (bool)
 *   factory_events  : event_type (text) + best-effort research_run_id / payload
 */

export const AKTIEN_CATEGORY = 'aktien_news'
export const MAX_SELECTION = 2

export type RunStatus =
  | 'researching'
  | 'awaiting_selection'
  | 'error'
  | (string & {})

export interface ResearchRunRow {
  id: string
  category: string
  status: RunStatus
  created_at?: string
}

export interface CandidateRow {
  id: string
  research_run_id: string
  company: string
  ticker: string
  headline: string
  summary: string | null
  source_urls: string[] | null
  relevance_score: number | null
  viral_score: number | null
  selected: boolean | null
  created_at?: string
}

/** Shape consumed by the (unchanged) candidate card UI. */
export interface UiCandidate {
  id: string
  company: string
  ticker: string
  headline: string
  explanation: string
  source: string
  sourceUrls: string[]
  publishedAt: string
  relevanceScore: number
  viralScore: number
  selected: boolean
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Quelle'
  }
}

export function toUiCandidate(row: CandidateRow): UiCandidate {
  const urls = Array.isArray(row.source_urls) ? row.source_urls : []
  return {
    id: row.id,
    company: row.company,
    ticker: row.ticker,
    headline: row.headline,
    explanation: row.summary ?? '',
    source: urls.length ? hostOf(urls[0]) : 'Goldesel Scout',
    sourceUrls: urls,
    publishedAt: row.created_at
      ? new Date(row.created_at).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: 'short',
        })
      : '',
    relevanceScore: Number(row.relevance_score ?? 0),
    viralScore: Number(row.viral_score ?? 0),
    selected: Boolean(row.selected),
  }
}

export async function createResearchRun(category: string): Promise<ResearchRunRow> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('research_runs')
    .insert({ category, status: 'researching' })
    .select('id, category, status, created_at')
    .single()
  if (error) throw new Error(`createResearchRun failed: ${error.message}`)
  return data as ResearchRunRow
}

export async function getRun(id: string): Promise<ResearchRunRow | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('research_runs')
    .select('id, category, status, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getRun failed: ${error.message}`)
  return (data as ResearchRunRow) ?? null
}

export async function getLatestRun(category: string): Promise<ResearchRunRow | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('research_runs')
    .select('id, category, status, created_at')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getLatestRun failed: ${error.message}`)
  return (data as ResearchRunRow) ?? null
}

export async function setRunStatus(id: string, status: string): Promise<void> {
  const db = createAdminClient()
  const { error } = await db.from('research_runs').update({ status }).eq('id', id)
  if (error) throw new Error(`setRunStatus failed: ${error.message}`)
}

export async function getCandidates(runId: string): Promise<CandidateRow[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('news_candidates')
    .select(
      'id, research_run_id, company, ticker, headline, summary, source_urls, relevance_score, viral_score, selected, created_at',
    )
    .eq('research_run_id', runId)
    .order('relevance_score', { ascending: false })
  if (error) throw new Error(`getCandidates failed: ${error.message}`)
  return (data as CandidateRow[]) ?? []
}

export async function deleteCandidates(runId: string): Promise<void> {
  const db = createAdminClient()
  const { error } = await db.from('news_candidates').delete().eq('research_run_id', runId)
  if (error) throw new Error(`deleteCandidates failed: ${error.message}`)
}

export interface IncomingCandidate {
  company: string
  ticker: string
  headline: string
  summary?: string
  source_urls?: string[]
  relevance_score?: number
  viral_score?: number
}

export async function insertCandidates(
  runId: string,
  candidates: IncomingCandidate[],
): Promise<void> {
  const db = createAdminClient()
  const rows = candidates.map((c) => ({
    research_run_id: runId,
    company: c.company,
    ticker: c.ticker,
    headline: c.headline,
    summary: c.summary ?? null,
    source_urls: Array.isArray(c.source_urls) ? c.source_urls : [],
    relevance_score: typeof c.relevance_score === 'number' ? c.relevance_score : null,
    viral_score: typeof c.viral_score === 'number' ? c.viral_score : null,
    selected: false,
  }))
  const { error } = await db.from('news_candidates').insert(rows)
  if (error) throw new Error(`insertCandidates failed: ${error.message}`)
}

/** Enforce the max-2 rule server-side, then persist the selection flag. */
export async function setCandidateSelected(
  runId: string,
  candidateId: string,
  selected: boolean,
): Promise<{ ok: boolean; reason?: string; selectedIds: string[] }> {
  const db = createAdminClient()
  // Count only pool candidates (those NOT yet handed to production), so an
  // already-produced candidate never blocks selecting from the remaining pool.
  const pool = await getPoolCandidates(runId)
  const selectedIds = pool.filter((c) => c.selected).map((c) => c.id)

  if (selected && !selectedIds.includes(candidateId)) {
    if (selectedIds.length >= MAX_SELECTION) {
      return { ok: false, reason: 'max_selection', selectedIds }
    }
  }

  const { error } = await db
    .from('news_candidates')
    .update({ selected })
    .eq('id', candidateId)
    .eq('research_run_id', runId)
  if (error) throw new Error(`setCandidateSelected failed: ${error.message}`)

  const next = selected
    ? [...new Set([...selectedIds, candidateId])]
    : selectedIds.filter((id) => id !== candidateId)
  return { ok: true, selectedIds: next }
}

/**
 * Best-effort event log. The exact factory_events shape may vary, so we try a
 * rich row, then a minimal one, and never let a logging failure break the
 * surrounding operation.
 */
export async function logEvent(
  eventType: string,
  runId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const db = createAdminClient()
  const attempts: Record<string, unknown>[] = [
    { event_type: eventType, research_run_id: runId, payload },
    { event_type: eventType, research_run_id: runId },
    { event_type: eventType },
  ]
  for (const row of attempts) {
    const { error } = await db.from('factory_events').insert(row)
    if (!error) return
  }
}

/* ------------------------------------------------------------------ *
 * Selection → Production
 * ------------------------------------------------------------------ */

export const IN_PRODUCTION = 'in_production'

/**
 * Ordered production lifecycle. Statuses are stored verbatim from the manager
 * callbacks (never fabricated); this order is only used to render progress.
 */
export const PRODUCTION_STEPS = [
  'production_started',
  'content_started',
  'content_ready',
  'quality_gate_passed',
  'prompt_ready',
  'image_generation_started',
  'image_v1_created',
  'image_v2_created',
  'image_approved',
  'canva_started',
  'canva_ready',
  'final_qa_passed',
  'production_completed',
] as const

/** Callback event types that carry an image generation. */
export const IMAGE_EVENTS = new Set([
  'image_v1_created',
  'image_v1_rejected',
  'image_v2_created',
  'image_approved',
])

// Real `stories` schema: id, news_candidate_id, headline, status, created_at, body.
// A story links to its research run ONLY through news_candidates.research_run_id;
// company/ticker and the produced asset live on the candidate / generations.
export interface StoryRow {
  id: string
  news_candidate_id?: string | null
  headline?: string | null
  status: string
  created_at?: string
  body?: string | null
}

/** Human-readable content-type labels, keyed by research_runs.category. */
export const CATEGORY_LABELS: Record<string, string> = {
  aktien_news: 'Aktien News',
  wirtschaft_news: 'Wirtschaft News',
  analysten_ratings: 'Analysten Ratings',
  termine_weekly: 'Termine Weekly',
  termine_daily: 'Termine Daily',
  zitate: 'Zitate',
}

export function categoryLabel(category?: string | null): string {
  return (category && CATEGORY_LABELS[category]) || 'Content'
}

/** Candidate ids in this run that already have a story (handed to production). */
export async function getStoryCandidateIds(runId: string): Promise<Set<string>> {
  const stories = await getStoriesByRun(runId)
  return new Set(stories.map((s) => s.news_candidate_id).filter(Boolean) as string[])
}

/** Research pool = candidates of the run that have NOT been produced yet. */
export async function getPoolCandidates(runId: string): Promise<CandidateRow[]> {
  const [all, produced] = await Promise.all([
    getCandidates(runId),
    getStoryCandidateIds(runId),
  ])
  return all.filter((c) => !produced.has(c.id))
}

/** Pool candidates flagged selected — the set eligible for a new production. */
export async function getSelectedPoolCandidates(runId: string): Promise<CandidateRow[]> {
  const pool = await getPoolCandidates(runId)
  return pool.filter((c) => c.selected)
}

export async function getCandidatesByIds(ids: string[]): Promise<CandidateRow[]> {
  if (ids.length === 0) return []
  const db = createAdminClient()
  const { data, error } = await db
    .from('news_candidates')
    .select(
      'id, research_run_id, company, ticker, headline, summary, source_urls, relevance_score, viral_score, selected, created_at',
    )
    .in('id', ids)
  if (error) return []
  return (data as CandidateRow[]) ?? []
}

export async function getRunsByIds(ids: string[]): Promise<ResearchRunRow[]> {
  if (ids.length === 0) return []
  const db = createAdminClient()
  const { data, error } = await db
    .from('research_runs')
    .select('id, category, status, created_at')
    .in('id', ids)
  if (error) return []
  return (data as ResearchRunRow[]) ?? []
}

/** All stories across every run, newest first (defensive column selection). */
export async function getAllStories(): Promise<StoryRow[]> {
  const db = createAdminClient()
  const colVariants = [
    'id, news_candidate_id, headline, status, created_at',
    'id, news_candidate_id, status, created_at',
    'id, status, created_at',
    'id, status',
  ]
  for (const cols of colVariants) {
    const { data, error } = await db
      .from('stories')
      .select(cols)
      .order('created_at', { ascending: false })
    if (!error) return ((data as unknown) as StoryRow[]) ?? []
  }
  return []
}

export interface GenerationRow {
  id: string
  story_id?: string | null
  version?: string | number | null
  image_url?: string | null
  status?: string | null
  qa_score?: number | null
  created_at?: string
}

export async function getSelectedCandidates(runId: string): Promise<CandidateRow[]> {
  const all = await getCandidates(runId)
  return all.filter((c) => c.selected)
}

/** Force the selected flag on the given candidate ids (idempotent). */
export async function markCandidatesSelected(
  runId: string,
  candidateIds: string[],
): Promise<void> {
  if (candidateIds.length === 0) return
  const db = createAdminClient()
  const { error } = await db
    .from('news_candidates')
    .update({ selected: true })
    .eq('research_run_id', runId)
    .in('id', candidateIds)
  if (error) throw new Error(`markCandidatesSelected failed: ${error.message}`)
}

export async function getStoriesByRun(runId: string): Promise<StoryRow[]> {
  const db = createAdminClient()
  // Stories carry no run id; resolve the run's candidates first, then the
  // stories that point at those candidates.
  const { data: cands } = await db
    .from('news_candidates')
    .select('id')
    .eq('research_run_id', runId)
  const candIds = ((cands as { id: string }[] | null) ?? []).map((c) => c.id)
  if (candIds.length === 0) return []
  const colVariants = [
    'id, news_candidate_id, headline, status, created_at',
    'id, news_candidate_id, status, created_at',
    'id, news_candidate_id, status',
  ]
  for (const cols of colVariants) {
    const { data, error } = await db
      .from('stories')
      .select(cols)
      .in('news_candidate_id', candIds)
    if (!error) return ((data as unknown) as StoryRow[]) ?? []
  }
  return []
}

async function insertStory(c: CandidateRow): Promise<StoryRow | null> {
  const db = createAdminClient()
  const variants: Record<string, unknown>[] = [
    {
      news_candidate_id: c.id,
      headline: c.headline,
      status: 'production_started',
    },
    { news_candidate_id: c.id, status: 'production_started' },
  ]
  const selectVariants = [
    'id, news_candidate_id, headline, status, created_at',
    'id, news_candidate_id, status',
    'id',
  ]
  for (const row of variants) {
    for (const sel of selectVariants) {
      const { data, error } = await db.from('stories').insert(row).select(sel).single()
      if (!error) return ((data as unknown) as StoryRow) ?? null
    }
  }
  return null
}

/** Create a story per selected candidate if one does not already exist. */
export async function createStoriesForSelection(
  runId: string,
  candidates: CandidateRow[],
): Promise<StoryRow[]> {
  const existing = await getStoriesByRun(runId)
  const haveCandidate = new Set(
    existing.map((s) => s.news_candidate_id).filter(Boolean) as string[],
  )
  const result: StoryRow[] = [...existing]
  for (const c of candidates) {
    if (haveCandidate.has(c.id)) continue
    const row = await insertStory(c)
    if (row) result.push(row)
  }
  return result
}

/** Resolve a story id from an explicit id, or via (run, candidate). */
export async function resolveStoryId(opts: {
  storyId?: string | null
  runId?: string | null
  candidateId?: string | null
}): Promise<string | null> {
  if (opts.storyId) return opts.storyId
  if (!opts.candidateId) return null
  const db = createAdminClient()
  const { data, error } = await db
    .from('stories')
    .select('id')
    .eq('news_candidate_id', opts.candidateId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as { id: string } | null)?.id ?? null
}

export async function setStoryStatus(opts: {
  storyId?: string | null
  runId?: string | null
  candidateId?: string | null
  status: string
}): Promise<void> {
  const db = createAdminClient()
  if (opts.storyId) {
    const { error } = await db
      .from('stories')
      .update({ status: opts.status })
      .eq('id', opts.storyId)
    if (error) throw new Error(`setStoryStatus failed: ${error.message}`)
    return
  }
  if (opts.candidateId) {
    const { error } = await db
      .from('stories')
      .update({ status: opts.status })
      .eq('news_candidate_id', opts.candidateId)
    if (error) throw new Error(`setStoryStatus failed: ${error.message}`)
  }
}

export interface IncomingGeneration {
  story_id: string
  version?: string | number
  image_url: string
  status?: string
  qa_score?: number
}

/** Best-effort generation insert tolerant of differing column sets. */
export async function insertGeneration(gen: IncomingGeneration): Promise<void> {
  const db = createAdminClient()
  const full: Record<string, unknown> = { story_id: gen.story_id, image_url: gen.image_url }
  if (gen.version !== undefined) full.version = gen.version
  if (gen.status !== undefined) full.status = gen.status
  if (gen.qa_score !== undefined) full.qa_score = gen.qa_score
  const variants: Record<string, unknown>[] = [
    full,
    { story_id: gen.story_id, image_url: gen.image_url, status: gen.status ?? null },
    { story_id: gen.story_id, image_url: gen.image_url },
  ]
  for (const row of variants) {
    const { error } = await db.from('generations').insert(row)
    if (!error) return
  }
}

export async function getGenerationsByStories(
  storyIds: string[],
): Promise<GenerationRow[]> {
  if (storyIds.length === 0) return []
  const db = createAdminClient()
  const colVariants = [
    'id, story_id, version, image_url, status, qa_score, created_at',
    'id, story_id, image_url, status, created_at',
    'id, story_id, image_url',
  ]
  for (const cols of colVariants) {
    const { data, error } = await db
      .from('generations')
      .select(cols)
      .in('story_id', storyIds)
      .order('created_at', { ascending: true })
    if (!error) return ((data as unknown) as GenerationRow[]) ?? []
  }
  return []
}

/** Shape consumed by the production status UI. */
export interface UiProductionItem {
  storyId: string | null
  candidateId: string
  company: string
  ticker: string
  headline: string
  status: string
  createdAt: string | null
  contentType: string
  resultUrl: string | null
  generations: {
    id: string
    version: string | null
    imageUrl: string | null
    status: string | null
    qaScore: number | null
  }[]
}

export type ProductionScope = 'active' | 'completed'

/**
 * Global production feed, split into the two lifecycle buckets the UI needs:
 *   - 'active'    → stories still running (queued/processing/rendering/…)
 *   - 'completed' → TERMINAL stories, i.e. completed OR failed (for Verlauf)
 *
 * A failed production is terminal: it must leave "Aktuelle Produktion" and stay
 * visible in "Verlauf" rather than lingering as active forever.
 *
 * Company/ticker/headline come from the story row when present, otherwise from
 * the originating candidate. Content type is derived from the run category so
 * the timeline can host more than just Aktien News later.
 */
const STORY_TERMINAL_STATUSES = new Set(['production_completed', 'production_failed', 'failed'])

export async function getProductions(scope: ProductionScope): Promise<UiProductionItem[]> {
  const stories = await getAllStories()
  const filtered = stories.filter((s) =>
    scope === 'completed'
      ? STORY_TERMINAL_STATUSES.has(s.status)
      : !STORY_TERMINAL_STATUSES.has(s.status),
  )
  if (filtered.length === 0) return []

  const candidateIds = [
    ...new Set(filtered.map((s) => s.news_candidate_id).filter(Boolean) as string[]),
  ]
  const storyIds = filtered.map((s) => s.id)

  const [cands, gens] = await Promise.all([
    getCandidatesByIds(candidateIds),
    getGenerationsByStories(storyIds),
  ])
  const candById = new Map(cands.map((c) => [c.id, c]))
  // Runs are reachable only through the candidate (stories carry no run id).
  const runIds = [
    ...new Set(cands.map((c) => c.research_run_id).filter(Boolean) as string[]),
  ]
  const runs = await getRunsByIds(runIds)
  const runById = new Map(runs.map((r) => [r.id, r]))
  const gensByStory = new Map<string, GenerationRow[]>()
  for (const g of gens) {
    if (!g.story_id) continue
    const arr = gensByStory.get(g.story_id) ?? []
    arr.push(g)
    gensByStory.set(g.story_id, arr)
  }

  return filtered.map((s) => {
    const cand = s.news_candidate_id ? candById.get(s.news_candidate_id) : undefined
    const run = cand?.research_run_id ? runById.get(cand.research_run_id) : undefined
    const storyGens = gensByStory.get(s.id) ?? []
    // Stories have no result-url column; the produced asset is the newest
    // generation image for the story (if any).
    const resultUrl =
      [...storyGens].reverse().find((g) => g.image_url)?.image_url ?? null
    return {
      storyId: s.id,
      candidateId: s.news_candidate_id ?? '',
      company: cand?.company ?? '—',
      ticker: cand?.ticker ?? '',
      headline: s.headline ?? cand?.headline ?? '',
      status: s.status,
      createdAt: s.created_at ?? null,
      contentType: categoryLabel(run?.category),
      resultUrl,
      generations: storyGens.map((g) => ({
        id: g.id,
        version: g.version != null ? String(g.version) : null,
        imageUrl: g.image_url ?? null,
        status: g.status ?? null,
        qaScore: typeof g.qa_score === 'number' ? g.qa_score : null,
      })),
    }
  })
}

/* ------------------------------------------------------------------ *
 * Dashboard summary (story side)
 * ------------------------------------------------------------------ */

export interface StoryDashboardSummary {
  /** Candidates across all runs that are still in the pool (not produced). */
  newsPool: number
  /** Story productions currently running (not completed). */
  storyActive: number
  /** Story productions that reached completed today (local day). */
  completedTodayStories: number
  /** Latest research-completed event time, ISO, or null if never. */
  lastNewsSyncAt: string | null
  /** Recent factory error events (best-effort; null if not derivable). */
  errorCount: number | null
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/**
 * Real dashboard metrics for the story side, all derived from existing tables.
 * Every sub-read is defensive: a missing table or absent credentials yields a
 * safe zero/null rather than throwing, so the dashboard never fabricates data.
 */
export async function getStoryDashboardSummary(): Promise<StoryDashboardSummary> {
  const empty: StoryDashboardSummary = {
    newsPool: 0,
    storyActive: 0,
    completedTodayStories: 0,
    lastNewsSyncAt: null,
    errorCount: null,
  }

  let stories: StoryRow[] = []
  try {
    stories = await getAllStories()
  } catch {
    stories = []
  }
  const producedCandidateIds = new Set(
    stories.map((s) => s.news_candidate_id).filter(Boolean) as string[],
  )
  const storyActive = stories.filter((s) => s.status !== 'production_completed').length
  const completedTodayStories = stories.filter(
    (s) => s.status === 'production_completed' && isToday(s.created_at),
  ).length

  // News pool = all candidates not yet handed to a story.
  let newsPool = 0
  try {
    const db = createAdminClient()
    const { data } = await db.from('news_candidates').select('id')
    const total = (data as { id: string }[] | null) ?? []
    newsPool = total.filter((c) => !producedCandidateIds.has(c.id)).length
  } catch {
    newsPool = 0
  }

  // Last news sync + error count from the event log (best-effort).
  let lastNewsSyncAt: string | null = null
  let errorCount: number | null = null
  try {
    const db = createAdminClient()
    const { data: syncRows } = await db
      .from('factory_events')
      .select('created_at')
      .eq('event_type', 'research.completed')
      .order('created_at', { ascending: false })
      .limit(1)
    lastNewsSyncAt = (syncRows as { created_at: string }[] | null)?.[0]?.created_at ?? null

    const { data: errRows } = await db
      .from('factory_events')
      .select('event_type')
      .in('event_type', ['research.error', 'production_error'])
    errorCount = ((errRows as unknown[] | null) ?? []).length
  } catch {
    // Leave lastNewsSyncAt/errorCount at their safe defaults.
  }

  return { newsPool, storyActive, completedTodayStories, lastNewsSyncAt, errorCount }
}
