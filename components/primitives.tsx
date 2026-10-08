import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowStatus } from '@/lib/types'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-8 pt-8">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
        <h1 className="text-[1.8rem] font-semibold leading-tight tracking-tight text-foreground text-balance">
          {title}
        </h1>
        {description && <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-3 pt-1">{actions}</div>}
    </header>
  )
}

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

const statusStyles: Record<WorkflowStatus, { label: string; className: string }> = {
  idle: { label: 'Wartet', className: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'Läuft', className: 'bg-warning/15 text-warning' },
  review: { label: 'Review', className: 'bg-chart-4/15 text-chart-4' },
  approved: { label: 'Freigegeben', className: 'bg-success/15 text-success' },
  rejected: { label: 'Abgelehnt', className: 'bg-destructive/15 text-destructive' },
  done: { label: 'Fertig', className: 'bg-success/15 text-success' },
}

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const s = statusStyles[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        s.className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  )
}

export function ScoreBar({
  label,
  value,
  tone = 'primary',
}: {
  label: string
  value: number
  tone?: 'primary' | 'success'
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'success' ? 'bg-success' : 'bg-primary',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-secondary-foreground">
      {children}
    </span>
  )
}

export function ComingSoon({
  icon: Icon = Construction,
  note,
}: {
  icon?: LucideIcon
  note?: string
}) {
  return (
    <div className="p-8">
      <Card className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand/15 text-brand-foreground">
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <div className="space-y-1.5">
          <p className="text-lg font-semibold">In Vorbereitung</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
            {note ??
              'Dieses Modul wird gerade für die Goldesel Content Factory entwickelt und ist bald verfügbar.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Coming Soon
        </span>
      </Card>
    </div>
  )
}
