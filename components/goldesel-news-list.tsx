'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/primitives'
import { ContentCard, FeedError, ProduceActions, RefreshButton, postProduction } from '@/components/content-card'

export interface GoldeselArticle {
  id: string
  url: string
  title: string
  image: string | null
  publishedAt: string | null
  isin: string | null
  teaser: string | null
}

export interface CarouselStatus {
  productionRunId: string
  status: string
}

export function GoldeselNewsList({
  initialArticles,
  carouselStatus,
  persisted,
}: {
  initialArticles: GoldeselArticle[]
  carouselStatus: Record<string, CarouselStatus>
  persisted: boolean
}) {
  const [articles, setArticles] = useState<GoldeselArticle[]>(initialArticles)
  const [isPersisted, setIsPersisted] = useState(persisted)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)

  async function refreshArticles() {
    if (refreshing) return
    setRefreshing(true)
    setRefreshError(null)
    setRefreshNote(null)
    try {
      const res = await fetch('/api/goldesel-news/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.status === 'error') {
        setRefreshError(json.message ?? 'Aktualisierung fehlgeschlagen.')
        return
      }
      if (json.persisted) {
        // Reload so production statuses for the fresh pool are read server-side.
        window.location.reload()
        return
      }
      setArticles(json.articles ?? [])
      setIsPersisted(false)
      setRefreshNote(json.message ?? null)
    } catch {
      setRefreshError('Netzwerkfehler bei der Aktualisierung.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Goldesel Artikel"
        description="Veröffentlichte Artikel von goldesel.de."
        actions={<RefreshButton onClick={refreshArticles} busy={refreshing} />}
      />
      <div className="flex flex-col gap-6 p-8">
        {refreshError && <FeedError title="Aktualisierung fehlgeschlagen." message={refreshError} />}
        {!isPersisted && articles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {refreshNote ?? 'Liste live geladen, noch nicht im Artikel-Pool gespeichert.'}
          </p>
        )}

        {articles.length === 0 ? (
          <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
            Keine Artikel verfügbar. Klicke „Aktualisieren“, um die neuesten Goldesel-Artikel zu laden.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => {
              const s = carouselStatus[article.id]
              return (
                <li key={article.id}>
                  <ContentCard
                    label="Artikel"
                    publishedAt={article.publishedAt}
                    title={article.title}
                    teaser={article.teaser}
                    image={article.image}
                    url={article.url}
                    actions={
                      <ProduceActions
                        initialBeitrag={s ? { status: s.status, productionRunId: s.productionRunId } : null}
                        start={(type) =>
                          postProduction('/api/content/produce', { format: 'artikel', item_id: article.id, type })
                        }
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
