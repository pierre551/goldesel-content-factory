import { PageHeader } from '@/components/primitives'
import { HistoryTimeline } from '@/components/history-timeline'

export default function VerlaufPage() {
  return (
    <div>
      <PageHeader
        title="Verlauf"
        description="Chronologische Timeline aller fertig produzierten Inhalte — neueste zuerst."
      />
      <HistoryTimeline />
    </div>
  )
}
