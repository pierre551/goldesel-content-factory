'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ExternalLink, Film, Images, Loader2, RefreshCw, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/primitives'
import { cn } from '@/lib/utils'

export type ProductionType = 'beitrag' | 'reel'

export type StartResult =
  | { ok: true; productionRunId: string | null }
  | { ok: false; message: string; setupRequired?: boolean }

export type ProdState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; status: string; productionRunId: string | null }
  | { kind: 'error'; message: string; setupRequired?: boolean }

const statusLabel: Record<string, string> = {
  queued: 'In Warteschlange',
  processing: 'In Produktion',
  rendering: 'In Produktion',
  completed: 'Fertig',
  done: 'Fertig',
  failed: 'Fehlgeschlagen',
}

const isTerminal = (s: string) => s === 'completed' || s === 'done' || s === 'failed'

/** POSTs to a produce endpoint and maps the JSON contract onto a StartResult. */
export async function postProduction(url: string, body: Record<string, unknown>): Promise<StartResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.status !== 'ok') {
      return {
        ok: false,
        message: data.message ?? `Start fehlgeschlagen (HTTP ${res.status}).`,
        setupRequired: Boolean(data.setup_required),
      }
    }
    return { ok: true, productionRunId: data.production_run_id ?? null }
  } catch {
    return { ok: false, message: 'Netzwerkfehler bei der Übergabe an die Produktion.' }
  }
}

/**
 * Beitrag and Reel keep fully separate state; a running Beitrag never blocks the
 * Reel. A ref guards against double clicks before React re-renders.
 */
export function ProduceActions({
  start,
  initialBeitrag,
}: {
  start: (type: ProductionType) => Promise<StartResult>
  initialBeitrag?: { status: string; productionRunId: string | null } | null
}) {
  const [states, setStates] = useState<Record<ProductionType, ProdState>>({
    beitrag: initialBeitrag ? { kind: 'running', ...initialBeitrag } : { kind: 'idle' },
    reel: { kind: 'idle' },
  })
  const inFlight = useRef<Set<ProductionType>>(new Set())

  async function run(type: ProductionType) {
    const current = states[type]
    if (inFlight.current.has(type)) return
    if (current.kind === 'starting') return
    if (current.kind === 'running' && !isTerminal(current.status)) return
    inFlight.current.add(type)
    setStates((s) => ({ ...s, [type]: { kind: 'starting' } }))
    const result = await start(type)
    setStates((s) => ({
      ...s,
      [type]: result.ok
        ? { kind: 'running', status: 'processing', productionRunId: result.productionRunId }
        : { kind: 'error', message: result.message, setupRequired: result.setupRequired },
    }))
    inFlight.current.delete(type)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ProduceControl label="Beitrag erstellen" icon={Images} state={states.beitrag} onClick={() => run('beitrag')} />
      <ProduceControl label="Reel erstellen" icon={Film} state={states.reel} onClick={() => run('reel')} />
    </div>
  )
}

function ProduceControl({
  label,
  icon: Icon,
  state,
  onClick,
}: {
  label: string
  icon: LucideIcon
  state: ProdState
  onClick: () => void
}) {
  const busy = state.kind === 'starting'
  const blocked = state.kind === 'running' && !isTerminal(state.status)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || blocked}
        aria-busy={busy}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        {label}
      </button>
      <div aria-live="polite" className="min-h-4 text-xs leading-relaxed empty:hidden">
        {state.kind === 'starting' && <span className="text-muted-foreground">Wird gestartet…</span>}
        {state.kind === 'running' && (
          <span className={state.status === 'failed' ? 'text-destructive' : 'text-success'}>
            {statusLabel[state.status] ?? state.status} ·{' '}
            <Link
              href={state.productionRunId ? `/aktive-produktionen/${state.productionRunId}` : '/aktive-produktionen'}
              className="underline underline-offset-2"
            >
              Zur Produktion
            </Link>
          </span>
        )}
        {state.kind === 'error' && (
          <span className={state.setupRequired ? 'text-warning' : 'text-destructive'}>{state.message}</span>
        )}
      </div>
    </div>
  )
}

/** Original image with a single, non-looping fallback to a neutral Goldesel placeholder. */
export function ContentImage({ src, alt, placeholderLabel }: { src: string | null; alt: string; placeholderLabel: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src && failedSrc !== src
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <span className="font-mono text-lg font-bold tracking-tight text-primary/70">goldesel</span>
          <span className="text-xs font-medium">{placeholderLabel}</span>
        </div>
      )}
    </div>
  )
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})

export function formatPublished(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : dateFormatter.format(d)
}

export function ContentCard({
  label,
  publishedAt,
  title,
  teaser,
  image,
  url,
  actions,
}: {
  label: string
  publishedAt: string | null
  title: string
  teaser: string | null
  image: string | null
  url: string
  actions: ReactNode
}) {
  const date = formatPublished(publishedAt)
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <ContentImage src={image} alt={title} placeholderLabel={label} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-primary">
              {label}
            </span>
            {date && (
              <time dateTime={publishedAt ?? undefined} className="text-muted-foreground">
                {date}
              </time>
            )}
          </div>
          <h2 className="text-base font-semibold leading-snug text-balance">{title}</h2>
          {teaser && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground text-pretty">{teaser}</p>}
        </div>
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          {actions}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Artikel öffnen
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="sr-only">{`: ${title} (neuer Tab)`}</span>
          </a>
        </div>
      </div>
    </Card>
  )
}

export function RefreshButton({ onClick, busy, label = 'Aktualisieren' }: { onClick: () => void; busy: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
      {busy ? 'Wird aktualisiert…' : label}
    </button>
  )
}

export function FeedError({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-destructive">{title}</p>
        <p className="leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function CardGridSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex flex-col overflow-hidden">
          <div className="aspect-video w-full animate-pulse bg-muted" />
          <div className="flex flex-col gap-2 p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-9 w-full animate-pulse rounded bg-muted" />
          </div>
        </Card>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}
