'use client'

import useSWR from 'swr'
import { AlertTriangle, Award, ExternalLink, RefreshCw } from 'lucide-react'
import { Card } from '@/components/primitives'
import { cn } from '@/lib/utils'

export interface GoldeselTopstory {
  id: string
  url: string
  title: string
  image: string | null
  teaser: string | null
  publishedAt: string | null
}

interface TopstoryPayload {
  topstories: GoldeselTopstory[]
  fetchedAt: string
}

const ENDPOINT = '/api/goldesel-topstory'

async function fetcher(url: string): Promise<TopstoryPayload> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch {
    throw new Error('Netzwerkfehler beim Laden der Topstories.')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok || !json) {
    throw new Error(json?.message ?? 'Topstories konnten nicht geladen werden.')
  }
  return json as TopstoryPayload
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})
const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Europe/Berlin',
})

function formatDate(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : dateFormatter.format(d)
}

export function GoldeselTopstoryList({
  initialData,
  initialError,
}: {
  initialData: TopstoryPayload | null
  initialError: string | null
}) {
  const { data, error, isValidating, mutate } = useSWR<TopstoryPayload, Error>(
    ENDPOINT,
    fetcher,
    {
      fallbackData: initialData ?? undefined,
      revalidateOnMount: !initialData,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
    },
  )

  const errorMessage = error?.message ?? (!data ? initialError : null)
  const topstories = data?.topstories ?? []
  const initialLoading = !data && !errorMessage

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium text-foreground">
              {data ? `${topstories.length} Topstories` : 'Topstories'}
            </span>
          </div>
          {data?.fetchedAt && (
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              {'Live von goldesel.de · abgerufen um '}
              {timeFormatter.format(new Date(data.fetchedAt))}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          aria-busy={isValidating}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', isValidating && 'animate-spin')} />
          {isValidating ? 'Wird aktualisiert…' : 'Topstories aktualisieren'}
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Topstories konnten nicht geladen werden.</p>
            <p className="text-destructive/90">
              {errorMessage}
              {data ? ' Angezeigt wird der zuletzt geladene Stand.' : ' Bitte später erneut versuchen.'}
            </p>
          </div>
        </div>
      )}

      {initialLoading ? (
        <TopstorySkeleton />
      ) : !data ? null : topstories.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Award className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-lg font-semibold">Aktuell keine Topstories</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              goldesel.de liefert derzeit keine als Topstory markierten Artikel. Versuche es später
              erneut.
            </p>
          </div>
        </Card>
      ) : (
        <ul
          className={cn(
            'grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-2 xl:grid-cols-3',
            isValidating && 'opacity-60',
          )}
        >
          {topstories.map((story) => {
            const date = formatDate(story.publishedAt)
            return (
              <li key={story.id}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                    {story.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.image || '/placeholder.svg'}
                        alt={story.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Award className="h-8 w-8" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    {date && (
                      <time
                        dateTime={story.publishedAt ?? undefined}
                        className="inline-flex w-fit items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground"
                      >
                        {date}
                      </time>
                    )}

                    <h3 className="mt-1.5 text-sm font-semibold leading-snug text-balance">
                      {story.title}
                    </h3>

                    {story.teaser && (
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {story.teaser}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-secondary/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Artikel öffnen
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">{`: ${story.title} (neuer Tab)`}</span>
                      </a>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function TopstorySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex flex-col overflow-hidden">
          <div className="aspect-[16/9] w-full animate-pulse bg-muted" />
          <div className="flex flex-col gap-2 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-9 w-full animate-pulse rounded bg-muted" />
          </div>
        </Card>
      ))}
      <span className="sr-only">Topstories werden geladen…</span>
    </div>
  )
}
