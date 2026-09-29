import { NextResponse } from 'next/server'
import { getCarousel } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/** GET /api/goldesel-carousel/:id — single production + its slides (for the detail view). */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    const data = await getCarousel(id)
    if (!data) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.log('[v0] carousel detail error:', message)
    return NextResponse.json({ ok: false, error: 'db_error', message }, { status: 500 })
  }
}
