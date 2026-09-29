import { Star } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/primitives'

export default function AnalystenRatingsPage() {
  return (
    <div>
      <PageHeader
        title="Analysten Ratings"
        description="Kursziele und Bewertungen von Analysten, aufbereitet für die Content-Produktion."
      />
      <ComingSoon
        icon={Star}
        note="Analysten-Ratings (Kaufen / Halten / Verkaufen, Kursziele, Auf- und Abstufungen) werden hier automatisch zu Post-Ideen verarbeitet."
      />
    </div>
  )
}
