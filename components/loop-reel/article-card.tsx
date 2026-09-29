import Image from 'next/image'
import { Clapperboard, Newspaper } from 'lucide-react'
import { Card } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import type { LoopReelArticle } from '@/lib/loop-reel-mock'
import { formatDate } from './format'

export function ArticleCard({
  article,
  onGenerate,
}: {
  article: LoopReelArticle
  onGenerate: (article: LoopReelArticle) => void
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        {article.image ? (
          <Image
            src={article.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 288px, 85vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Newspaper className="h-8 w-8" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur">
          {article.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <time dateTime={article.publishedAt} className="font-mono text-xs text-muted-foreground">
          {formatDate(article.publishedAt)}
        </time>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-balance">
          {article.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {article.summary}
        </p>
        <Button className="mt-auto w-full" size="lg" onClick={() => onGenerate(article)}>
          <Clapperboard />
          Loop Reel generieren
        </Button>
      </div>
    </Card>
  )
}
