import { NextResponse } from 'next/server'
import { fetchGoldeselNews } from '@/lib/goldesel-news'

export const dynamic = 'force-dynamic'

/**
 * GET /api/goldesel-news — parsed list of published Goldesel News articles.
 * No scoring/enrichment: the carousel flow does not depend on any scores.
 */
export async function GET() {
  const articles = await fetchGoldeselNews()
  return NextResponse.json({ articles })
}
