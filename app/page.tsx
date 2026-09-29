import { PageHeader } from '@/components/primitives'
import { Dashboard } from '@/components/dashboard'

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Überblick über Story-Content und Beitrag-Carousels der Goldesel Content Factory."
      />
      <Dashboard />
    </div>
  )
}
