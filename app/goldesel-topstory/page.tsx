import { Award } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/primitives'

export const metadata = { title: 'Goldesel Topstory · Content Factory' }

export default function GoldeselTopstoryPage() {
  return (
    <div>
      <PageHeader
        title="Goldesel Topstory"
        description="Die wichtigste Geschichte des Tages von goldesel.de als hervorgehobenes Content-Format."
      />
      <ComingSoon
        icon={Award}
        note="Die Topstory wird aus dem Goldesel-Artikelpool ausgewählt und als Premium-Beitrag produziert. Die Anbindung folgt."
      />
    </div>
  )
}
