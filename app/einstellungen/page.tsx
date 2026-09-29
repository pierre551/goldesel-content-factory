import { Bot, Cloud, ImageIcon, KeyRound, Newspaper } from 'lucide-react'
import { Card, PageHeader } from '@/components/primitives'

const integrations = [
  {
    name: 'News-Recherche API',
    description: 'Quelle für Aktien-News, Ratings und Termine.',
    icon: Newspaper,
    status: 'Nicht verbunden',
  },
  {
    name: 'Content-Modell',
    description: 'LLM zur Generierung deutscher Captions.',
    icon: Bot,
    status: 'Nicht verbunden',
  },
  {
    name: 'Bildgenerierung',
    description: 'Higgsfield / Diffusion-Modell für Post-Grafiken.',
    icon: ImageIcon,
    status: 'Nicht verbunden',
  },
  {
    name: 'Canva Export',
    description: 'Rendern der finalen Post-Templates.',
    icon: Cloud,
    status: 'Nicht verbunden',
  },
]

export default function EinstellungenPage() {
  return (
    <div>
      <PageHeader
        title="Einstellungen"
        description="Integrationen und Workflow-Parameter der Content Factory."
      />

      <div className="max-w-3xl p-8">
        <div className="mb-8 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Dies ist ein UI-Prototyp. Externe Dienste (News, KI, Bildgenerierung,
            Canva) sind noch nicht angebunden — die Architektur ist auf spätere
            Integration vorbereitet.
          </p>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Integrationen
        </h2>
        <Card className="divide-y divide-border">
          {integrations.map(({ name, description, icon: Icon, status }) => (
            <div key={name} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {status}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
