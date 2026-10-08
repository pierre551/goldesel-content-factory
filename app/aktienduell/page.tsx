import { PageHeader } from '@/components/primitives'
import { AktienduellList } from '@/components/aktienduell-list'
import { fetchGoldeselAktienduelle } from '@/lib/goldesel-aktienduelle'

export const metadata = { title: 'Aktienduell · Content Factory' }
export const dynamic = 'force-dynamic'

export default async function AktienduellPage() {
  const result = await fetchGoldeselAktienduelle()

  return (
    <div>
      <PageHeader
        title="Aktienduell"
        description="Zwei Aktien im direkten Vergleich — die neuesten Aktienduelle von goldesel.de, live abgerufen."
      />
      <AktienduellList
        initialData={result.ok ? { duels: result.duels, fetchedAt: result.fetchedAt } : null}
        initialError={result.ok ? null : result.message}
      />
    </div>
  )
}
