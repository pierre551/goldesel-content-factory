'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
} from 'lucide-react'
import { Card, StatusBadge } from '@/components/primitives'
import { cn } from '@/lib/utils'

interface SlideRow {
  id: string
  slide_index: number
  image_url: string | null
  prompt: string | null
  status: string
}

interface ProductionRow {
  production_run_id: string
  article_id: string
  article_url: string
  title: string
  published_at: string | null
  source: string
  content_type: string
  slide_count: number
  status: string
  error: string | null
  instagram_caption: string | null
  created_at?: string
}

interface DetailResponse {
  ok: boolean
  production?: ProductionRow
  slides?: SlideRow[]
  error?: string
}

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

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<DetailResponse>)

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function statusToBadge(status: string) {
  if (status === 'completed') return 'done' as const
  if (status === 'failed') return 'rejected' as const
  return 'in_progress' as const
}

export function CarouselDetail({ id }: { id: string }) {
  const { data, isLoading } = useSWR<DetailResponse>(
    `/api/goldesel-carousel/${id}`,
    fetcher,
    {
      refreshInterval: (latest) => {
        const s = latest?.production?.status
        return s && (s === 'completed' || s === 'failed') ? 0 : 3000
      },
      revalidateOnFocus: true,
    },
  )

  const backLink = (
    <Link
      href="/aktive-produktionen"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Zurück zu Aktuelle Produktion
    </Link>
  )

  if (isLoading) {
    return (
      <div className="p-8">
        {backLink}
        <Card className="mt-4 flex items-center justify-center px-6 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </Card>
      </div>
    )
  }

  const production = data?.production
  if (!production) {
    return (
      <div className="p-8">
        {backLink}
        <Card className="mt-4 flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <p className="text-lg font-semibold">Produktion nicht gefunden</p>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            Diese Carousel-Produktion existiert nicht oder ist noch nicht in der
            Datenbank verfügbar.
          </p>
        </Card>
      </div>
    )
  }

  const isStory = production.content_type === 'story_goldesel_news'
  const slideCount = isStory ? 1 : (production.slide_count ?? 5)
  const slidesByIndex = new Map((data?.slides ?? []).map((s) => [s.slide_index, s]))
  const slots = Array.from({ length: slideCount }, (_, i) => {
    const idx = i + 1
    return slidesByIndex.get(idx) ?? {
      id: `placeholder-${idx}`,
      slide_index: idx,
      image_url: null,
      prompt: null,
      status: 'pending',
    }
  })
  const done = slots.filter((s) => s.image_url).length
  const isActive = production.status !== 'completed' && production.status !== 'failed'
  const started = production.created_at
    ? dateFormatter.format(new Date(production.created_at))
    : '—'

  return (
    <div className="p-8">
      {backLink}

      <Card className="mt-4 flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-brand/15 px-2 py-px font-medium text-brand-foreground">
                {isStory ? 'Goldesel Artikel / Story' : 'Goldesel Carousel'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {started}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-snug text-balance">
              {production.title}
            </h2>
            <a
              href={production.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Quellartikel öffnen
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <StatusBadge status={statusToBadge(production.status)} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {CAROUSEL_STATUS_LABELS[production.status] ?? production.status}
          </span>
          <span className="font-mono text-sm font-medium tabular-nums">
            {isStory ? `${done} / 1 Story-Bild` : `${done} / ${slideCount} Slides`}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done / slideCount) * 100}%` }}
            />
          </div>
        </div>

        {done > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={
                isStory
                  ? `/api/goldesel-carousel/${production.production_run_id}/download?slide=1`
                  : `/api/goldesel-carousel/${production.production_run_id}/download`
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              {isStory ? 'Bild herunterladen' : `Alle ${done} herunterladen`}
            </a>
            {!isStory && done < slideCount && (
              <span className="text-xs text-muted-foreground">
                {done} von {slideCount} Slides verfügbar
              </span>
            )}
          </div>
        )}

        {production.status === 'failed' && production.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {production.error}
          </div>
        )}
      </Card>

      <div
        className={
          isStory
            ? 'mt-6 grid max-w-xs grid-cols-1 gap-4'
            : 'mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'
        }
      >
        {slots.map((slide) => {
          const label = String(slide.slide_index).padStart(2, '0')
          return (
            <div key={slide.id} className="flex flex-col gap-2">
              <div
                className={cn(
                  'relative overflow-hidden rounded-lg border border-border bg-muted',
                  isStory ? 'aspect-[9/16]' : 'aspect-[4/5]',
                )}
              >
                <span className="absolute left-2 top-2 z-10 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-xs font-semibold backdrop-blur">
                  {label}
                </span>
                {slide.image_url && (
                  <a
                    href={`/api/goldesel-carousel/${production.production_run_id}/download?slide=${slide.slide_index}`}
                    className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-background/80 p-1.5 backdrop-blur transition-colors hover:bg-background"
                    title={`Slide ${label} herunterladen`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="sr-only">Slide {label} herunterladen</span>
                  </a>
                )}
                {slide.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.image_url || '/placeholder.svg'}
                    alt={`Slide ${slide.slide_index}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    {isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
                    )}
                    <span className="text-[11px]">
                      {isActive ? 'Wird generiert …' : 'Kein Bild'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <CaptionSection caption={production.instagram_caption} isActive={isActive} />
    </div>
  )
}

/**
 * Instagram caption for the whole carousel.
 *   - caption present            → readable box + "Text kopieren"
 *   - still producing, no caption → subtle "wird erstellt …" status
 *   - finished, no caption        → nothing (avoid fake placeholder copy)
 */
function CaptionSection({
  caption,
  isActive,
}: {
  caption: string | null
  isActive: boolean
}) {
  const trimmed = caption?.trim() ?? ''

  if (!trimmed) {
    if (!isActive) return null
    return (
      <Card className="mt-6 flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Instagram-Beschreibung wird erstellt …
      </Card>
    )
  }

  return (
    <Card className="mt-6 flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Instagram-Beschreibung</h3>
        <CopyButton text={trimmed} />
      </div>
      <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed text-pretty">
        {trimmed}
      </p>
    </Card>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for browsers/contexts without the async clipboard API.
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-primary" />
          Kopiert
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Text kopieren
        </>
      )}
    </button>
  )
}
