import { NextResponse } from 'next/server'
import { getReelItems } from '@/lib/reel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/goldesel-reel/list
 *
 * Reel-only feed for the Reel Generator page: active productions plus recent
 * history, each with freshly signed playback URLs. Reload-safe — the DB is the
 * source of truth (spec §21). Internally defensive: degrades to empty lists.
 */
export async function GET() {
  try {
    const [active, completed] = await Promise.all([
      getReelItems('active'),
      getReelItems('completed'),
    ])
    return NextResponse.json({ active, completed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] reel list error:', message)
    return NextResponse.json({ active: [], completed: [], error: message })
  }
}
