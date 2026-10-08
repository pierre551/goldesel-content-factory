import { PageHeader } from '@/components/primitives'
import { GoldeselStoryList } from '@/components/goldesel-story-list'
import { getStoryArticles } from '@/lib/goldesel-articles'
import { getStoryStatusByArticleIds } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Goldesel Artikel · Story · Content Factory',
  description:
    'Veröffentlichte Goldesel-Artikel — produziere pro Artikel eine vertikale Story (9:16).',
}

export default async function GoldeselNewsStoryPage() {
  // Reads the persisted pool (falls back to a live read only when the pool is
  // empty/not yet migrated). A page load never re-fetches into the pool.
  const { articles, persisted } = await getStoryArticles(20)
  const storyStatus = await getStoryStatusByArticleIds(articles.map((a) => a.id))

  return (
    <div>
      <PageHeader
        title="Goldesel Artikel · Story"
        description="Veröffentlichte Artikel von goldesel.de — produziere pro Artikel eine vertikale Story (9:16) über die GrokBot-Produktion. Dieselben Artikel bleiben unabhängig davon für das Beitrag-Carousel verfügbar."
      />
      <GoldeselStoryList
        initialArticles={articles.map((a) => ({
          id: a.id,
          url: a.url,
          title: a.title,
          image: a.image,
          publishedAt: a.publishedAt,
          isin: a.isin,
          ticker: a.ticker,
          teaser: a.teaser,
        }))}
        storyStatus={storyStatus}
        persisted={persisted}
      />
    </div>
  )
}
