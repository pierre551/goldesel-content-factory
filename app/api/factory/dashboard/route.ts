import { NextResponse } from 'next/server'
import { getStoryDashboardSummary } from '@/lib/factory'
import { getCarouselDashboardSummary } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

/**
 * Real dashboard KPIs + factory status. Combines the story side (pool, active
 * story productions, completed-today, last sync, errors) with the carousel
 * side (active carousels, completed-today). All underlying reads are internally
 * defensive, so on missing tables/credentials this returns zeros/nulls — never
 * fabricated data — and the UI shows honest empty values.
 */
export async function GET() {
  const [story, carousel] = await Promise.all([
    getStoryDashboardSummary().catch(() => null),
    getCarouselDashboardSummary().catch(() => null),
  ])

  const s = story ?? {
    newsPool: 0,
    storyActive: 0,
    completedTodayStories: 0,
    lastNewsSyncAt: null,
    errorCount: null,
  }
  const c = carousel ?? { active: 0, completedToday: 0 }

  return NextResponse.json({
    kpis: {
      newsPool: s.newsPool,
      storyActive: s.storyActive,
      carouselActive: c.active,
      completedToday: s.completedTodayStories + c.completedToday,
    },
    factoryStatus: {
      lastNewsSyncAt: s.lastNewsSyncAt,
      errorCount: s.errorCount,
    },
  })
}
