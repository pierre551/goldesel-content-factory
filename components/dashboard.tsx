'use client'

import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSearch,
  Image as ImageIcon,
  Layers,
  Loader2,
} from 'lucide-react'
import { Card, StatusBadge } from '@/components/primitives'
import { cn } from '@/lib/utils'

interface UiGeneration {
  id: string
  version: string | null
  imageUrl: string | null
  status: string | null
  qaScore: number | null
}

interface UiProductionItem {
  kind?: 'story' | 'carousel'
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

interface DashboardSummary {
  kpis: {
    newsPool: number
    storyActive: number
    carouselActive: number
    completedToday: number
  }
  factoryStatus: {
    lastNewsSyncAt: string | null
    errorCount: number | null
  }
}

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json())

const CAROUSEL_STATUS_LABELS: Record<string, string> = {
  processing: 'Wird verarbeitet',
  article_analyzed: 'Artikel analysiert',
  prompts_ready: 'Prompts erstellt',
  slide_1_complete: 'Slide 1 fertig',
  slide_2_complete: 'Slide 2 fertig',
  slide_3_complete: 'Slide 3 fertig',
  slide_4_complete: 'Slide 4 fertig',
  slide_5_complete: 'Slide 5 fertig',
  qa: 'Qualitätscheck',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
}

const STORY_STATUS_LABELS: Record<string, string> = {
  production_started: 'Produktion gestartet',
  content_started: 'Text wird erstellt',
  content_ready: 'Text fertig',
  quality_gate_passed: 'Qualitätscheck bestanden',
  prompt_ready: 'Bild-Prompt fertig',
  image_generation_started: 'Bildgenerierung läuft',
  image_v1_created: 'Bild V1 erstellt',
  image_v2_created: 'Bild V2 erstellt',
  image_approved: 'Bild freigegeben',
  canva_started: 'Canva-Layout läuft',
  canva_ready: 'Canva-Layout fertig',
  final_qa_passed: 'Finaler QA bestanden',
  production_completed: 'Produktion abgeschlossen',
  production_error: 'Produktionsfehler',
}

function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function Dashboard() {
  const { data: summary } = useSWR<DashboardSummary>(
    '/api/factory/dashboard',
    jsonFetcher,
    { refreshInterval: 15000 },
  )
  const { data: active } = useSWR<{ items: UiProductionItem[] }>(
    '/api/factory/productions?scope=active',
    jsonFetcher,
    { refreshInterval: 5000 },
  )

  const items = active?.items ?? []
  const storyItems = items.filter((i) => i.kind !== 'carousel')
  const carouselItems = items.filter((i) => i.kind === 'carousel')

  const kpis = summary?.kpis
  const status = summary?.factoryStatus

  const kpiCards = [
    {
      key: 'newsPool',
      label: 'News im Pool',
      value: kpis?.newsPool,
      icon: FileSearch,
    },
    {
      key: 'storyActive',
      label: 'Story Produktionen',
      value: kpis?.storyActive,
      icon: Loader2,
    },
    {
      key: 'carouselActive',
      label: 'Carousel Produktionen',
      value: kpis?.carouselActive,
      icon: Layers,
    },
    {
      key: 'completedToday',
      label: 'Heute fertig',
      value: kpis?.completedToday,
      icon: CheckCircle2,
    },
  ]

  const lastSync = formatTimestamp(status?.lastNewsSyncAt ?? null)
  const errorCount = status?.errorCount

  return (
    <div className="p-8">
      {/* Factory status — compact, secondary */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border/60 bg-card/40 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Systeme aktiv
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Letzte News-Synchronisierung:{' '}
          <span className="font-medium text-foreground">{lastSync ?? 'noch keine'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          Fehler:{' '}
          <span
            className={cn(
              'font-medium',
              errorCount == null
                ? 'text-muted-foreground'
                : errorCount > 0
                  ? 'text-destructive'
                  : 'text-foreground',
            )}
          >
            {errorCount == null ? 'n/v' : errorCount}
          </span>
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ key, label, value, icon: Icon }) => (
          <Card key={key} className="p-5">
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
            <p className="mt-3 font-mono text-4xl font-semibold tabular-nums">
              {value ?? '—'}
            </p>
          </Card>
        ))}
      </div>

      {/* Section 1 — Story productions */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Laufende Story-Produktionen</h2>
          <Link
            href="/aktive-produktionen"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Alle ansehen
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {storyItems.length === 0 ? (
          <EmptyRow text="Keine laufenden Story-Produktionen" />
        ) : (
          <Card className="divide-y divide-border">
            {storyItems.map((p) => (
              <div key={p.storyId ?? p.candidateId} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {p.ticker && (
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-secondary-foreground">
                        {p.ticker}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium">{p.headline}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.company}
                    {p.company && ' · '}
                    {STORY_STATUS_LABELS[p.status] ?? p.status}
                  </p>
                </div>
                <StatusBadge
                  status={
                    p.status === 'production_completed'
                      ? 'done'
                      : p.status === 'production_error'
                        ? 'rejected'
                        : 'in_progress'
                  }
                />
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Section 2 — Carousel productions */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Laufende Beitrag-Carousel-Produktionen</h2>
          <Link
            href="/goldesel-news"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Goldesel News
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {carouselItems.length === 0 ? (
          <EmptyRow text="Keine laufenden Carousel-Produktionen" />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {carouselItems.map((c) => (
              <CarouselDashboardCard key={c.storyId} item={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Card className="flex items-center justify-center px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  )
}

function CarouselDashboardCard({ item }: { item: UiProductionItem }) {
  const slideCount = item.slideCount ?? 5
  const done = item.slidesDone ?? item.generations.filter((g) => g.imageUrl).length
  const isFailed = item.status === 'failed'
  const isDone = item.status === 'completed'
  const slots = Array.from({ length: slideCount }, (_, i) =>
    item.generations.find((g) => g.version === String(i + 1)) ?? null,
  )

  return (
    <Link href={`/aktive-produktionen/${item.storyId}`} className="group block">
      <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-primary/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-brand-foreground" />
            Goldesel News
          </div>
          <StatusBadge status={isDone ? 'done' : isFailed ? 'rejected' : 'in_progress'} />
        </div>

        <p className="mt-3 text-sm font-medium leading-snug text-balance">{item.headline}</p>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {CAROUSEL_STATUS_LABELS[item.status] ?? item.status}
          </span>
          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
            {done} / {slideCount} Slides
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(item.createdAt)}
          </span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / slideCount) * 100}%` }}
          />
        </div>

        {/* Slide thumbnails — only render real images, never placeholders */}
        {done > 0 && (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {slots.map((slot, i) =>
              slot?.imageUrl ? (
                <div
                  key={i}
                  className="relative aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slot.imageUrl || '/placeholder.svg'}
                    alt={`Slide ${i + 1}`}
                    className="h-full w-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div
                  key={i}
                  className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/40 text-muted-foreground"
                >
                  {isFailed ? (
                    <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                </div>
              ),
            )}
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
