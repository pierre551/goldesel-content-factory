import { PageHeader } from '@/components/primitives'
import { ViralTopics } from '@/components/viral-topics'
import { getLatestViralRound, viralArticleId } from '@/lib/viral-topics'
import { getCarouselStatusByArticleIds } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Virale Themen · Content Factory',
  description:
    'Aktuelle Nachrichten, politische Entscheidungen und Gesetzesänderungen mit Wirkung auf Finanzen und Alltag in Deutschland.',
}

export default async function ViraleThemenPage() {
  const result = await getLatestViralRound()
  const round = result.ok ? result.round : null
  const topics = round?.topics ?? []
  const statusByArticle = await getCarouselStatusByArticleIds(topics.map((t) => viralArticleId(t.id)))
  const beitragStatus = Object.fromEntries(
    topics
      .map((t) => [t.id, statusByArticle[viralArticleId(t.id)]?.status] as const)
      .filter(([, s]) => Boolean(s)),
  ) as Record<string, string>

  return (
    <div>
      <PageHeader
        title="Virale Themen"
        description="Acht recherchierte Themen zu Nachrichten, politischen Entscheidungen und Gesetzesänderungen, die Finanzen und Alltag in Deutschland betreffen."
      />
      <ViralTopics
        initialRound={round}
        initialBeitragStatus={beitragStatus}
        setupHint={result.ok ? null : result.setupHint}
        openAiConfigured={Boolean(process.env.OPENAI_API_KEY)}
      />
    </div>
  )
}
