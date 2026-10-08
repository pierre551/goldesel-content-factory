'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ExternalLink, Film, Images, Loader2, Sparkles } from 'lucide-react'
import { Card } from '@/components/primitives'
import { cn } from '@/lib/utils'

interface Source {
  title: string
  url: string
}
interface Topic {
  id: string
  category: string
  headline: string
  summary: string
  sources: Source[]
}
interface Round {
  id: string
  topics: Topic[]
  createdAt: string
}

type ProdState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; status: string }
  | { kind: 'error'; message: string }

const statusLabel: Record<string, string> = {
  queued: 'In Warteschlange',
  processing: 'In Produktion',
  completed: 'Fertig',
  done: 'Fertig',
  failed: 'Fehlgeschlagen',
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Quelle'
  }
}

export function ViralTopics({
  initialRound,
  initialBeitragStatus,
  setupHint,
  openAiConfigured,
}: {
  initialRound: Round | null
  initialBeitragStatus: Record<string, string>
  setupHint: string | null
  openAiConfigured: boolean
}) {
  const [round, setRound] = useState(initialRound)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [beitrag, setBeitrag] = useState<Record<string, ProdState>>(() =>
    Object.fromEntries(
      Object.entries(initialBeitragStatus).map(([id, status]) => [id, { kind: 'running', status }]),
    ),
  )
  const [reel, setReel] = useState<Record<string, ProdState>>({})

  const hasTopics = (round?.topics.length ?? 0) > 0

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/virale-themen/generate', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message ?? `Generierung fehlgeschlagen (HTTP ${res.status}).`)
      }
      setRound(data.round)
      setBeitrag({})
      setReel({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generierung fehlgeschlagen.')
    } finally {
      setGenerating(false)
    }
  }

  async function produce(topicId: string, type: 'beitrag' | 'reel') {
    const set = type === 'beitrag' ? setBeitrag : setReel
    set((s) => ({ ...s, [topicId]: { kind: 'starting' } }))
    try {
      const res = await fetch('/api/virale-themen/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, type }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message ?? `Start fehlgeschlagen (HTTP ${res.status}).`)
      }
      set((s) => ({ ...s, [topicId]: { kind: 'running', status: 'processing' } }))
    } catch (err) {
      set((s) => ({
        ...s,
        [topicId]: { kind: 'error', message: err instanceof Error ? err.message : 'Fehler' },
      }))
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Themenrecherche</p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {round
              ? `Letzte Runde vom ${new Date(round.createdAt).toLocaleString('de-DE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}. Die Themen bleiben gespeichert, bis du eine neue Runde generierst.`
              : 'Recherchiert per OpenAI-Websuche acht aktuelle Themen mit direkten Quellenlinks.'}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {generating
            ? 'Recherche läuft…'
            : hasTopics
              ? '8 neue Themen generieren'
              : '8 Themen generieren'}
        </button>
      </Card>

      {(!openAiConfigured || setupHint) && (
        <SetupNotice
          items={[
            ...(!openAiConfigured
              ? ['OpenAI nicht angebunden: OPENAI_API_KEY in Settings → Vars hinterlegen.']
              : []),
            ...(setupHint ? [setupHint] : []),
          ]}
        />
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-destructive">Generierung fehlgeschlagen</p>
            <p className="leading-relaxed text-muted-foreground">
              {error} {hasTopics && 'Die bisherigen Themen bleiben erhalten.'}
            </p>
          </div>
        </div>
      )}

      {generating && !hasTopics && (
        <div className="grid gap-4 md:grid-cols-2" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      )}

      {hasTopics ? (
        <ul className={cn('grid gap-4 md:grid-cols-2', generating && 'opacity-60')}>
          {round!.topics.map((topic) => (
            <li key={topic.id}>
              <TopicCard
                topic={topic}
                beitrag={beitrag[topic.id] ?? { kind: 'idle' }}
                reel={reel[topic.id] ?? { kind: 'idle' }}
                onProduce={(type) => produce(topic.id, type)}
              />
            </li>
          ))}
        </ul>
      ) : (
        !generating && (
          <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
            <p className="font-semibold">Noch keine Themen</p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Starte die erste Recherche über „8 Themen generieren“.
            </p>
          </Card>
        )
      )}
    </div>
  )
}

function SetupNotice({ items }: { items: string[] }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-warning">Einrichtung erforderlich</p>
        <ul className="flex flex-col gap-1 leading-relaxed text-muted-foreground">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function TopicCard({
  topic,
  beitrag,
  reel,
  onProduce,
}: {
  topic: Topic
  beitrag: ProdState
  reel: ProdState
  onProduce: (type: 'beitrag' | 'reel') => void
}) {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
        {topic.category}
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold leading-snug text-balance">{topic.headline}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{topic.summary}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {topic.sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.title}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {hostOf(s.url)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-auto grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <ProduceControl label="Beitrag erstellen" spec="Carousel · 4 Slides · 1080×1350" icon={Images} state={beitrag} onClick={() => onProduce('beitrag')} />
        <ProduceControl label="Reel erstellen" spec="Reel · 1080×1920" icon={Film} state={reel} onClick={() => onProduce('reel')} />
      </div>
    </Card>
  )
}

function ProduceControl({
  label,
  spec,
  icon: Icon,
  state,
  onClick,
}: {
  label: string
  spec: string
  icon: typeof Film
  state: ProdState
  onClick: () => void
}) {
  const busy = state.kind === 'starting'
  const running = state.kind === 'running' && state.status !== 'failed'
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || running}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        {label}
      </button>
      <div aria-live="polite" className="text-xs leading-relaxed">
        {state.kind === 'idle' && <span className="text-muted-foreground">{spec}</span>}
        {state.kind === 'starting' && <span className="text-muted-foreground">Wird gestartet…</span>}
        {state.kind === 'running' && (
          <span className={state.status === 'failed' ? 'text-destructive' : 'text-success'}>
            {statusLabel[state.status] ?? state.status} ·{' '}
            <Link href="/aktive-produktionen" className="underline underline-offset-2">
              Aktuelle Produktion
            </Link>
          </span>
        )}
        {state.kind === 'error' && <span className="text-destructive">{state.message}</span>}
      </div>
    </div>
  )
}
