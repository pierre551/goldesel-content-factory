import { PageHeader } from '@/components/primitives'
import { ViralTopics } from '@/components/viral-topics'
import { getLatestViralRounds, viralArticleId } from '@/lib/viral-topics'
import { VIRAL_PROMPTS } from '@/lib/viral-prompts'
import { getCarouselStatusByArticleIds } from '@/lib/carousel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Virale Themen · Content Factory',
  description:
    'Recherchierte Themen aus Politik & Gesetze, Geld & Alltag, Börse & Unternehmen sowie Tech & Zukunft – mit Reel- und Carousel-Entwurf.',
}

export default async function ViraleThemenPage() {
  const result = await getLatestViralRounds()
  const rounds = result.ok ? result.rounds : null
  const topics = rounds ? Object.values(rounds).flatMap((r) => r?.topics ?? []) : []
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
        description="Vier Redaktionsbereiche mit eigener Recherche: belegte Themen inklusive Hook, Kernfakten, Reel-Entwurf, vier Carousel-Slides und datierten Quellen."
      />
      <ViralTopics
        areas={VIRAL_PROMPTS}
        initialRounds={rounds}
        initialBeitragStatus={beitragStatus}
        setupHint={result.ok ? null : result.setupHint}
        openAiConfigured={Boolean(process.env.OPENAI_API_KEY)}
      />
    </div>
  )
}
