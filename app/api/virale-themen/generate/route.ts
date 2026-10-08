import { NextResponse } from 'next/server'
import {
  VIRAL_TOPIC_COUNT,
  VIRAL_TOPIC_COUNTS,
  getLatestViralRound,
  researchViralTopics,
  saveViralRound,
} from '@/lib/viral-topics'
import { isViralPromptId } from '@/lib/viral-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const promptId = (body as { prompt_id?: unknown }).prompt_id
  const rawCount = Number((body as { count?: unknown }).count ?? VIRAL_TOPIC_COUNT)
  if (!VIRAL_TOPIC_COUNTS.includes(rawCount as (typeof VIRAL_TOPIC_COUNTS)[number])) {
    return NextResponse.json({ status: 'error', message: 'Anzahl muss 1, 2, 4 oder 8 sein.' }, { status: 400 })
  }
  const count = rawCount
  if (!isViralPromptId(promptId)) {
    return NextResponse.json(
      { status: 'error', message: 'Unbekannter Themenbereich.' },
      { status: 400 },
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        status: 'error',
        message:
          'OpenAI ist nicht angebunden. Lege OPENAI_API_KEY in den Projekt-Variablen (Settings → Vars) an.',
      },
      { status: 503 },
    )
  }

  // Check storage before spending a research call.
  const current = await getLatestViralRound(promptId)
  if (!current.ok) {
    return NextResponse.json({ status: 'error', message: current.setupHint }, { status: 503 })
  }

  const model = process.env.OPENAI_RESEARCH_MODEL || 'gpt-4.1'
  try {
    const topics = await researchViralTopics(apiKey, model, promptId, count)
    const round = await saveViralRound(topics, model)
    return NextResponse.json({ status: 'ok', round })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] viral topics generation failed:', promptId, message)
    return NextResponse.json({ status: 'error', message }, { status: 502 })
  }
}
