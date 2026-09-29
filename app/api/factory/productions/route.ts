import { NextResponse } from 'next/server'
import { getProductions, type ProductionScope } from '@/lib/factory'
import { getCarouselItems } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/**
 * Global production feed for the "Aktive Produktionen" board (scope=active)
 * and the "Verlauf" timeline (scope=completed). Merges story productions and
 * Goldesel carousel productions into one newest-first list. Errors (e.g.
 * missing DB credentials in preview) degrade to an empty list so the UI
 * stays clean.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope: ProductionScope =
    searchParams.get('scope') === 'completed' ? 'completed' : 'active'

  try {
    // getCarouselItems is internally defensive (returns [] on any error).
    const [stories, carousels] = await Promise.all([
      getProductions(scope),
      getCarouselItems(scope),
    ])
    const items = [...stories, ...carousels].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
    )
    return NextResponse.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] productions feed error:', message)
    return NextResponse.json({ items: [], error: 'db_error', message })
  }
}
