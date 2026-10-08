import type { ContentFormat } from '@/lib/production-masters'

/**
 * Production key per content item. Goldesel Artikel keeps its bare slug so
 * existing carousel productions stay linked; other formats are namespaced so a
 * duel and a topstory with the same slug never share a production.
 */
export function contentArticleId(format: ContentFormat, id: string) {
  return format === 'artikel' ? id : `${format}:${id}`
}
