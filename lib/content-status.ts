import 'server-only'
import { getCarouselStatusByArticleIds } from '@/lib/carousel'
import { contentArticleId } from '@/lib/content-ids'
import type { ContentFormat } from '@/lib/production-masters'

/** Beitrag production status per feed item id (namespaced production keys are unwrapped). */
export async function getFeedStatuses(format: ContentFormat, ids: string[]) {
  const keyToId = new Map(ids.map((id) => [contentArticleId(format, id), id]))
  const byKey = await getCarouselStatusByArticleIds([...keyToId.keys()])
  const out: Record<string, { productionRunId: string; status: string }> = {}
  for (const [key, info] of Object.entries(byKey)) {
    const id = keyToId.get(key)
    if (id) out[id] = { productionRunId: info.productionRunId, status: info.status }
  }
  return out
}
