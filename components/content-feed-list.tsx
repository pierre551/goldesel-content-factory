'use client'

import useSWR from 'swr'
import { PageHeader } from '@/components/primitives'
import {
  CardGridSkeleton,
  ContentCard,
  FeedError,
  ProduceActions,
  RefreshButton,
  postProduction,
} from '@/components/content-card'

export interface FeedItem {
  id: string
  url: string
  title: string
  image: string | null
  teaser: string | null
  publishedAt: string | null
}

export interface ProductionStatus {
  productionRunId: string
  status: string
}

type FeedFormat = 'aktienduell' | 'topstory'

interface FeedPayload {
  items: FeedItem[]
  fetchedAt: string
}

export function ContentFeedList({
  format,
  endpoint,
  itemsKey,
  title,
  description,
  label,
  refreshLabel,
  emptyText,
  initialData,
  initialError,
  statuses,
}: {
  format: FeedFormat
  endpoint: string
  itemsKey: string
  title: string
  description: string
  label: string
  refreshLabel: string
  emptyText: string
  initialData: FeedPayload | null
  initialError: string | null
  /** Beitrag production status keyed by item id. */
  statuses: Record<string, ProductionStatus>
}) {
  const { data, error, isValidating, mutate } = useSWR<FeedPayload, Error>(
    endpoint,
    async (url: string) => {
      let res: Response
      try {
        res = await fetch(url, { cache: 'no-store' })
      } catch {
        throw new Error('Netzwerkfehler beim Laden der Inhalte.')
      }
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) throw new Error(json?.message ?? 'Inhalte konnten nicht geladen werden.')
      return { items: json[itemsKey] ?? [], fetchedAt: json.fetchedAt }
    },
    {
      fallbackData: initialData ?? undefined,
      revalidateOnMount: !initialData,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  )

  const errorMessage = error?.message ?? (!data ? initialError : null)
  const items = data?.items ?? []

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<RefreshButton onClick={() => mutate()} busy={isValidating} label={refreshLabel} />}
      />
      <div className="flex flex-col gap-6 p-8">
        {errorMessage && (
          <FeedError
            title={data ? 'Aktualisierung fehlgeschlagen – zuletzt geladene Inhalte werden angezeigt.' : 'Inhalte konnten nicht geladen werden.'}
            message={errorMessage}
          />
        )}

        {!data && isValidating ? (
          <CardGridSkeleton label="Inhalte werden geladen…" />
        ) : data && items.length === 0 ? (
          <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const s = statuses[item.id]
              return (
                <li key={item.id}>
                  <ContentCard
                    label={label}
                    publishedAt={item.publishedAt}
                    title={item.title}
                    teaser={item.teaser}
                    image={item.image}
                    url={item.url}
                    actions={
                      <ProduceActions
                        initialBeitrag={s ? { status: s.status, productionRunId: s.productionRunId } : null}
                        start={(type) => postProduction('/api/content/produce', { format, item_id: item.id, type })}
                      />
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
