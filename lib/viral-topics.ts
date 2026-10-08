import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export const VIRAL_TOPIC_COUNT = 8
export const VIRAL_TOPICS_TABLE = 'viral_topic_rounds'
export const VIRAL_SETUP_SCRIPT = 'scripts/005_create_viral_topic_rounds.sql'

export interface ViralTopicSource {
  title: string
  url: string
}

export interface ViralTopic {
  id: string
  category: string
  headline: string
  summary: string
  sources: ViralTopicSource[]
}

export interface ViralRound {
  id: string
  topics: ViralTopic[]
  createdAt: string
}

export type ViralRoundResult =
  | { ok: true; round: ViralRound | null }
  | { ok: false; setupHint: string }

export function viralArticleId(topicId: string) {
  return `viral:${topicId}`
}

function tableMissing(message: string) {
  return /does not exist|schema cache|relation/i.test(message)
}

export async function getLatestViralRound(): Promise<ViralRoundResult> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from(VIRAL_TOPICS_TABLE)
      .select('id, topics, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      return {
        ok: false,
        setupHint: tableMissing(error.message)
          ? `Supabase-Tabelle „${VIRAL_TOPICS_TABLE}“ fehlt. Führe ${VIRAL_SETUP_SCRIPT} im Supabase SQL-Editor aus.`
          : `Themen konnten nicht geladen werden: ${error.message}`,
      }
    }
    if (!data) return { ok: true, round: null }
    return {
      ok: true,
      round: {
        id: data.id as string,
        topics: (data.topics as ViralTopic[]) ?? [],
        createdAt: data.created_at as string,
      },
    }
  } catch (err) {
    return {
      ok: false,
      setupHint: err instanceof Error ? err.message : 'Supabase nicht erreichbar.',
    }
  }
}

export async function saveViralRound(topics: ViralTopic[], model: string): Promise<ViralRound> {
  const db = createAdminClient()
  const { data, error } = await db
    .from(VIRAL_TOPICS_TABLE)
    .insert({ topics, model })
    .select('id, topics, created_at')
    .single()
  if (error) {
    throw new Error(
      tableMissing(error.message)
        ? `Supabase-Tabelle „${VIRAL_TOPICS_TABLE}“ fehlt. Führe ${VIRAL_SETUP_SCRIPT} im Supabase SQL-Editor aus.`
        : error.message,
    )
  }
  return {
    id: data.id as string,
    topics: data.topics as ViralTopic[],
    createdAt: data.created_at as string,
  }
}

const topicSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['topics'],
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'headline', 'summary', 'sources'],
        properties: {
          category: { type: 'string' },
          headline: { type: 'string' },
          summary: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'url'],
              properties: { title: { type: 'string' }, url: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

const PROMPT = `Recherchiere mit der Websuche aktuelle Themen (letzte 14 Tage), die Finanzen oder den Alltag von Menschen in Deutschland konkret beeinflussen: neue Gesetze, Gesetzesänderungen, politische Entscheidungen, Steuern, Rente, Energie, Mieten, Löhne, Sozialleistungen, Verbraucherrecht.

Liefere genau ${VIRAL_TOPIC_COUNT} unterschiedliche Themen. Pro Thema:
- category: kurze Kategorie (z. B. „Steuern“, „Rente“, „Energie“)
- headline: starke, kurze deutsche Headline (max. 70 Zeichen), faktisch korrekt, kein Clickbait ohne Substanz
- summary: 2–3 Sätze: Was ändert sich, ab wann, was bedeutet es für Menschen in Deutschland
- sources: 1–3 direkte Links zu den Artikeln/Quellen, die du tatsächlich in der Websuche gefunden hast

Erfinde keine Nachrichten, Zahlen oder URLs. Nutze nur Quellen aus deinen Suchergebnissen.`

export async function researchViralTopics(apiKey: string, model: string): Promise<ViralTopic[]> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'DE' } }],
      input: PROMPT,
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

  let parsed: { topics: Omit<ViralTopic, 'id'>[] }
  try {
    parsed = JSON.parse(outputText)
  } catch {
    throw new Error('Antwort der Recherche war kein gültiges JSON.')
  }

  const topics: ViralTopic[] = parsed.topics
    .map((t) => ({
      id: crypto.randomUUID(),
      category: t.category.trim(),
      headline: t.headline.trim(),
      summary: t.summary.trim(),
      sources: t.sources.filter(
        (s) =>
          /^https?:\/\//.test(s.url) && (cited.size === 0 || cited.has(normalizeUrl(s.url))),
      ),
    }))
    .filter((t) => t.headline && t.summary && t.sources.length > 0)

  if (topics.length < VIRAL_TOPIC_COUNT) {
    throw new Error(
      `Nur ${topics.length} von ${VIRAL_TOPIC_COUNT} Themen mit belegbaren Quellen gefunden. Bitte erneut versuchen.`,
    )
  }
  return topics.slice(0, VIRAL_TOPIC_COUNT)
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
