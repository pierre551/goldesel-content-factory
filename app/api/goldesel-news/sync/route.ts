import { NextResponse } from 'next/server'
import { syncArticlesFromSource } from '@/lib/goldesel-articles'

export const dynamic = 'force-dynamic'

/**
 * POST /api/goldesel-news/sync
 *
 * Manual "Aktualisieren" action (and the same route a scheduled job can hit):
 * re-reads the goldesel.de article API and updates the persisted pool. Returns
 * only the sanitized article fields — never the raw upstream payload.
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
    persisted: result.persisted,
    message: result.message ?? null,
    articles: result.articles.map((a) => ({
      id: a.id,
      url: a.url,
      title: a.title,
      image: a.image,
      publishedAt: a.publishedAt,
      isin: a.isin,
      teaser: a.teaser,
    })),
  })
}
