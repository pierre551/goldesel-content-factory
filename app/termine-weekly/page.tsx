import { CalendarDays } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/primitives'

export default function TermineWeeklyPage() {
  return (
    <div>
      <PageHeader
        title="Termine Weekly"
        description="Wöchentliche Vorschau auf die wichtigsten Finanz- und Wirtschaftstermine."
      />
      <ComingSoon
        icon={CalendarDays}
        note="Die Wochenübersicht mit Earnings, Notenbank-Terminen und Konjunkturdaten wird hier für den Wochen-Post zusammengestellt."
      />
    </div>
  )
}
