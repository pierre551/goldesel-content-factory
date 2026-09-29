'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  AlertTriangle,
  Check,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, ScoreBar, StatusBadge, Tag } from '@/components/primitives'
import { cn } from '@/lib/utils'

const MAX_SELECTION = 2

interface UiCandidate {
  id: string
  company: string
  ticker: string
  headline: string
  explanation: string
  source: string
  sourceUrls: string[]
  publishedAt: string
  relevanceScore: number
  viralScore: number
  selected: boolean
}

interface LatestResponse {
  run: { id: string; status: string; category: string } | null
  candidates: UiCandidate[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Laden fehlgeschlagen')
    return r.json() as Promise<LatestResponse>
  })

export function NewsWorkflow({
  category = 'aktien_news',
  accentLabel,
}: {
  category?: string
  accentLabel: string
}) {
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDiag, setErrorDiag] = useState<{
    upstreamStatus: number | null
    code: string
    snippet: string
  } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  // Candidates whose production just started. They leave the selectable pool
  // instantly (before the server refresh lands) and can never be re-toggled.
  const [justProduced, setJustProduced] = useState<string[]>([])

  const { data, isLoading, mutate } = useSWR<LatestResponse>(
    `/api/factory/research/latest?category=${encodeURIComponent(category)}`,
    fetcher,
    {
      // Poll while a run is actively researching so candidates appear as soon
      // as the Goldesel Manager callback lands.
      refreshInterval: (latest) =>
        latest?.run?.status === 'researching' ? 3000 : 0,
      revalidateOnFocus: true,
    },
  )

  const run = data?.run ?? null
  const status = run?.status ?? 'idle'
  // Hide candidates whose production just started, even before the server
  // refresh removes them from the pool. This is the single source of truth for
  // what is selectable/visible in the pool.
  const candidates = (data?.candidates ?? []).filter(
    (c) => !justProduced.includes(c.id),
  )
  const researching = status === 'researching' || starting
  const locked = submitting

  // Sync local selection from persisted DB state when the pool loads. Depend on
  // a stable primitive (the sorted selected ids) so this never loops on the
  // fresh array identity that `data?.candidates ?? []` produces each render.
  const serverSelectedKey = candidates
    .filter((c) => c.selected)
    .map((c) => c.id)
    .sort()
    .join(',')
  useEffect(() => {
    setSelected(serverSelectedKey ? serverSelectedKey.split(',') : [])
  }, [serverSelectedKey])

  async function startResearch() {
    setError(null)
    setErrorDiag(null)
    setStarting(true)
    setSelected([])
    setJustProduced([])
    try {
      const res = await fetch('/api/factory/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      const json = await res.json()
      if (json.status === 'error' || !res.ok) {
        setError(json.message ?? 'Die Recherche konnte nicht gestartet werden.')
        // Surface the non-secret upstream diagnostic when the API provides it.
        if (typeof json.code === 'string') {
          setErrorDiag({
            upstreamStatus:
              typeof json.upstreamStatus === 'number' ? json.upstreamStatus : null,
            code: json.code,
            snippet: typeof json.snippet === 'string' ? json.snippet : '',
          })
        }
      }
      await mutate()
    } catch {
      setError('Netzwerkfehler beim Starten der Recherche.')
    } finally {
      setStarting(false)
    }
  }

  async function toggle(id: string) {
    // Never allow (de)selecting a candidate whose production already started.
    if (!run || locked || justProduced.includes(id)) return
    const isSelected = selected.includes(id)
    if (!isSelected && selected.length >= MAX_SELECTION) return

    const next = isSelected
      ? selected.filter((x) => x !== id)
      : [...selected, id]
    setSelected(next) // optimistic

    try {
      const res = await fetch('/api/factory/research/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research_run_id: run.id,
          candidate_id: id,
          selected: !isSelected,
        }),
      })
      if (!res.ok) {
        setSelected(selected) // revert on failure
      }
    } catch {
      setSelected(selected)
    }
  }

  async function submitSelection() {
    if (!run || selected.length < 1 || selected.length > MAX_SELECTION) return
    setSubmitError(null)
    setSubmitting(true)
    const producedIds = [...selected]
    try {
      const res = await fetch('/api/factory/research/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ research_run_id: run.id }),
      })
      const json = await res.json()
      if (json.status === 'error' || !res.ok) {
        setSubmitError(json.message ?? 'Die Produktion konnte nicht gestartet werden.')
        await mutate()
      } else {
        // Success: the selected candidates now belong to an active production.
        // Drop them from the selectable pool instantly (optimistic), clear the
        // local selection, then revalidate BOTH the candidate pool and the
        // "Aktuelle Produktion" board so the new item appears without a manual
        // page refresh.
        setJustProduced((prev) => [...new Set([...prev, ...producedIds])])
        setSelected([])
        await Promise.all([
          mutate(),
          globalMutate('/api/factory/productions?scope=active'),
        ])
      }
    } catch {
      setSubmitError('Netzwerkfehler beim Starten der Produktion.')
      await mutate()
    } finally {
      setSubmitting(false)
    }
  }

  const canProduce = selected.length >= 1 && selected.length <= MAX_SELECTION

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {researching
              ? 'Goldesel Scout recherchiert…'
              : candidates.length > 0
                ? `${candidates.length} ${accentLabel}-Kandidaten im Pool — max. ${MAX_SELECTION} auswählen.`
                : `Starte eine neue KI-Recherche für ${accentLabel}-News.`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {canProduce && (
            <span className="text-sm font-medium">
              {selected.length} {selected.length === 1 ? 'Story' : 'Stories'} ausgewählt
            </span>
          )}
          {canProduce && (
            <Button size="lg" onClick={submitSelection} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Produktion wird gestartet…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Auswahl produzieren
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={startResearch}
            disabled={researching}
          >
            <RefreshCw className={cn('h-4 w-4', researching && 'animate-spin')} />
            {researching ? 'Goldesel Scout recherchiert…' : 'Neue News suchen'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 flex items-start gap-3 border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Recherche fehlgeschlagen</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            {errorDiag && (
              <dl className="mt-3 space-y-1 border-t border-destructive/20 pt-3 font-mono text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-foreground/70">Upstream HTTP</dt>
                  <dd className="text-foreground">{errorDiag.upstreamStatus ?? 'n/v'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-foreground/70">Code</dt>
                  <dd className="text-foreground">{errorDiag.code}</dd>
                </div>
                {errorDiag.snippet && (
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-foreground/70">Response</dt>
                    <dd className="min-w-0 break-words text-foreground">
                      {errorDiag.snippet}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </Card>
      )}

      {submitError && (
        <Card className="mb-6 flex items-start gap-3 border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Produktion fehlgeschlagen</p>
            <p className="mt-0.5 text-muted-foreground">{submitError}</p>
          </div>
        </Card>
      )}

      {researching ? (
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">Goldesel Scout recherchiert…</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              Der KI-Scout durchsucht aktuelle Marktdaten und liefert gleich die
              relevantesten {accentLabel}-News. Dies kann einen Moment dauern.
            </p>
          </div>
        </Card>
      ) : isLoading ? (
        <Card className="flex items-center justify-center px-6 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      ) : candidates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">Noch keine Kandidaten</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              Klicke auf „Neue News suchen“, um den Goldesel Scout eine frische
              Recherche starten zu lassen.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {candidates.map((news) => {
            const isSelected = selected.includes(news.id)
            const disabled =
              locked || (!isSelected && selected.length >= MAX_SELECTION)
            return (
              <Card
                key={news.id}
                className={cn(
                  'flex flex-col p-5 transition-colors',
                  isSelected && 'border-primary ring-1 ring-primary/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{news.company}</span>
                    <Tag>{news.ticker}</Tag>
                  </div>
                  <StatusBadge status={isSelected ? 'review' : 'idle'} />
                </div>

                <p className="mt-3 text-sm font-medium leading-snug text-balance">
                  {news.headline}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {news.explanation}
                </p>

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{news.source}</span>
                  </span>
                  {news.publishedAt && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {news.publishedAt}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <ScoreBar label="Relevanz" value={news.relevanceScore} />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Flame className="mt-0.5 h-4 w-4 text-success" />
                    <div className="flex-1">
                      <ScoreBar
                        label="Viral-Potenzial"
                        value={news.viralScore}
                        tone="success"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  variant={isSelected ? 'default' : 'outline'}
                  size="lg"
                  className="mt-5"
                  disabled={disabled}
                  onClick={() => toggle(news.id)}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4" />
                      Ausgewählt
                    </>
                  ) : (
                    'Story auswählen'
                  )}
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
