import { PageHeader } from '@/components/primitives'
import { ProductionBoard } from '@/components/production-board'

export default function AktiveProduktionenPage() {
  return (
    <div>
      <PageHeader
        title="Aktive Produktionen"
        description="Alle aktuell laufenden Produktionen mit Live-Status vom Goldesel Manager."
      />
      <ProductionBoard />
    </div>
  )
}
