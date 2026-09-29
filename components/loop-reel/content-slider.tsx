'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ContentSlider({
  title,
  description,
  count,
  children,
}: {
  title: string
  description?: string
  count: number
  children: ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState({ start: 0, width: 1 })
  const [edges, setEdges] = useState({ atStart: true, atEnd: false })

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress({
      start: el.scrollWidth ? el.scrollLeft / el.scrollWidth : 0,
      width: el.scrollWidth ? el.clientWidth / el.scrollWidth : 1,
    })
    setEdges({ atStart: el.scrollLeft <= 2, atEnd: el.scrollLeft >= max - 2 })
  }, [])

  useEffect(() => {
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <span className="rounded-full bg-muted px-2 py-px font-mono text-xs text-muted-foreground">
              {count}
            </span>
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SliderArrow label="Zurück" disabled={edges.atStart} onClick={() => scrollByPage(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </SliderArrow>
          <SliderArrow label="Weiter" disabled={edges.atEnd} onClick={() => scrollByPage(1)}>
            <ChevronRight className="h-4 w-4" />
          </SliderArrow>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={measure}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-1 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[margin,width] duration-150"
          style={{
            marginLeft: `${progress.start * 100}%`,
            width: `${Math.max(progress.width, 0.05) * 100}%`,
          }}
        />
      </div>
    </section>
  )
}

function SliderArrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors',
        'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {children}
    </button>
  )
}

export function SliderItem({ children }: { children: ReactNode }) {
  return (
    <div className="w-[85%] shrink-0 snap-start sm:w-72 lg:w-80">{children}</div>
  )
}
