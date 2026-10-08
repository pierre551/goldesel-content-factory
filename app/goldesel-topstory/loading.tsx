import { PageHeader } from '@/components/primitives'
import { TopstorySkeleton } from '@/components/goldesel-topstory-list'

export default function Loading() {
  return (
    <div>
      <PageHeader
        title="Goldesel Topstory"
        description="Die zehn neuesten Topstories von goldesel.de — live abgerufen."
      />
      <div className="p-8" role="status">
        <TopstorySkeleton />
      </div>
    </div>
  )
}
