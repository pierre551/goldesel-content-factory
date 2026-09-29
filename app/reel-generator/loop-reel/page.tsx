import { LoopReelView } from '@/components/loop-reel/loop-reel-view'
import { MOCK_GOLDESEL_ARTICLES, MOCK_X_POSTS } from '@/lib/loop-reel-mock'

export const metadata = {
  title: 'Loop Reel · Reel Generator · Content Factory',
  description:
    'Erstelle aus aktuellen Finanznachrichten und Social-Media-Beiträgen ein fertiges Loop Reel.',
}

export default function LoopReelPage() {
  return (
    <div>
      <header className="flex items-start gap-3 border-b border-border px-4 py-6 sm:px-8">
        <span aria-hidden className="mt-5 h-8 w-1 shrink-0 rounded-full bg-brand" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Reel Generator
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">Loop Reel</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Erstelle aus aktuellen Finanznachrichten und Social-Media-Beiträgen ein fertiges Loop
            Reel.
          </p>
        </div>
      </header>
      <LoopReelView articles={MOCK_GOLDESEL_ARTICLES} posts={MOCK_X_POSTS} />
    </div>
  )
}
