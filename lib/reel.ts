import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Data + storage layer for the Goldesel Reel workflow (production_type =
 * 'goldesel_reel'). Reels are stored in a dedicated table (see
 * scripts/002_create_goldesel_reel.sql) but surfaced through the SAME
 * production feed as stories and carousels, so they appear under "Aktuelle
 * Produktion" and "Verlauf" alongside everything else.
 *
 * All reads are defensive: if the table is missing (migration not applied) or
 * credentials are absent they degrade to empty/null instead of throwing,
 * mirroring lib/factory.ts and lib/carousel.ts.
 */

export const REEL_CONTENT_TYPE = 'goldesel_reel'

/** Private bucket that holds both the uploaded source and the rendered reel. */
export const REEL_BUCKET = 'factory-media'

/** Long enough for the whole external render to fetch the source video. */
const INPUT_URL_TTL = 60 * 60 * 24 * 7 // 7 days
/** Short-lived URL for in-app playback. */
const PLAYBACK_TTL = 60 * 60 // 1 hour

/**
 * Canonical reel status lifecycle (spec §12). Stored verbatim; this order is
 * only used to render progress. Incoming backend values are normalized to
 * these keys via REEL_STATUS_ALIASES before persisting.
 */
export const REEL_STEPS = [
  'queued',
  'video_ready',
  'designer_processing',
  'higgsfield_upload',
  'higgsfield_rendering',
  'qa',
  'completed',
] as const

/** Terminal states leave "Aktuelle Produktion" and live in "Verlauf". */
const TERMINAL = new Set(['completed', 'failed'])

/**
 * Map the various status spellings a backend might send to our canonical keys.
 * Anything unknown is passed through untouched so we never lose information.
 */
const REEL_STATUS_ALIASES: Record<string, string> = {
  queued: 'queued',
  pending: 'queued',
  video_ready: 'video_ready',
  input_ready: 'video_ready',
  designer_processing: 'designer_processing',
  designer: 'designer_processing',
  processing: 'designer_processing',
  higgsfield_upload: 'higgsfield_upload',
  upload: 'higgsfield_upload',
  uploading: 'higgsfield_upload',
  higgsfield_rendering: 'higgsfield_rendering',
  rendering: 'higgsfield_rendering',
  render: 'higgsfield_rendering',
  qa: 'qa',
  quality_check: 'qa',
  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  failed: 'failed',
  error: 'failed',
}

export function normalizeReelStatus(status?: string | null): string | undefined {
  if (!status) return undefined
  const key = String(status).trim().toLowerCase()
  return REEL_STATUS_ALIASES[key] ?? key
}

export function isReelTerminal(status: string): boolean {
  return TERMINAL.has(status)
}

export interface ReelProductionRow {
  production_run_id: string
  production_type: string
  original_filename: string
  title: string | null
  input_path: string | null
  output_path: string | null
  input_video_url: string | null
  output_video_url: string | null
  status: string
  error: string | null
  duration: number | null
  file_size: number | null
  created_at?: string
  updated_at?: string
}

/** UI shape — compatible with the production feed item, plus reel extras. */
export interface ReelUiItem {
  kind: 'reel'
  storyId: string
  candidateId: string
  company: string
  ticker: string
  headline: string
  status: string
  createdAt: string | null
  contentType: string
  /** Signed playback URL for the persisted output video (null until ready). */
  resultUrl: string | null
  /** Signed playback URL for the persisted source video (optional). */
  originalUrl: string | null
  originalFilename: string
  fileSize: number | null
  duration: number | null
  error: string | null
  generations: never[]
}

function nowIso() {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

/**
 * Ensure the private media bucket exists. The service-role client may create
 * buckets, so no manual storage migration is required. Generous size limit and
 * video-only MIME types keep realistic reel source videos working (spec §26).
 */
export async function ensureReelBucket(): Promise<void> {
  const db = createAdminClient()
  const { data } = await db.storage.getBucket(REEL_BUCKET)
  if (data) return
  const { error } = await db.storage.createBucket(REEL_BUCKET, {
    public: false,
    fileSizeLimit: 1024 * 1024 * 1024, // 1 GB
    allowedMimeTypes: ['video/mp4', 'video/quicktime'],
  })
  // Ignore "already exists" races; surface anything else.
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`Bucket konnte nicht erstellt werden: ${error.message}`)
  }
}

