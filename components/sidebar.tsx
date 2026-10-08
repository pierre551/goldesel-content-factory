'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Award,
  CalendarClock,
  CalendarDays,
  Flame,
  History,
  LayoutDashboard,
  Loader2,
  Newspaper,
  Quote,
  Settings,
  Star,
  Swords,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  soon?: boolean
}

type NavGroup = {
  label?: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Content Formate',
    items: [
      { href: '/virale-themen', label: 'Virale Themen', icon: Flame },
      { href: '/analysten-ratings', label: 'Analysten Ratings', icon: Star },
      { href: '/aktienduell', label: 'Aktienduell', icon: Swords },
      { href: '/goldesel-news', label: 'Goldesel Artikel', icon: Newspaper },
      { href: '/goldesel-topstory', label: 'Goldesel Topstory', icon: Award },
      { href: '/zitate', label: 'Zitate', icon: Quote, soon: true },
      { href: '/termine-weekly', label: 'Termine Weekly', icon: CalendarDays, soon: true },
      { href: '/termine-daily', label: 'Termine Daily', icon: CalendarClock, soon: true },
    ],
  },
  {
    label: 'Produktion',
    items: [
      { href: '/aktive-produktionen', label: 'Aktuelle Produktion', icon: Loader2 },
      { href: '/verlauf', label: 'Verlauf', icon: History },
    ],
  },
  {
    label: 'Einstellungen',
    items: [{ href: '/einstellungen', label: 'Connections', icon: Settings }],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-mono text-lg font-bold text-primary-foreground">
          G
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              GOLDESEL
            </p>
            <span className="rounded bg-brand/20 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-foreground">
              Beta
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Content Factory</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className="flex flex-col gap-1">
            {group.label && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map(({ href, label, icon: Icon, soon }) => {
              // Active state is keyed on the exact route (or a nested sub-route
              // like `${href}/detail`), never a bare string prefix. This keeps
              // sibling routes that share a prefix — e.g. `/goldesel-news` and
              // `/story-goldesel-news` — from highlighting each other.
              const active =
                href === '/'
                  ? pathname === '/'
                  : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                    active
                      ? 'bg-sidebar-accent text-sidebar-foreground shadow-[inset_2px_0_0_var(--primary)]'
                      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      active ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
                    )}
                    strokeWidth={2}
                  />
                  <span className="flex-1">{label}</span>
                  {soon ? (
                    <span className="rounded-full bg-warning/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-warning">
                      Soon
                    </span>
                  ) : active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/25 text-xs font-semibold text-brand-foreground">
            RK
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-sidebar-foreground">Redaktion</p>
            <p className="text-xs text-muted-foreground">Team Goldesel</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
