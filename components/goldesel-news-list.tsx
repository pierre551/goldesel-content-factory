'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, StatusBadge } from '@/components/primitives'
import { cn } from '@/lib/utils'

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

type GenState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; productionRunId: string }
  | { phase: 'error'; message: string }

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
})
const clockFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * German editorial format, e.g. "07. Sep. · 14:32". Shows the time only when
 * the source timestamp actually carries one, and returns null for missing or
 * unparseable values so the badge is hidden rather than leaking a raw
 * identifier into the UI.
 */
function formatDate(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const hasTime = /\d{1,2}:\d{2}/.test(raw) || /T\d{2}/.test(raw)
  return hasTime
    ? `${dateFormatter.format(d)} · ${clockFormatter.format(d)}`
    : dateFormatter.format(d)
}

const TERMINAL_DONE = 'completed'
const TERMINAL_FAILED = 'failed'

/** Anything that is neither completed nor failed is still an active production. */
function isRunning(status: string | undefined): boolean {
  return !!status && status !== TERMINAL_DONE && status !== TERMINAL_FAILED
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
  const [states, setStates] = useState<Record<string, GenState>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)

  function stateFor(id: string): GenState {
    return states[id] ?? { phase: 'idle' }
  }

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

  async function generate(article: GoldeselArticle) {
    const current = stateFor(article.id)
    if (current.phase === 'loading' || current.phase === 'success') return
    // Prevent a duplicate carousel while one is already running for this article.
    if (isRunning(carouselStatus[article.id]?.status)) return

    setStates((s) => ({ ...s, [article.id]: { phase: 'loading' } }))
    try {
      const res = await fetch('/api/goldesel-carousel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          article_url: article.url,
          title: article.title,
          published_at: article.publishedAt,
          source: 'goldesel_news',
        }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'error') {
        setStates((s) => ({
          ...s,
          [article.id]: {
            phase: 'error',
            message: json.message ?? 'Produktion konnte nicht gestartet werden.',
          },
        }))
        return
      }
      setStates((s) => ({
        ...s,
        [article.id]: { phase: 'success', productionRunId: json.production_run_id },
      }))
    } catch {
      setStates((s) => ({
        ...s,
        [article.id]: {
          phase: 'error',
          message: 'Netzwerkfehler bei der Übergabe an die Produktion.',
        },
      }))
    }
  }

  return (
    <div className="p-8">
      {/* Pool header: real persisted count (left) · manual refresh (right). */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium text-foreground">
              {articles.length} Goldesel Artikel
            </span>
          </div>
          {!isPersisted && (
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              {refreshNote ??
                'Noch nicht im Pool gespeichert — klicke „Aktualisieren“, damit die Liste beim Neuladen erhalten bleibt.'}
            </p>
          )}
          {refreshError && (
            <p className="mt-1 flex items-center gap-1.5 pl-6 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {refreshError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={refreshArticles}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {articles.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Newspaper className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">Keine Artikel im Pool</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              Klicke „Aktualisieren“, um die neuesten Goldesel-Artikel zu laden.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => {
            const state = stateFor(article.id)
            const date = formatDate(article.publishedAt)
            const existing = carouselStatus[article.id]
            const running =
              state.phase === 'loading' ||
              state.phase === 'success' ||
              isRunning(existing?.status)
            const done = existing?.status === TERMINAL_DONE
            const productionRunId =
              state.phase === 'success'
                ? state.productionRunId
                : existing?.productionRunId

            return (
              <Card key={article.id} className="flex flex-col overflow-hidden">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  {article.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.image || '/placeholder.svg'}
                      alt={article.title}
                      className="h-full w-full object-cover"
                      crossOrigin="anonymous"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Newspaper className="h-8 w-8" strokeWidth={1.5} />
                    </div>
                  )}
                  {(running || done) && (
                    <div className="absolute right-2 top-2">
                      <StatusBadge status={done ? 'done' : 'in_progress'} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  {date && (
                    <span className="inline-flex w-fit items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
                      {date}
                    </span>
                  )}

                  <h3 className="mt-1.5 text-sm font-semibold leading-snug text-balance">
                    {article.title}
                  </h3>

                  {article.teaser && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {article.teaser}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    {done ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                          <Check className="h-4 w-4" />
                          Carousel fertig
                        </div>
                        {productionRunId && (
                          <Link
                            href={`/aktive-produktionen/${productionRunId}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Zur Produktion
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    ) : running ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          In Produktion
                        </div>
                        {productionRunId && (
                          <Link
                            href={`/aktive-produktionen/${productionRunId}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Zur Produktion
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Button className="w-full" onClick={() => generate(article)}>
                          <Sparkles className="h-4 w-4" />
                          Carousel generieren
                        </Button>

                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-secondary/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                          Artikel öffnen
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        {state.phase === 'error' && (
                          <p className="flex items-start gap-1.5 text-xs text-destructive">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {state.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
