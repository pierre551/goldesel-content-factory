import { NextResponse } from 'next/server'
import { getRun, setCandidateSelected } from '@/lib/factory'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const runId = body?.research_run_id
  const candidateId = body?.candidate_id
  const selected = body?.selected

  if (typeof runId !== 'string' || typeof candidateId !== 'string' || typeof selected !== 'boolean') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  try {
    const run = await getRun(runId)
    if (!run) {
      return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
    }

    const result = await setCandidateSelected(runId, candidateId, selected)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, selectedIds: result.selectedIds },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true, selectedIds: result.selectedIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] select error:', message)
    return NextResponse.json({ error: 'db_error', message }, { status: 500 })
  }
}
