'use client'

import { useEffect, useRef } from 'react'
import { Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LoopReelSelection } from '@/lib/loop-reel-mock'

export function GenerateReelDialog({
  selection,
  onClose,
}: {
  selection: LoopReelSelection | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (selection && !dialog.open) dialog.showModal()
    if (!selection && dialog.open) dialog.close()
  }, [selection])

  const source =
    selection?.kind === 'article'
      ? `Goldesel · ${selection.item.category}`
      : selection
        ? `X · ${selection.item.handle}`
        : ''
  const preview =
    selection?.kind === 'article' ? selection.item.title : (selection?.item.text ?? '')

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="loop-reel-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-card p-0 text-card-foreground backdrop:bg-background/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="loop-reel-dialog-title" className="text-lg font-semibold tracking-tight">
            Loop Reel generieren
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Quelle
            </dt>
            <dd className="text-sm font-medium">{source}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Inhalt
            </dt>
            <dd className="line-clamp-4 rounded-md bg-muted/60 p-3 text-sm leading-relaxed">
              {preview}
            </dd>
          </div>
        </dl>

        <p className="flex items-start gap-2 rounded-md border border-border bg-background/50 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Die automatische Reel-Generierung wird in einem nächsten Schritt angebunden.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={onClose}>
            Schließen
          </Button>
          <Button size="lg" disabled>
            Generierung starten
          </Button>
        </div>
      </div>
    </dialog>
  )
}
