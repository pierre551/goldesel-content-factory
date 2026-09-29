import { NextResponse } from 'next/server'
import {
  AKTIEN_CATEGORY,
  getLatestRun,
  getPoolCandidates,
  getRun,
  toUiCandidate,
} from '@/lib/factory'

export const dynamic = 'force-dynamic'

/**
 * Feeds the Aktien-News research view. Returns only the *pool* candidates —
 * those that have NOT yet been handed to production — so produced stories
 * disappear from the pool while the remaining candidates stay selectable.
 * Production progress is served separately by /api/factory/productions.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? AKTIEN_CATEGORY
  const runIdParam = searchParams.get('research_run_id')

  try {
    const run = runIdParam ? await getRun(runIdParam) : await getLatestRun(category)
    if (!run) {
      return NextResponse.json({ run: null, candidates: [] })
    }

    // While a run is still researching there are no candidates to show yet.
    const candidates =
      run.status === 'researching' ? [] : await getPoolCandidates(run.id)

    return NextResponse.json({
      run: { id: run.id, status: run.status, category: run.category },
      candidates: candidates.map(toUiCandidate),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] latest run error:', message)
    return NextResponse.json({ error: 'db_error', message }, { status: 500 })
  }
}
