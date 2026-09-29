import { BookOpen, Film, Layers, Sparkles, Wand2 } from 'lucide-react'
import { Card } from '@/components/primitives'

const STEPS = [
  { label: 'Quelle wird gelesen', icon: BookOpen },
  { label: 'Inhalte werden an den Masterprompt übergeben', icon: Sparkles },
  { label: 'Figma erstellt das Overlay', icon: Layers },
  { label: 'Higgsfield generiert den Hintergrund', icon: Wand2 },
  { label: 'Higgsfield Edit verbindet alles zum fertigen Reel', icon: Film },
]

export function WorkflowInfo() {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold tracking-tight">So entsteht dein Loop Reel</h2>
      <ol className="mt-4 flex flex-col gap-0 md:flex-row md:gap-3">
        {STEPS.map(({ label, icon: Icon }, i) => (
          <li key={label} className="relative flex flex-1 gap-3 pb-5 last:pb-0 md:flex-col md:pb-0">
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute left-4 top-9 bottom-0 w-px bg-border md:left-10 md:right-0 md:top-4 md:bottom-auto md:h-px md:w-auto"
              />
            )}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex flex-col gap-0.5 pt-1 md:pt-0">
              <span className="font-mono text-xs text-muted-foreground">Schritt {i + 1}</span>
              <span className="text-sm font-medium leading-snug text-pretty">{label}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
