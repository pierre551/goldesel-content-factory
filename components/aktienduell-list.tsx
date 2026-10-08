'use client'

import { CardGridSkeleton } from '@/components/content-card'
import { ContentFeedList, type FeedItem, type ProductionStatus } from '@/components/content-feed-list'

export const AKTIENDUELL_TITLE = 'Aktienduell'
export const AKTIENDUELL_DESCRIPTION = 'Zwei Aktien im direkten Vergleich – die neuesten Aktienduelle von goldesel.de.'

export function AktienduellList({
  initialData,
  initialError,
  statuses,
}: {
  initialData: { duels: FeedItem[]; fetchedAt: string } | null
  initialError: string | null
  statuses: Record<string, ProductionStatus>
}) {
  return (
    <ContentFeedList
      format="aktienduell"
      endpoint="/api/aktienduell"
      itemsKey="duels"
      title={AKTIENDUELL_TITLE}
      description={AKTIENDUELL_DESCRIPTION}
      label="Aktienduell"
      refreshLabel="Aktienduelle aktualisieren"
      emptyText="Aktuell liefert goldesel.de keine Aktienduelle."
      initialData={initialData ? { items: initialData.duels, fetchedAt: initialData.fetchedAt } : null}
      initialError={initialError}
      statuses={statuses}
    />
  )
}

export function AktienduellSkeleton() {
  return <CardGridSkeleton label="Aktienduelle werden geladen…" />
}
