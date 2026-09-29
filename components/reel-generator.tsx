'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  AlertTriangle,
  Check,
  Clapperboard,
  Download,
  Film,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react'
import { Card, StatusBadge } from '@/components/primitives'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'

const ACCEPT = '.mp4,.mov,video/mp4,video/quicktime'
const ALLOWED_EXT = /\.(mp4|mov)$/i

/** German labels for the canonical reel lifecycle (spec §12). */
const REEL_STATUS_LABELS: Record<string, string> = {
  queued: 'In Warteschlange',
  video_ready: 'Video vorbereitet',
  designer_processing: 'Designer verarbeitet',
  higgsfield_upload: 'Upload zu Higgsfield',
  higgsfield_rendering: 'Higgsfield rendert',
  qa: 'Qualitätsprüfung',
  completed: 'Fertig',
  failed: 'Fehlgeschlagen',
}

const REEL_STEPS = [
  'queued',
  'video_ready',
  'designer_processing',
  'higgsfield_upload',
  'higgsfield_rendering',
  'qa',
  'completed',
]

interface ReelItem {
  kind: 'reel'
  storyId: string
  headline: string
  status: string
  createdAt: string | null
  contentType: string
  resultUrl: string | null
  originalUrl: string | null
  originalFilename: string
  fileSize: number | null
  duration: number | null
  error: string | null
}

interface ReelListResponse {
  active: ReelItem[]
  completed: ReelItem[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ReelListResponse>)

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')} min`
}

const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : timeFormatter.format(d)
}

