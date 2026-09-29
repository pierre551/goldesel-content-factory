'use client'

import useSWR from 'swr'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  PackageOpen,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { Card, StatusBadge, Tag } from '@/components/primitives'
import { cn } from '@/lib/utils'

const CAROUSEL_STATUS_LABELS: Record<string, string> = {
  // Canonical spec §12 stages.
  queued: 'In Warteschlange',
  article_reading: 'Artikel wird gelesen',
  content_package: 'Content Package wird erstellt',
  rendering: 'Slides werden gerendert',
  // GrokBot-reported statuses (kept for compatibility).
  processing: 'Wird verarbeitet',
  article_analyzed: 'Artikel analysiert',
  prompts_ready: '5 Slide-Prompts fertig',
  slide_1_complete: 'Slide 1 fertig',
  slide_2_complete: 'Slide 2 fertig',
  slide_3_complete: 'Slide 3 fertig',
  slide_4_complete: 'Slide 4 fertig',
  slide_5_complete: 'Slide 5 fertig',
  qa: 'Qualitätscheck',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
}

// Production lifecycle order for progress display. Statuses are received from
// the Goldesel Manager; this array only decides how far the progress fills.
const PRODUCTION_STEPS: { key: string; label: string }[] = [
  { key: 'production_started', label: 'Gestartet' },
  { key: 'content_started', label: 'Text' },
  { key: 'content_ready', label: 'Text fertig' },
  { key: 'quality_gate_passed', label: 'QA Text' },
  { key: 'prompt_ready', label: 'Prompt' },
  { key: 'image_generation_started', label: 'Bild' },
  { key: 'image_v1_created', label: 'Bild V1' },
  { key: 'image_v2_created', label: 'Bild V2' },
  { key: 'image_approved', label: 'Bild ok' },
  { key: 'canva_started', label: 'Canva' },
  { key: 'canva_ready', label: 'Canva fertig' },
  { key: 'final_qa_passed', label: 'Final QA' },
  { key: 'production_completed', label: 'Fertig' },
]

const STATUS_LABELS: Record<string, string> = {
  production_started: 'Produktion gestartet',
  content_started: 'Text wird erstellt',
  content_ready: 'Text fertig',
  quality_gate_passed: 'Qualitätscheck bestanden',
  prompt_ready: 'Bild-Prompt fertig',
  image_generation_started: 'Bildgenerierung läuft',
  image_v1_created: 'Bild V1 erstellt',
  image_v1_rejected: 'Bild V1 abgelehnt',
  image_v2_created: 'Bild V2 erstellt',
  image_approved: 'Bild freigegeben',
  canva_started: 'Canva-Layout läuft',
  canva_ready: 'Canva-Layout fertig',
  final_qa_passed: 'Finaler QA bestanden',
  production_completed: 'Produktion abgeschlossen',
  production_error: 'Produktionsfehler',
}

interface UiGeneration {
  id: string
  version: string | null
  imageUrl: string | null
  status: string | null
  qaScore: number | null
}

interface UiProductionItem {
  kind?: 'story' | 'carousel'
  /** For carousel-table items: 'story' = single 9:16 Story, 'carousel' = 5 slides. */
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
  generations: UiGeneration[]
}

