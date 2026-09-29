import { PageHeader } from '@/components/primitives'
import { NewsWorkflow } from '@/components/news-workflow'

export default function AktienNewsPage() {
  return (
    <div>
      <PageHeader
        title="Aktien News"
        description="KI-recherchierte Einzelwerte-News, bereit für die Content-Produktion."
      />
      <NewsWorkflow category="aktien_news" accentLabel="Aktien" />
    </div>
  )
}
