import { PageHeader } from '@/components/primitives'
import { GoldeselNewsList } from '@/components/goldesel-news-list'
import { getPooledArticles } from '@/lib/goldesel-articles'
import { getCarouselStatusByArticleIds } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Goldesel Artikel · Content Factory',
  description: 'Veröffentlichte Goldesel-Artikel – pro Artikel Beitrag oder Reel erstellen.',
}

export default async function GoldeselNewsPage() {
  // Reads the SHARED persisted pool (falls back to a live read only when the
  // pool is empty / not yet migrated). A plain page load never re-fetches into
  // the pool — only the explicit "Aktualisieren" action does.
  const { articles, persisted } = await getPooledArticles(20)
  const carouselStatus = await getCarouselStatusByArticleIds(articles.map((a) => a.id))

  return (
    <div>
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
