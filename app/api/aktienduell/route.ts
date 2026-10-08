import { NextResponse } from 'next/server'
import { fetchGoldeselAktienduelle } from '@/lib/goldesel-aktienduelle'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await fetchGoldeselAktienduelle()
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return NextResponse.json(
    { duels: result.duels, fetchedAt: result.fetchedAt },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
