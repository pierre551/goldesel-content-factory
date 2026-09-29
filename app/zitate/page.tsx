import { Quote } from 'lucide-react'
import { ComingSoon, PageHeader } from '@/components/primitives'

export default function ZitatePage() {
  return (
    <div>
      <PageHeader
        title="Zitate"
        description="Kuratiertes Börsen- und Investoren-Wissen für Zitat-Formate."
      />
      <ComingSoon
        icon={Quote}
        note="Zitate von Investoren und Marktkommentatoren werden hier zu teilbaren Zitat-Grafiken verarbeitet."
      />
    </div>
  )
}
