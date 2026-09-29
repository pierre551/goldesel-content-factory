import { NextResponse } from 'next/server'
import { syncArticlesFromSource } from '@/lib/goldesel-articles'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-news/sync
 *
 * Manual "Artikel aktualisieren" action (and the same route a scheduled job can
 * hit): live-reads goldesel.de and replaces/updates the persisted article pool.
 * This is the ONLY way the pool changes — a plain page load never writes it.
 */
export async function POST() {
  const result = await syncArticlesFromSource()
  if (!result.ok) {
    return NextResponse.json(
      { status: 'error', message: result.message ?? 'Aktualisierung fehlgeschlagen.' },
      { status: 502 },
    )
  }
  return NextResponse.json({
    status: 'ok',
    count: result.count,
    inserted: result.inserted,
  })
}
