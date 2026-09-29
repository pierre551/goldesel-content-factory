import { Clapperboard, ImageIcon } from 'lucide-react'
import { Card } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import type { LoopReelXPost } from '@/lib/loop-reel-mock'
import { formatDateTime } from './format'

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function XPostCard({
  post,
  onGenerate,
}: {
  post: LoopReelXPost
  onGenerate: (post: LoopReelXPost) => void
}) {
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/25 text-xs font-semibold text-brand-foreground"
        >
          {initials(post.displayName)}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{post.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{post.handle}</p>
        </div>
        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
          X
        </span>
      </div>

      <p className="line-clamp-5 text-sm leading-relaxed">{post.text}</p>

      {post.hasMedia && (
        <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/60 text-muted-foreground">
          <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
          <span className="sr-only">Medien-Anhang</span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {post.handle}
          </span>
          <time dateTime={post.publishedAt} className="font-mono text-xs text-muted-foreground">
            {formatDateTime(post.publishedAt)}
          </time>
        </div>
        <Button className="w-full" size="lg" onClick={() => onGenerate(post)}>
          <Clapperboard />
          Loop Reel generieren
        </Button>
      </div>
    </Card>
  )
}