interface ProductionsResponse {
  items: UiProductionItem[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ProductionsResponse>)

function stepIndexFor(status: string): number {
  const i = PRODUCTION_STEPS.findIndex((s) => s.key === status)
  if (i >= 0) return i
  if (status === 'image_v1_rejected') {
    return PRODUCTION_STEPS.findIndex((s) => s.key === 'image_v1_created')
  }
  return 0
}

function statusToBadge(status: string) {
  if (status === 'production_completed') return 'done' as const
  if (status === 'production_error') return 'rejected' as const
  if (status === 'image_approved' || status === 'final_qa_passed') return 'approved' as const
  return 'in_progress' as const
}

// Map a story production's real status to a short human-readable stage.
// Only statuses that actually occur are represented — no invented stages.
const STORY_STAGE: Record<string, string> = {
  production_started: 'Content',
  content_started: 'Content',
  content_ready: 'Content',
  quality_gate_passed: 'Content',
  prompt_ready: 'Prompt',
  image_generation_started: 'Visual',
  image_v1_created: 'Visual',
  image_v1_rejected: 'Visual',
  image_v2_created: 'Visual',
  image_approved: 'Visual QA',
  canva_started: 'Visual QA',
  canva_ready: 'Visual QA',
  final_qa_passed: 'Final QA',
  production_completed: 'Fertig',
  production_error: 'Fehler',
}

// Map a carousel production's real status to a short stage.
const CAROUSEL_STAGE: Record<string, string> = {
  queued: 'Warteschlange',
  article_reading: 'Artikel',
  content_package: 'Content',
  rendering: 'Slides',
  processing: 'Brief',
  article_analyzed: 'Prompts',
  prompts_ready: 'Prompts',
  slide_1_complete: 'Slides',
  slide_2_complete: 'Slides',
  slide_3_complete: 'Slides',
  slide_4_complete: 'Slides',
  slide_5_complete: 'Slides',
  qa: 'QA',
  completed: 'Fertig',
  failed: 'Fehler',
}

function stageFor(item: UiProductionItem): string {
  if (item.kind === 'carousel') return CAROUSEL_STAGE[item.status] ?? item.status
  return STORY_STAGE[item.status] ?? item.status
}

/**
 * Aggregate real active-production data into header counts. Active = anything
 * not completed and not errored/failed. Stage breakdown counts only stages
 * that actually appear in the data.
 */
function summarize(items: UiProductionItem[]) {
  const active = items.filter(
    (i) =>
      i.status !== 'production_completed' &&
      i.status !== 'production_error' &&
      i.status !== 'completed' &&
      i.status !== 'failed',
  )
  let story = 0
  let carousel = 0
  const stages = new Map<string, number>()
  for (const i of active) {
    // A carousel-table item with format 'story' is a Story, not a Carousel.
    if (i.kind === 'carousel' && i.format !== 'story') carousel += 1
    else story += 1
    const stage = stageFor(i)
    stages.set(stage, (stages.get(stage) ?? 0) + 1)
  }
  return { total: active.length, story, carousel, stages }
}

/** Compact, subtle status header — sibling of the Aktien-News pool header. */
function ProductionStatusBar({
  items,
  onRefresh,
  refreshing,
  error,
}: {
  items: UiProductionItem[]
  onRefresh: () => void
  refreshing: boolean
  error: boolean
}) {
  const { total, story, carousel, stages } = summarize(items)
  const typeParts: string[] = []
  if (story > 0) typeParts.push(`${story} Story`)
  if (carousel > 0) typeParts.push(`${carousel} Carousel`)
  const stageParts = [...stages.entries()].map(([label, n]) => `${n} ${label}`)

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium text-foreground">
            {total === 0
              ? 'Keine laufenden Produktionen'
              : `${total} ${total === 1 ? 'laufende Produktion' : 'laufende Produktionen'}`}
          </span>
          {typeParts.length > 0 && (
            <span className="text-muted-foreground">— {typeParts.join(' · ')}</span>
          )}
        </div>
        {stageParts.length > 0 && (
          <div className="mt-1 pl-6 font-mono text-xs text-muted-foreground/80">
            {stageParts.join(' · ')}
          </div>
        )}
        {error && (
          <div className="mt-1 flex items-center gap-1.5 pl-6 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Aktualisierung fehlgeschlagen — angezeigte Daten sind evtl. veraltet.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
      >
        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        Aktualisieren
      </button>
    </div>
  )
}

export function ProductionBoard() {
  const { data, isLoading, isValidating, error, mutate } = useSWR<ProductionsResponse>(
    '/api/factory/productions?scope=active',
    fetcher,
    {
      // Keep polling while anything is still in progress.
      refreshInterval: (latest) =>
        (latest?.items ?? []).some(
          (i) => i.status !== 'production_completed' && i.status !== 'production_error',
        )
          ? 3000
          : 0,
      revalidateOnFocus: true,
    },
  )

  const items = data?.items ?? []
  // Revalidate active productions, slide/image status and caption/status
  // callbacks — all served by this one endpoint. Never starts a production.
  const refresh = () => mutate()

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
        <ProductionStatusBar
          items={items}
          onRefresh={refresh}
          refreshing={isValidating}
          error={!!error}
        />
        <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <PackageOpen className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">Keine aktiven Produktionen</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              Sobald du unter „Aktien News“ eine Auswahl produzierst, erscheint
              der Fortschritt hier — Schritt für Schritt bis zum fertigen Post.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <ProductionStatusBar
        items={items}
        onRefresh={refresh}
        refreshing={isValidating}
        error={!!error}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((item) => {
          if (item.kind === 'carousel') {
            return <CarouselProductionCard key={item.storyId} item={item} />
          }
          const isError = item.status === 'production_error'
          const currentIndex = stepIndexFor(item.status)
          const isDone = item.status === 'production_completed'
          return (
            <Card key={item.storyId ?? item.candidateId} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{item.company}</span>
                  <Tag>{item.ticker}</Tag>
                </div>
                <StatusBadge status={statusToBadge(item.status)} />
              </div>

              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-brand-foreground" />
                {item.contentType}
              </div>

              <p className="mt-3 text-sm font-medium leading-snug text-balance">
                {item.headline}
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {STATUS_LABELS[item.status] ?? item.status}
              </p>

              {/* Progress steps — reflect only received statuses. */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {PRODUCTION_STEPS.map((step, i) => {
                  const reached = !isError && i <= currentIndex
                  const active = !isError && i === currentIndex && !isDone
                  return (
                    <span
                      key={step.key}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        reached
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                      title={step.label}
                    >
                      {active && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      {reached && !active && <Check className="h-2.5 w-2.5" />}
                      {step.label}
                    </span>
                  )
                })}
              </div>

              {isError && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <X className="h-4 w-4" />
                  Produktion fehlgeschlagen — der Goldesel Manager hat einen Fehler gemeldet.
                </div>
              )}

              {item.generations.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    Generierungen
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {item.generations.map((g) => (
                      <div key={g.id} className="w-28">
                        <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                          {g.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={g.imageUrl || '/placeholder.svg'}
                              alt={`${item.company} Generierung ${g.version ?? ''}`}
                              className="h-full w-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-muted-foreground">
                            {g.version ? `V${g.version.replace(/^v/i, '')}` : '—'}
                          </span>
                          {g.qaScore != null && (
                            <span className="font-mono font-medium tabular-nums">
                              {g.qaScore}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/** Goldesel Story productions: one vertical 9:16 image, clickable to detail. */
function StoryProductionCard({ item }: { item: UiProductionItem }) {
  const image = item.generations.find((g) => g.imageUrl)?.imageUrl ?? null
  const isFailed = item.status === 'failed'
  const isDone = item.status === 'completed'
  return (
    <Link href={`/aktive-produktionen/${item.storyId}`} className="group block">
      <Card className="flex h-full gap-4 p-5 transition-colors group-hover:border-primary/50">
        <div className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image || '/placeholder.svg'}
              alt="Story-Vorschau"
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              {isFailed ? (
                <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand-foreground" />
              {item.contentType}
            </div>
            <StatusBadge status={isDone ? 'done' : isFailed ? 'rejected' : 'in_progress'} />
          </div>

          <p className="mt-2 text-sm font-medium leading-snug text-balance">
            {item.headline}
          </p>

          <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs text-primary">
            {isFailed
              ? 'Produktion fehlgeschlagen'
              : isDone
                ? 'Story fertig — Detailansicht'
                : 'Story wird produziert …'}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </Link>
  )
}

/** Carousel productions render as a clickable card linking to the slide detail. */
function CarouselProductionCard({ item }: { item: UiProductionItem }) {
  if (item.format === 'story') return <StoryProductionCard item={item} />

  const slideCount = item.slideCount ?? 5
  const done = item.slidesDone ?? item.generations.filter((g) => g.imageUrl).length
  const isFailed = item.status === 'failed'
  const isDone = item.status === 'completed'
  const slots = Array.from({ length: slideCount }, (_, i) => {
    const idx = i + 1
    return item.generations.find((g) => g.version === String(idx)) ?? null
  })

  return (
    <Link href={`/aktive-produktionen/${item.storyId}`} className="group block">
      <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-primary/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-foreground" />
            {item.contentType}
          </div>
          <StatusBadge status={isDone ? 'done' : isFailed ? 'rejected' : 'in_progress'} />
        </div>

        <p className="mt-3 text-sm font-medium leading-snug text-balance">
          {item.headline}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {CAROUSEL_STATUS_LABELS[item.status] ?? item.status}
          </span>
          <span className="font-mono text-sm font-medium tabular-nums">
            {done} / {slideCount} Slides
          </span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / slideCount) * 100}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {slots.map((slot, i) => (
            <div
              key={i}
              className="relative aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted"
            >
              {slot?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slot.imageUrl || '/placeholder.svg'}
                  alt={`Slide ${i + 1}`}
                  className="h-full w-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  {isFailed ? (
                    <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {isFailed && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <X className="h-4 w-4" />
            Produktion fehlgeschlagen — GrokBot hat einen Fehler gemeldet.
          </div>
        )}

        <span className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
          Detailansicht öffnen
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  )
}
