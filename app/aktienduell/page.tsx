import { AktienduellList } from '@/components/aktienduell-list'
import { fetchGoldeselAktienduelle } from '@/lib/goldesel-aktienduelle'
import { getFeedStatuses } from '@/lib/content-status'

export const metadata = { title: 'Aktienduell · Content Factory' }
export const dynamic = 'force-dynamic'

export default async function AktienduellPage() {
  const result = await fetchGoldeselAktienduelle()
  const statuses = result.ok ? await getFeedStatuses('aktienduell', result.duels.map((d) => d.id)) : {}

  return (
    <AktienduellList
      initialData={result.ok ? { duels: result.duels, fetchedAt: result.fetchedAt } : null}
      initialError={result.ok ? null : result.message}
      statuses={statuses}
    />
  )
}
