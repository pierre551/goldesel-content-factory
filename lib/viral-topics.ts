import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { VIRAL_PROMPT_IDS, type ViralPromptId } from '@/lib/viral-prompts'
import { buildViralPrompt } from '@/lib/viral-prompt-texts'

export const VIRAL_TOPIC_COUNT = 4
export const VIRAL_TOPIC_COUNTS = [1, 2, 4, 8] as const
export const VIRAL_TOPICS_TABLE = 'viral_topic_rounds'
export const VIRAL_SETUP_SCRIPT = 'scripts/005_create_viral_topic_rounds.sql'

export interface ViralTopicSource {
  title: string
  url: string
  publishedAt?: string | null
  note?: string | null
}

export interface ViralReelDraft {
  hookOverlay: string
  mainStatement: string
  facts: string[]
  conclusion: string
}

export interface ViralSlide {
  title: string
  text: string
}

export interface ViralTopic {
  id: string
  promptId?: ViralPromptId
  category: string
  headline: string
  hook?: string
  summary: string
  keyFacts?: string[]
  shareReason?: string
  reel?: ViralReelDraft
  slides?: ViralSlide[]
  imageIdea?: string
  sources: ViralTopicSource[]
  // Stored on the first topic of a round; the table has no metadata column.
  roundShortfall?: string | null
}

export interface ViralRound {
  id: string
  promptId: ViralPromptId | null
  topics: ViralTopic[]
  shortfallReason: string | null
  createdAt: string
}

export type ViralRoundResult =
  | { ok: true; round: ViralRound | null }
  | { ok: false; setupHint: string }

export type ViralRoundsResult =
  | { ok: true; rounds: Record<ViralPromptId, ViralRound | null> }
  | { ok: false; setupHint: string }

export function viralArticleId(topicId: string) {
  return `viral:${topicId}`
}

function tableMissing(message: string) {
  return /does not exist|schema cache|relation/i.test(message)
}

function storageHint(message: string) {
  return tableMissing(message)
    ? `Supabase-Tabelle „${VIRAL_TOPICS_TABLE}“ fehlt. Führe ${VIRAL_SETUP_SCRIPT} im Supabase SQL-Editor aus.`
    : `Themen konnten nicht geladen werden: ${message}`
}

function toRound(row: { id: unknown; topics: unknown; created_at: unknown }): ViralRound {
  const topics = (row.topics as ViralTopic[]) ?? []
  return {
    id: row.id as string,
    promptId: topics[0]?.promptId ?? null,
    topics,
    shortfallReason: topics[0]?.roundShortfall ?? null,
    createdAt: row.created_at as string,
  }
}

export async function getLatestViralRound(promptId: ViralPromptId): Promise<ViralRoundResult> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from(VIRAL_TOPICS_TABLE)
      .select('id, topics, created_at')
      .eq('topics->0->>promptId', promptId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, setupHint: storageHint(error.message) }
    return { ok: true, round: data ? toRound(data) : null }
  } catch (err) {
    return { ok: false, setupHint: err instanceof Error ? err.message : 'Supabase nicht erreichbar.' }
  }
}

export async function getLatestViralRounds(): Promise<ViralRoundsResult> {
  const results = await Promise.all(VIRAL_PROMPT_IDS.map((id) => getLatestViralRound(id)))
  const failed = results.find((r) => !r.ok)
  if (failed && !failed.ok) return { ok: false, setupHint: failed.setupHint }
  return {
    ok: true,
    rounds: Object.fromEntries(
      VIRAL_PROMPT_IDS.map((id, i) => [id, (results[i] as { ok: true; round: ViralRound | null }).round]),
    ) as Record<ViralPromptId, ViralRound | null>,
  }
}

export async function findViralTopic(topicId: string): Promise<ViralTopic | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from(VIRAL_TOPICS_TABLE)
    .select('topics')
    .contains('topics', JSON.stringify([{ id: topicId }]))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(storageHint(error.message))
  return ((data?.topics as ViralTopic[] | undefined) ?? []).find((t) => t.id === topicId) ?? null
}

export async function saveViralRound(topics: ViralTopic[], model: string): Promise<ViralRound> {
  const db = createAdminClient()
  const { data, error } = await db
    .from(VIRAL_TOPICS_TABLE)
    .insert({ topics, model })
    .select('id, topics, created_at')
    .single()
  if (error) throw new Error(storageHint(error.message))
  return toRound(data)
}

const str = { type: 'string' }
const nullableStr = { type: ['string', 'null'] }
const strArr = { type: 'array', items: str }

const topicSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['topics', 'shortfallReason'],
  properties: {
    shortfallReason: nullableStr,
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'category',
          'headline',
          'hook',
          'summary',
          'keyFacts',
          'shareReason',
          'reel',
          'slides',
          'imageIdea',
          'sources',
        ],
        properties: {
          category: str,
          headline: str,
          hook: str,
          summary: str,
          keyFacts: strArr,
          shareReason: str,
          reel: {
            type: 'object',
            additionalProperties: false,
            required: ['hookOverlay', 'mainStatement', 'facts', 'conclusion'],
            properties: { hookOverlay: str, mainStatement: str, facts: strArr, conclusion: str },
          },
          slides: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'text'],
              properties: { title: str, text: str },
            },
          },
          imageIdea: str,
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'url', 'publishedAt', 'note'],
              properties: { title: str, url: str, publishedAt: nullableStr, note: nullableStr },
            },
          },
        },
      },
    },
  },
}

type RawTopic = Omit<ViralTopic, 'id' | 'promptId' | 'roundShortfall'> & {
  keyFacts: string[]
  reel: ViralReelDraft
  slides: ViralSlide[]
}

const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '')
const cleanList = (list: unknown, max: number) =>
  (Array.isArray(list) ? list : []).map(clean).filter(Boolean).slice(0, max)

export async function researchViralTopics(
  apiKey: string,
  model: string,
  promptId: ViralPromptId,
  count: number = VIRAL_TOPIC_COUNT,
): Promise<ViralTopic[]> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'DE' } }],
      input: buildViralPrompt(promptId, count),
      text: { format: { type: 'json_schema', name: 'viral_topics', strict: true, schema: topicSchema } },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI-Anfrage fehlgeschlagen (HTTP ${res.status}). ${text.slice(0, 200)}`)
  }
  const data = await res.json()

  let outputText = ''
  const cited = new Set<string>()
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type !== 'output_text') continue
      outputText += part.text
      for (const a of part.annotations ?? []) {
        if (a.type === 'url_citation' && a.url) cited.add(normalizeUrl(a.url))
      }
    }
  }
  const usedSearch = (data.output ?? []).some((i: { type: string }) => i.type === 'web_search_call')
  if (!usedSearch) throw new Error('Die Recherche hat keine Websuche ausgeführt – Ergebnis verworfen.')

  let parsed: { topics: RawTopic[]; shortfallReason: string | null }
  try {
    parsed = JSON.parse(outputText)
  } catch {
    throw new Error('Antwort der Recherche war kein gültiges JSON.')
  }

  const topics: ViralTopic[] = (parsed.topics ?? [])
    .map((t) => ({
      id: crypto.randomUUID(),
      promptId,
      category: clean(t.category),
      headline: clean(t.headline),
      hook: clean(t.hook),
      summary: clean(t.summary),
      keyFacts: cleanList(t.keyFacts, 3),
      shareReason: clean(t.shareReason),
      reel: {
        hookOverlay: clean(t.reel?.hookOverlay),
        mainStatement: clean(t.reel?.mainStatement),
        facts: cleanList(t.reel?.facts, 3),
        conclusion: clean(t.reel?.conclusion),
      },
      slides: (t.slides ?? [])
        .map((s) => ({ title: clean(s.title), text: clean(s.text) }))
        .filter((s) => s.text)
        .slice(0, 4),
      imageIdea: clean(t.imageIdea),
      sources: (t.sources ?? [])
        .filter((s) => /^https?:\/\//.test(s.url) && (cited.size === 0 || cited.has(normalizeUrl(s.url))))
        .map((s) => ({
          title: clean(s.title),
          url: s.url.trim(),
          publishedAt: clean(s.publishedAt) || null,
          note: clean(s.note) || null,
        })),
    }))
    .filter((t) => t.headline && t.summary && t.slides.length === 4 && t.sources.length > 0)
    .slice(0, count)

  const reason = clean(parsed.shortfallReason)
  if (topics.length === 0) {
    throw new Error(
      reason
        ? `Keine belastbaren Themen gefunden: ${reason}`
        : 'Keine Themen mit belegbaren Quellen gefunden. Bitte erneut versuchen.',
    )
  }
  if (topics.length < count) {
    topics[0].roundShortfall =
      reason || `Nur ${topics.length} von ${count} Themen mit belegbaren Quellen und vollständigem Entwurf.`
  }
  return topics
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url)
    u.hash = ''
    u.searchParams.delete('utm_source')
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}
