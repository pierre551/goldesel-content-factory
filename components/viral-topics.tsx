'use client'

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, ExternalLink, ImageIcon, Info, Loader2, Share2, Sparkles } from 'lucide-react'
import { Card } from '@/components/primitives'
import { ProduceActions, postProduction } from '@/components/content-card'
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

const COUNTS = [1, 2, 4, 8] as const
type Count = (typeof COUNTS)[number]

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Quelle'
  }
}

export function ViralTopics({
  areas,
  initialRounds,
  initialBeitragStatus,
  setupHint,
  openAiConfigured,
}: {
  areas: ViralPromptMeta[]
  initialRounds: Record<ViralPromptId, Round | null> | null
  initialBeitragStatus: Record<string, string>
  setupHint: string | null
  openAiConfigured: boolean
}) {
  const [active, setActive] = useState<ViralPromptId>(areas[0].id)
  const [count, setCount] = useState<Count>(4)
  const [rounds, setRounds] = useState<Partial<Record<ViralPromptId, Round | null>>>(initialRounds ?? {})
  const [generating, setGenerating] = useState<ViralPromptId | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ViralPromptId, string>>>({})

  const area = areas.find((a) => a.id === active) ?? areas[0]
  const round = rounds[active] ?? null
  const hasTopics = (round?.topics.length ?? 0) > 0
  const isGenerating = generating === active
  const error = errors[active]

  async function research() {
    if (generating) return
    const id = active
    setGenerating(id)
    setErrors((e) => ({ ...e, [id]: undefined }))
    try {
      const res = await fetch('/api/virale-themen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: id, count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.status !== 'ok') {
        throw new Error(data.message ?? `Recherche fehlgeschlagen (HTTP ${res.status}).`)
      }
      // Replace only after the server validated and stored the new round.
      setRounds((r) => ({ ...r, [id]: data.round }))
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Recherche fehlgeschlagen.' }))
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 px-8 pb-8 pt-6">
      {(!openAiConfigured || setupHint) && (
        <SetupNotice
          items={[
            ...(!openAiConfigured ? ['OpenAI nicht angebunden: OPENAI_API_KEY in Settings → Vars hinterlegen.'] : []),
            ...(setupHint ? [setupHint] : []),
          ]}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <CountPicker value={count} onChange={setCount} disabled={generating !== null} />
        <SegmentedControl
          options={areas.map((a) => ({ id: a.id, label: a.label }))}
          value={active}
          onChange={setActive}
          busyId={generating}
        />
        <button
          type="button"
          onClick={research}
          disabled={generating !== null}
          aria-busy={isGenerating}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {isGenerating ? 'Recherche läuft…' : `${count} ${count === 1 ? 'Thema' : 'Themen'} recherchieren`}
        </button>
      </div>

      <section aria-label={area.label} className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">{area.description}</p>

        {generating && !isGenerating && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Recherche für „{areas.find((a) => a.id === generating)?.label}“ läuft – bitte warten.
          </p>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
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
            <p className="leading-relaxed text-muted-foreground">{round.shortfallReason}</p>
          </div>
        )}

        {isGenerating && !hasTopics && (
          <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
            {Array.from({ length: Math.min(count, 4) }, (_, i) => (
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
                  initialBeitragStatus={initialBeitragStatus[topic.id] ?? null}
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
                Wähle Anzahl und Bereich und starte „Themen recherchieren“. Es werden nur Themen mit belegten Quellen
                übernommen.
              </p>
            </Card>
          )
        )}
      </section>
    </div>
  )
}

function CountPicker({
  value,
  onChange,
  disabled,
}: {
  value: Count
  onChange: (v: Count) => void
  disabled: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Anzahl Themen" className="inline-flex shrink-0 rounded-lg bg-sidebar p-1">
      {COUNTS.map((c) => {
        const selected = c === value
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={cn(
              'min-w-9 rounded-md px-2.5 py-1.5 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed',
              selected ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  busyId,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  busyId: T | null
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[value]
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.id === value)
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else return
    e.preventDefault()
    const id = options[next].id
    onChange(id)
    refs.current[id]?.focus()
    refs.current[id]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none]">
      <div
        role="radiogroup"
        aria-label="Themenbereich"
        onKeyDown={onKeyDown}
        className="relative inline-flex rounded-lg bg-sidebar p-1"
      >
        {indicator && (
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 rounded-md bg-card shadow-sm transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
          />
        )}
        {options.map((o) => {
          const selected = o.id === value
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[o.id] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(o.id)}
              className={cn(
                'relative z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none',
                selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                !indicator && selected && 'bg-card',
              )}
            >
              {busyId === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {o.label}
            </button>
          )
        })}
      </div>
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
  initialBeitragStatus,
}: {
  topic: Topic
  slideTitles: readonly string[]
  initialBeitragStatus: string | null
}) {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <span className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
        {topic.category}
      </span>

      <div className="flex flex-col gap-2">
        {topic.hook && <p className="text-xl font-bold leading-tight text-primary text-balance">{topic.hook}</p>}
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
            <Disclosure title="Beitrag-Entwurf">
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
                      {s.title && s.title !== slideTitles[i] && <p className="text-sm font-semibold">{s.title}</p>}
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
                <span className="flex items-center gap-1.5 font-medium leading-snug">
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

      <div className="mt-auto border-t border-border pt-4">
        <ProduceActions
          initialBeitrag={initialBeitragStatus ? { status: initialBeitragStatus, productionRunId: null } : null}
          start={(type) => postProduction('/api/virale-themen/produce', { topic_id: topic.id, type })}
        />
      </div>
    </Card>
  )
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium marker:text-muted-foreground">{title}</summary>
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
