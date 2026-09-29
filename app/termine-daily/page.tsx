import { CalendarClock } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/primitives'

export default function TermineDailyPage() {
  return (
    <div>
      <PageHeader
        title="Termine Daily"
        description="Die relevanten Termine des Tages für tägliche Content-Formate."
      />
      <ComingSoon
        icon={CalendarClock}
        note="Tagesaktuelle Earnings, Termine und Marktereignisse werden hier für den Daily-Post aufbereitet."
      />
    </div>
  )
}
