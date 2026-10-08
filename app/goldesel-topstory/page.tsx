import { GoldeselTopstoryList } from '@/components/goldesel-topstory-list'
import { fetchGoldeselTopstories } from '@/lib/goldesel-topstories'
import { getFeedStatuses } from '@/lib/content-status'

export const metadata = { title: 'Goldesel Topstory · Content Factory' }
export const dynamic = 'force-dynamic'

export default async function GoldeselTopstoryPage() {
  const result = await fetchGoldeselTopstories()
  const statuses = result.ok ? await getFeedStatuses('topstory', result.topstories.map((t) => t.id)) : {}

  return (
    <GoldeselTopstoryList
      initialData={result.ok ? { topstories: result.topstories, fetchedAt: result.fetchedAt } : null}
      initialError={result.ok ? null : result.message}
      statuses={statuses}
    />
  )
}
