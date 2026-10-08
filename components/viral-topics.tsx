'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ExternalLink, Film, ImageIcon, Images, Info, Loader2, Share2, Sparkles } from 'lucide-react'
import { Card } from '@/components/primitives'
import { cn } from '@/lib/utils'
import type { ViralPromptId, ViralPromptMeta } from '@/lib/viral-prompts'

interface Source {
  title: string
  url: string
  publishedAt?: string | null
  note?: string | null
}
interface ReelDraft {
  hookOverlay: string
  mainStatement: string
  facts: string[]
  conclusion: string
}
interface Topic {
  id: string
  category: string
  headline: string
  hook?: string
  summary: string
  keyFacts?: string[]
  shareReason?: string
  reel?: ReelDraft
  slides?: { title: string; text: string }[]
  imageIdea?: string
  sources: Source[]
}
interface Round {
  id: string
  topics: Topic[]
  shortfallReason: string | null
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

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

export function ViralTopics({
  areas,
  topicCount,
  initialRounds,
  initialBeitragStatus,
  setupHint,
  openAiConfigured,
}: {
  areas: ViralPromptMeta[]
  topicCount: number
  initialRounds: Record<ViralPromptId, Round | null> | null
  initialBeitragStatus: Record<string, string>
  setupHint: string | null
  openAiConfigured: boolean
}) {
  const [active, setActive] = useState<ViralPromptId>(areas[0].id)
  const [rounds, setRounds] = useState<Partial<Record<ViralPromptId, Round | null>>>(initialRounds ?? {})
  const [generating, setGenerating] = useState<ViralPromptId | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ViralPromptId, string>>>({})
  const [beitrag, setBeitrag] = useState<Record<string, ProdState>>(() =>
    Object.fromEntries(
      Object.entries(initialBeitragStatus).map(([id, status]) => [id, { kind: 'running', status }]),
    ),
  )
  const [reel, setReel] = useState<Record<string, ProdState>>({})

  const area = areas.find((a) => a.id === active) ?? areas[0]
  const round = rounds[active] ?? null
  const hasTopics = (round?.topics.length ?? 0) > 0
  const isGenerating = generating === active
  const error = errors[active]

  async function generate(id: ViralPromptId) {
    setGenerating(id)
    setErrors((e) => ({ ...e, [id]: undefined }))
    try {
      const res = await fetch('/api/virale-themen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message ?? `Generierung fehlgeschlagen (HTTP ${res.status}).`)
      }
      setRounds((r) => ({ ...r, [id]: data.round }))
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Generierung fehlgeschlagen.' }))
    } finally {
      setGenerating(null)
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

      <div role="tablist" aria-label="Themenbereiche" className="flex flex-wrap gap-2">
        {areas.map((a) => {
          const selected = a.id === active
          const count = rounds[a.id]?.topics.length ?? 0
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`tab-${a.id}`}
              aria-selected={selected}
              aria-controls="viral-panel"
              onClick={() => setActive(a.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground',
              )}
            >
              {generating === a.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {a.label}
              <span className="rounded bg-secondary px-1.5 text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <section id="viral-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{area.label}</p>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {area.description}{' '}
              {round
                ? `Letzte Recherche: ${formatDateTime(round.createdAt)}. Bleibt gespeichert, bis du neu recherchierst.`
                : `Recherchiert per Websuche bis zu ${topicCount} belegte Themen.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => generate(active)}
            disabled={generating !== null}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {isGenerating ? 'Recherche läuft…' : hasTopics ? 'Neu recherchieren' : 'Themen recherchieren'}
          </button>
        </Card>

        {generating && !isGenerating && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Recherche für „{areas.find((a) => a.id === generating)?.label}“ läuft – bitte warten.
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-destructive">Recherche fehlgeschlagen</p>
              <p className="leading-relaxed text-muted-foreground">
                {error} {hasTopics && 'Die bisherigen Themen bleiben erhalten.'}
              </p>
            </div>
          </div>
        )}

        {round?.shortfallReason && !isGenerating && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                {round.topics.length} von {topicCount} Themen:
              </span>{' '}
              {round.shortfallReason}
            </p>
          </div>
        )}

        {isGenerating && !hasTopics && (
          <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
            {Array.from({ length: topicCount }, (_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-lg border border-border bg-card" />
            ))}
          </div>
        )}

        {hasTopics ? (
          <ul className={cn('grid gap-4 lg:grid-cols-2', isGenerating && 'opacity-60')}>
            {round!.topics.map((topic) => (
              <li key={topic.id}>
                <TopicCard
                  topic={topic}
                  slideTitles={area.slideTitles}
                  beitrag={beitrag[topic.id] ?? { kind: 'idle' }}
                  reel={reel[topic.id] ?? { kind: 'idle' }}
                  onProduce={(type) => produce(topic.id, type)}
                />
              </li>
            ))}
          </ul>
        ) : (
          !isGenerating && (
            <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden />
              <p className="font-semibold">Noch keine Themen in „{area.label}“</p>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Starte die Recherche über „Themen recherchieren“. Es werden nur Themen mit belegten Quellen
                übernommen.
              </p>
            </Card>
          )
        )}
      </section>
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
  slideTitles,
  beitrag,
  reel,
  onProduce,
}: {
  topic: Topic
  slideTitles: readonly string[]
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
        {topic.hook && (
          <p className="text-xl font-bold leading-tight text-primary text-balance">{topic.hook}</p>
        )}
        <h2 className="text-base font-semibold leading-snug text-balance">{topic.headline}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{topic.summary}</p>
      </div>

      {topic.keyFacts && topic.keyFacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kernfakten</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
            {topic.keyFacts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {topic.shareReason && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{topic.shareReason}</span>
        </p>
      )}

      {(topic.slides?.length || topic.reel) && (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {topic.slides && topic.slides.length > 0 && (
            <Disclosure title="Beitrag · 4 Slides">
              <ol className="flex flex-col gap-3">
                {topic.slides.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary text-xs font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {slideTitles[i] ?? s.title}
                      </p>
                      {s.title && s.title !== slideTitles[i] && (
                        <p className="text-sm font-semibold">{s.title}</p>
                      )}
                      <p className="text-sm leading-relaxed text-pretty">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Disclosure>
          )}
          {topic.reel && (
            <Disclosure title="Reel-Entwurf">
              <dl className="flex flex-col gap-3 text-sm">
                <DraftRow label="Hook-Overlay" value={topic.reel.hookOverlay} />
                <DraftRow label="Content-Maske" value={topic.reel.mainStatement} />
                {topic.reel.facts.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fakten</dt>
                    <dd>
                      <ul className="flex list-disc flex-col gap-1 pl-5 leading-relaxed">
                        {topic.reel.facts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                <DraftRow label="Fazit" value={topic.reel.conclusion} />
              </dl>
            </Disclosure>
          )}
          {topic.imageIdea && (
            <Disclosure title="Bildidee">
              <p className="flex items-start gap-2 text-sm leading-relaxed">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {topic.imageIdea}
              </p>
            </Disclosure>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quellen</p>
        <ul className="flex flex-col gap-2">
          {topic.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-0.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary"
              >
                <span className="flex items-center gap-1.5 font-medium leading-snug group-hover:text-foreground">
                  <span className="line-clamp-1">{s.title || hostOf(s.url)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                </span>
                <span className="text-xs text-muted-foreground">
                  {[hostOf(s.url), s.publishedAt, s.note].filter(Boolean).join(' · ')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <ProduceControl label="Beitrag erstellen" spec="Carousel · 4 Slides · 1080×1350" icon={Images} state={beitrag} onClick={() => onProduce('beitrag')} />
        <ProduceControl label="Reel erstellen" spec="Reel · 1080×1920" icon={Film} state={reel} onClick={() => onProduce('reel')} />
      </div>
    </Card>
  )
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium marker:text-muted-foreground">
        {title}
      </summary>
      <div className="pb-1 pt-3">{children}</div>
    </details>
  )
}

function DraftRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="leading-relaxed">{value}</dd>
    </div>
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