export function reelInputPath(productionRunId: string, filename: string): string {
  return `reel/${productionRunId}/input/${safeName(filename)}`
}

export function reelOutputPath(productionRunId: string, filename: string): string {
  return `reel/${productionRunId}/output/${reelOutputFilename(filename)}`
}

/** market-update.mov → market-update-goldesel-reel.mp4 (spec §17). */
export function reelOutputFilename(originalFilename: string): string {
  const base = safeName(originalFilename).replace(/\.[^.]+$/, '') || 'reel'
  return `${base}-goldesel-reel.mp4`
}

function safeName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'video'
  )
}

/** Mint a one-shot signed upload URL for a direct browser → Storage upload. */
export async function createReelUploadUrl(
  path: string,
): Promise<{ signedUrl: string; token: string; path: string }> {
  const db = createAdminClient()
  const { data, error } = await db.storage
    .from(REEL_BUCKET)
    .createSignedUploadUrl(path, { upsert: true })
  if (error || !data) {
    throw new Error(`Upload-URL konnte nicht erstellt werden: ${error?.message ?? 'unbekannt'}`)
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/** Signed read URL for a stored object, or null on any failure. */
export async function createReelSignedUrl(
  path: string | null | undefined,
  opts: { download?: string; expiresIn?: number } = {},
): Promise<string | null> {
  if (!path) return null
  try {
    const db = createAdminClient()
    const { data, error } = await db.storage
      .from(REEL_BUCKET)
      .createSignedUrl(path, opts.expiresIn ?? PLAYBACK_TTL, {
        download: opts.download,
      })
    if (error || !data) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/** Confirm an uploaded object actually exists before starting production. */
export async function reelObjectExists(path: string): Promise<boolean> {
  try {
    const db = createAdminClient()
    const slash = path.lastIndexOf('/')
    const dir = slash >= 0 ? path.slice(0, slash) : ''
    const name = slash >= 0 ? path.slice(slash + 1) : path
    const { data, error } = await db.storage.from(REEL_BUCKET).list(dir, {
      search: name,
      limit: 100,
    })
    if (error || !data) return false
    return data.some((o) => o.name === name)
  } catch {
    return false
  }
}

/**
 * Persist the final MP4 into the Factory's own bucket so it survives the
 * external render URL expiring (spec §15). Best-effort: on any failure the
 * caller keeps the external URL as a fallback. Returns the durable path.
 */
export async function persistFinalReel(
  productionRunId: string,
  externalUrl: string,
  originalFilename: string,
): Promise<string | null> {
  try {
    await ensureReelBucket()
    const res = await fetch(externalUrl)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    const path = reelOutputPath(productionRunId, originalFilename)
    const db = createAdminClient()
    const { error } = await db.storage.from(REEL_BUCKET).upload(path, buf, {
      contentType: 'video/mp4',
      upsert: true,
    })
    if (error) return null
    return path
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Table access
 * ------------------------------------------------------------------ */

/** Create the reel production row. Idempotent per production_run_id. */
export async function createReelProduction(input: {
  production_run_id: string
  original_filename: string
  title?: string | null
  input_path: string
  input_video_url?: string | null
  file_size?: number | null
  duration?: number | null
}): Promise<void> {
  const db = createAdminClient()
  const ts = nowIso()
  const { error } = await db.from('reel_productions').upsert(
    {
      production_run_id: input.production_run_id,
      production_type: REEL_CONTENT_TYPE,
      original_filename: input.original_filename,
      title: input.title ?? null,
      input_path: input.input_path,
      input_video_url: input.input_video_url ?? null,
      file_size: input.file_size ?? null,
      duration: input.duration ?? null,
      // Input is safely persisted at creation time → 'video_ready'.
      status: 'video_ready',
      error: null,
      updated_at: ts,
    },
    { onConflict: 'production_run_id' },
  )
  if (error) throw new Error(error.message)
}

export async function getReelRow(
  productionRunId: string,
): Promise<ReelProductionRow | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('reel_productions')
      .select('*')
      .eq('production_run_id', productionRunId)
      .limit(1)
    if (error || !data?.[0]) return null
    return data[0] as ReelProductionRow
  } catch {
    return null
  }
}

export async function setReelStatus(
  productionRunId: string,
  status: string,
  error?: string | null,
): Promise<void> {
  const db = createAdminClient()
  const patch: Record<string, unknown> = {
    status: normalizeReelStatus(status) ?? status,
    updated_at: nowIso(),
  }
  if (error !== undefined) patch.error = error
  const { error: err } = await db
    .from('reel_productions')
    .update(patch)
    .eq('production_run_id', productionRunId)
  if (err) throw new Error(err.message)
}

/**
 * Apply a completion/progress callback. When a completed status arrives with an
 * output video, the durable copy path + external URL are stored together.
 */
export async function applyReelCallback(input: {
  production_run_id: string
  status?: string | null
  error?: string | null
  output_video_url?: string | null
  output_path?: string | null
}): Promise<void> {
  const db = createAdminClient()
  const patch: Record<string, unknown> = { updated_at: nowIso() }
  const status = normalizeReelStatus(input.status)
  if (status) patch.status = status
  if (input.error != null) patch.error = String(input.error)
  if (input.output_video_url != null) patch.output_video_url = input.output_video_url
  if (input.output_path != null) patch.output_path = input.output_path
  const { error } = await db
    .from('reel_productions')
    .update(patch)
    .eq('production_run_id', input.production_run_id)
  if (error) throw new Error(error.message)
}

function toUiItem(row: ReelProductionRow, urls: {
  resultUrl: string | null
  originalUrl: string | null
}): ReelUiItem {
  return {
    kind: 'reel',
    storyId: row.production_run_id,
    candidateId: '',
    company: '',
    ticker: '',
    headline: row.title || row.original_filename,
    status: row.status,
    createdAt: row.created_at ?? null,
    contentType: 'Goldesel Reel',
    resultUrl: urls.resultUrl,
    originalUrl: urls.originalUrl,
    originalFilename: row.original_filename,
    fileSize: row.file_size,
    duration: row.duration,
    error: row.error,
    generations: [],
  }
}

/**
 * Reel items for the production feed.
 *   scope 'active'    → still running: status NOT IN (completed, failed)
 *   scope 'completed' → TERMINAL: status IN (completed, failed) — for Verlauf
 *
 * Playback URLs are freshly signed on read so they never rely on a stored URL
 * that may have expired.
 */
export async function getReelItems(
  scope: 'active' | 'completed',
): Promise<ReelUiItem[]> {
  try {
    const db = createAdminClient()
    const query = db
      .from('reel_productions')
      .select('*')
      .order('created_at', { ascending: false })
    const { data, error } =
      scope === 'completed'
        ? await query.in('status', ['completed', 'failed'])
        : await query.not('status', 'in', '(completed,failed)')
    if (error || !data || data.length === 0) return []

    const rows = data as ReelProductionRow[]
    return Promise.all(
      rows.map(async (row) => {
        const [resultUrl, originalUrl] = await Promise.all([
          createReelSignedUrl(row.output_path ?? null),
          createReelSignedUrl(row.input_path ?? null),
        ])
        // Fall back to the external render URL only if we have no durable copy.
        return toUiItem(row, {
          resultUrl: resultUrl ?? row.output_video_url ?? null,
          originalUrl,
        })
      }),
    )
  } catch (err) {
    console.log('[v0] reel feed error:', err instanceof Error ? err.message : err)
    return []
  }
}

/** Single reel with fresh signed URLs, for the generator page. */
export async function getReelUiItem(
  productionRunId: string,
): Promise<ReelUiItem | null> {
  const row = await getReelRow(productionRunId)
  if (!row) return null
  const [resultUrl, originalUrl] = await Promise.all([
    createReelSignedUrl(row.output_path ?? null),
    createReelSignedUrl(row.input_path ?? null),
  ])
  return toUiItem(row, {
    resultUrl: resultUrl ?? row.output_video_url ?? null,
    originalUrl,
  })
}

export interface ReelDashboardSummary {
  active: number
  completedToday: number
}

/** Reel KPIs for the dashboard. Defensive: missing table/credentials → zeros. */
export async function getReelDashboardSummary(): Promise<ReelDashboardSummary> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('reel_productions')
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
    const active = rows.filter((r) => !TERMINAL.has(r.status)).length
    const completedToday = rows.filter(
      (r) => r.status === 'completed' && sameDay(r.updated_at ?? r.created_at),
    ).length
    return { active, completedToday }
  } catch {
    return { active: 0, completedToday: 0 }
  }
}
