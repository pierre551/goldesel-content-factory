import { NextResponse } from 'next/server'
import { fetchGoldeselTopstories } from '@/lib/goldesel-topstories'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await fetchGoldeselTopstories()
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return NextResponse.json(
    { topstories: result.topstories, fetchedAt: result.fetchedAt },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
