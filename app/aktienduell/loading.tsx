import { PageHeader } from '@/components/primitives'
import { AktienduellSkeleton } from '@/components/aktienduell-list'

export default function Loading() {
  return (
    <div>
      <PageHeader
        title="Aktienduell"
        description="Zwei Aktien im direkten Vergleich – die neuesten Aktienduelle von goldesel.de."
      />
      <div className="p-8" role="status">
        <AktienduellSkeleton />
      </div>
    </div>
  )
}
