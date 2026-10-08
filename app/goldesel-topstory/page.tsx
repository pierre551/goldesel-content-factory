import { PageHeader } from '@/components/primitives'
import { GoldeselTopstoryList } from '@/components/goldesel-topstory-list'
import { fetchGoldeselTopstories } from '@/lib/goldesel-topstories'

export const metadata = { title: 'Goldesel Topstory · Content Factory' }
export const dynamic = 'force-dynamic'

export default async function GoldeselTopstoryPage() {
  const result = await fetchGoldeselTopstories()

  return (
    <div>
      <PageHeader
        title="Goldesel Topstory"
        description="Die zehn neuesten Topstories von goldesel.de — live abgerufen."
      />
      <GoldeselTopstoryList
        initialData={
          result.ok ? { topstories: result.topstories, fetchedAt: result.fetchedAt } : null
        }
        initialError={result.ok ? null : result.message}
      />
    </div>
  )
}
