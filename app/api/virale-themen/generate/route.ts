import { NextResponse } from 'next/server'
import { getLatestViralRound, researchViralTopics, saveViralRound } from '@/lib/viral-topics'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
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
  const current = await getLatestViralRound()
  if (!current.ok) {
    return NextResponse.json({ status: 'error', message: current.setupHint }, { status: 503 })
  }

  const model = process.env.OPENAI_RESEARCH_MODEL || 'gpt-4.1'
  try {
    const topics = await researchViralTopics(apiKey, model)
    const round = await saveViralRound(topics, model)
    return NextResponse.json({ status: 'ok', round })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] viral topics generation failed:', message)
    return NextResponse.json({ status: 'error', message }, { status: 502 })
  }
}
