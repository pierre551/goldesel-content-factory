'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowRight, Check, Clock, ExternalLink, History, Loader2 } from 'lucide-react'
import { Card, StatusBadge, Tag } from '@/components/primitives'

interface UiGeneration {
  id: string
  version: string | null
  imageUrl: string | null
  status: string | null
  qaScore: number | null
}

interface UiProductionItem {
  kind?: 'story' | 'carousel'
  format?: 'story' | 'carousel'
  storyId: string | null
  candidateId: string
  company: string
  ticker: string
  headline: string
  status: string
  createdAt: string | null
  contentType: string
  resultUrl: string | null
  slideCount?: number
  slidesDone?: number
  instagramCaption?: string | null
  generations: UiGeneration[]
}

interface ProductionsResponse {
  items: UiProductionItem[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ProductionsResponse>)

const dayFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
})

function dayKey(iso: string | null): string {
  if (!iso) return 'unbekannt'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unbekannt'
  return d.toISOString().slice(0, 10)
}

function dayLabel(key: string): string {
  if (key === 'unbekannt') return 'Ohne Datum'
  const d = new Date(`${key}T00:00:00`)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (key === today.toISOString().slice(0, 10)) return 'Heute'
  if (key === yesterday.toISOString().slice(0, 10)) return 'Gestern'
  return dayFormatter.format(d)
}

/** Pick the most representative image (approved wins, else last). */
function previewImage(item: UiProductionItem): string | null {
  const approved = item.generations.find((g) => g.status === 'image_approved')
  const withImage = [...item.generations].reverse().find((g) => g.imageUrl)
  return approved?.imageUrl ?? withImage?.imageUrl ?? null
}

export function HistoryTimeline() {
  const { data, isLoading } = useSWR<ProductionsResponse>(
    '/api/factory/productions?scope=completed',
    fetcher,
    { revalidateOnFocus: true },
  )

  const items = data?.items ?? []

  if (isLoading) {
    return (
      <div className="p-8">
        <Card className="flex items-center justify-center px-6 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-8">
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand/15 text-brand-foreground">
            <History className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">Noch kein Verlauf</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              Fertig produzierte Inhalte erscheinen hier als chronologische
              Timeline — nach Tagen gruppiert, neueste zuerst.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  // Group by day, newest day first (items already arrive newest-first).
  const groups = new Map<string, UiProductionItem[]>()
  for (const item of items) {
    const key = dayKey(item.createdAt)
    const arr = groups.get(key) ?? []
    arr.push(item)
    groups.set(key, arr)
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="p-8">
      <div className="flex flex-col gap-10">
        {orderedKeys.map((key) => (
          <section key={key}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {dayLabel(key)}
              </h2>
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-xs text-muted-foreground">
                {groups.get(key)!.length}
              </span>
            </div>

            <div className="relative flex flex-col gap-4 border-l border-border pl-6">
              {groups.get(key)!.map((item) => {
                const preview = previewImage(item)
                const time = item.createdAt
                  ? timeFormatter.format(new Date(item.createdAt))
                  : '—'
                if (item.kind === 'carousel') {
                  return (
                    <CarouselHistoryCard key={item.storyId} item={item} time={time} preview={preview} />
                  )
                }
                return (
                  <div key={item.storyId ?? item.candidateId} className="relative">
                    <span className="absolute -left-[27px] top-5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                    <Card className="flex items-start gap-4 p-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preview || '/placeholder.svg'}
                            alt={`Vorschau ${item.company}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            Kein Bild
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{item.company}</span>
                          <Tag>{item.ticker}</Tag>
                          <span className="rounded-full bg-brand/15 px-2 py-px text-[10px] font-medium text-brand-foreground">
                            {item.contentType}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {item.headline}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {time}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusBadge status="done" />
                        {item.resultUrl && (
                          <a
                            href={item.resultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Ergebnis
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </Card>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Completed carousel entry: preview thumbnail strip + link to the full detail view. */
function CarouselHistoryCard({
  item,
  time,
  preview,
}: {
  item: UiProductionItem
  time: string
  preview: string | null
}) {
  const slideCount = item.slideCount ?? 5
  const isStory = item.format === 'story'
  return (
    <div className="relative">
      <span className="absolute -left-[27px] top-5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
      <Link href={`/aktive-produktionen/${item.storyId}`} className="group block">
        <Card className="flex items-start gap-4 p-4 transition-colors group-hover:border-primary/50">
          <div className="h-16 w-[52px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview || '/placeholder.svg'}
                alt={`Vorschau ${item.headline}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                Kein Bild
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand/15 px-2 py-px text-[10px] font-medium text-brand-foreground">
                {item.contentType}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {isStory ? 'Story · 9:16' : `${slideCount} Slides`}
              </span>
              {item.instagramCaption?.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-px text-[10px] font-medium text-primary">
                  <Check className="h-3 w-3" />
                  Caption fertig
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-medium">{item.headline}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {time}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status="done" />
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              Ansehen
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Card>
      </Link>
    </div>
  )
}
