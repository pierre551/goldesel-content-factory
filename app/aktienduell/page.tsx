import { Swords } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/primitives'

export const metadata = { title: 'Aktienduell · Content Factory' }

export default function AktienduellPage() {
  return (
    <div>
      <PageHeader
        title="Aktienduell"
        description="Zwei Aktien im direkten Vergleich – Kennzahlen, Performance und Analystenmeinungen als Content-Format."
      />
      <ComingSoon
        icon={Swords}
        note="Hier werden zwei Werte gegenübergestellt und als Duell-Beitrag aufbereitet. Die Datenanbindung wird als Nächstes ergänzt."
      />
    </div>
  )
}
