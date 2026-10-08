import { PageHeader } from '@/components/primitives'
import { GoldeselNewsList } from '@/components/goldesel-news-list'
import { getPooledArticles } from '@/lib/goldesel-articles'
import { getCarouselStatusByArticleIds } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Goldesel Artikel · Carousel · Content Factory',
  description:
    'Veröffentlichte Goldesel-Artikel — starte pro Artikel ein 5-Slide Instagram-Carousel.',
}

export default async function GoldeselNewsPage() {
  // Reads the SHARED persisted pool (falls back to a live read only when the
  // pool is empty / not yet migrated). A plain page load never re-fetches into
  // the pool — only the explicit "Aktualisieren" action does.
  const { articles, persisted } = await getPooledArticles(20)
  const carouselStatus = await getCarouselStatusByArticleIds(articles.map((a) => a.id))

  return (
    <div>
      <PageHeader
        title="Goldesel Artikel · Carousel"
        description="Veröffentlichte Artikel von goldesel.de — starte pro Artikel ein 5-Slide Instagram-Carousel (1080×1350) über die GrokBot-Produktion. Dieselben Artikel bleiben unabhängig davon für die Story verfügbar."
      />
      <GoldeselNewsList
        initialArticles={articles.map((a) => ({
          id: a.id,
          url: a.url,
          title: a.title,
          image: a.image,
          publishedAt: a.publishedAt,
          isin: a.isin,
          teaser: a.teaser,
        }))}
        carouselStatus={carouselStatus}
        persisted={persisted}
      />
    </div>
  )
}