export function ReelGenerator() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'submitting'>('idle')
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, mutate } = useSWR<ReelListResponse>('/api/goldesel-reel/list', fetcher, {
    refreshInterval: (latest) =>
      (latest?.active ?? []).length > 0 ? 3000 : 0,
    revalidateOnFocus: true,
  })

  const active = data?.active ?? []
  const completed = data?.completed ?? []
  const busy = phase !== 'idle'

  // Object URL lifecycle for the local preview.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const acceptFile = useCallback((next: File | null) => {
    setMessage(null)
    setDuration(null)
    if (!next) return
    const typeOk =
      ALLOWED_EXT.test(next.name) ||
      next.type === 'video/mp4' ||
      next.type === 'video/quicktime'
    if (!typeOk) {
      setMessage({ type: 'error', text: 'Nur MP4- und MOV-Videos werden unterstützt.' })
      return
    }
    setFile(next)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (busy) return
      acceptFile(e.dataTransfer.files?.[0] ?? null)
    },
    [acceptFile, busy],
  )

  const clearFile = () => {
    setFile(null)
    setDuration(null)
    setMessage(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleGenerate() {
    if (!file || busy) return
    setMessage(null)
    try {
      // 1. Mint the canonical id + a signed direct-upload URL.
      setPhase('uploading')
      const urlRes = await fetch('/api/goldesel-reel/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok || urlJson.status !== 'ok') {
        throw new Error(urlJson.message ?? 'Upload konnte nicht vorbereitet werden.')
      }

      // 2. Push the source video straight to Storage (no serverless proxy).
      const supabase = getBrowserSupabase()
      const { error: upErr } = await supabase.storage
        .from(urlJson.bucket)
        .uploadToSignedUrl(urlJson.path, urlJson.token, file, {
          contentType: file.type || 'video/mp4',
        })
      if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`)

      // 3. Create the production + hand off to Grok (server-side).
      setPhase('submitting')
      const genRes = await fetch('/api/goldesel-reel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_run_id: urlJson.production_run_id,
          path: urlJson.path,
          original_filename: file.name,
          file_size: file.size,
          duration,
        }),
      })
      const genJson = await genRes.json()
      if (!genRes.ok || genJson.status !== 'ok') {
        throw new Error(genJson.message ?? 'Produktion konnte nicht gestartet werden.')
      }

      clearFile()
      setMessage({ type: 'info', text: 'Reel-Produktion gestartet.' })
      await mutate()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unbekannter Fehler.',
      })
    } finally {
      setPhase('idle')
    }
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Upload / preview */}
      {!file ? (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/50',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <UploadCloud className="h-8 w-8" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold">Rohvideo hierher ziehen</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
              MP4 oder MOV. Das Video wird direkt und sicher in den Factory-Speicher
              geladen und anschließend als Goldesel Reel produziert.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Film className="h-4 w-4" />
            Video auswählen
          </span>
        </label>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[minmax(0,260px)_1fr]">
            <div className="relative aspect-[9/16] max-h-[420px] bg-black">
              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration
                    if (Number.isFinite(d)) setDuration(d)
                  }}
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold" title={file.name}>
                    {file.name}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {formatBytes(file.size)} · {formatDuration(duration)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Entfernen
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    Preset
                  </p>
                  <p className="mt-1 text-sm font-medium">Monochrom Vibes</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    Output
                  </p>
                  <p className="mt-1 text-sm font-medium">9:16 · MP4</p>
                </div>
              </div>

              {message && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                    message.type === 'error'
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-primary/40 bg-primary/10 text-primary',
                  )}
                >
                  {message.type === 'error' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  ) : (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                  {message.text}
                </div>
              )}

              <div className="mt-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clapperboard className="h-4 w-4" />
                  )}
                  {phase === 'uploading'
                    ? 'Video wird geladen …'
                    : phase === 'submitting'
                      ? 'Produktion wird gestartet …'
                      : 'Reel generieren'}
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  Anderes Video
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {message && !file && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            message.type === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-primary/40 bg-primary/10 text-primary',
          )}
        >
          {message.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <Check className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Active reel productions */}
      {active.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Aktuelle Produktion
            </h2>
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Aktualisieren
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((item) => (
              <ActiveReelCard key={item.storyId} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Completed / failed reels */}
      {completed.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Zuletzt produziert
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {completed.map((item) => (
              <CompletedReelCard key={item.storyId} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function reelStepIndex(status: string): number {
  const i = REEL_STEPS.indexOf(status)
  return i >= 0 ? i : 0
}

function ActiveReelCard({ item }: { item: ReelItem }) {
  const isFailed = item.status === 'failed'
  const currentIndex = reelStepIndex(item.status)
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Film className="h-3.5 w-3.5 text-brand-foreground" />
          {item.contentType}
        </div>
        <StatusBadge status={isFailed ? 'rejected' : 'in_progress'} />
      </div>

      <p className="mt-3 truncate text-sm font-medium" title={item.headline}>
        {item.headline}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        Start {formatWhen(item.createdAt)}
      </p>

      <div className="mt-3 flex items-center gap-2 text-sm">
        {!isFailed && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <span className={cn(isFailed ? 'text-destructive' : 'text-foreground')}>
          {REEL_STATUS_LABELS[item.status] ?? item.status}
        </span>
      </div>

      {!isFailed && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {REEL_STEPS.map((step, i) => {
            const reached = i <= currentIndex
            const active = i === currentIndex
            return (
              <span
                key={step}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  reached ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {active && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {reached && !active && <Check className="h-2.5 w-2.5" />}
                {REEL_STATUS_LABELS[step]}
              </span>
            )
          })}
        </div>
      )}

      {isFailed && item.error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <X className="h-4 w-4 shrink-0" />
          <span className="truncate" title={item.error}>
            {item.error}
          </span>
        </div>
      )}
    </Card>
  )
}

function CompletedReelCard({ item }: { item: ReelItem }) {
  const isFailed = item.status === 'failed'
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative aspect-[9/16] max-h-[360px] bg-black">
        {item.resultUrl && !isFailed ? (
          <video
            src={item.resultUrl}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isFailed ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <Film className="h-6 w-6" />
            )}
            <span className="text-xs">{isFailed ? 'Fehlgeschlagen' : 'Kein Video'}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={item.headline}>
              {item.headline}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {item.contentType} · {formatWhen(item.createdAt)}
            </p>
          </div>
          <StatusBadge status={isFailed ? 'rejected' : 'done'} />
        </div>

        {isFailed && item.error && (
          <p className="truncate text-xs text-destructive" title={item.error}>
            {item.error}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {!isFailed && (
            <a
              href={`/api/goldesel-reel/${item.storyId}/download`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              MP4 herunterladen
            </a>
          )}
          {item.originalUrl && (
            <a
              href={`/api/goldesel-reel/${item.storyId}/download?variant=original`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Originalvideo
            </a>
          )}
        </div>
      </div>
    </Card>
  )
}
