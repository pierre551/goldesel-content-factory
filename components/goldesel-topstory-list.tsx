'use client'

import { CardGridSkeleton } from '@/components/content-card'
import { ContentFeedList, type FeedItem, type ProductionStatus } from '@/components/content-feed-list'

export const TOPSTORY_TITLE = 'Goldesel Topstory'
export const TOPSTORY_DESCRIPTION = 'Die zehn neuesten redaktionellen Topstories von goldesel.de.'

export function GoldeselTopstoryList({
  initialData,
  initialError,
  statuses,
}: {
  initialData: { topstories: FeedItem[]; fetchedAt: string } | null
  initialError: string | null
  statuses: Record<string, ProductionStatus>
}) {
  return (
    <ContentFeedList
      format="topstory"
      endpoint="/api/goldesel-topstory"
      itemsKey="topstories"
      title={TOPSTORY_TITLE}
      description={TOPSTORY_DESCRIPTION}
      label="Topstory"
      refreshLabel="Topstories aktualisieren"
      emptyText="Aktuell liefert goldesel.de keine Topstories."
      initialData={initialData ? { items: initialData.topstories, fetchedAt: initialData.fetchedAt } : null}
      initialError={initialError}
      statuses={statuses}
    />
  )
}

export function TopstorySkeleton() {
  return <CardGridSkeleton label="Topstories werden geladen…" />
}
