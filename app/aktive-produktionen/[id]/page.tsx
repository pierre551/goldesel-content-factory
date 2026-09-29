import { PageHeader } from '@/components/primitives'
import { CarouselDetail } from '@/components/carousel-detail'

export const dynamic = 'force-dynamic'

export default async function CarouselDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div>
      <PageHeader
        title="Produktion"
        description="Fortschritt und Ergebnis dieser Goldesel-Produktion."
      />
      <CarouselDetail id={id} />
    </div>
  )
}
