'use client'

import { useState } from 'react'
import type { LoopReelArticle, LoopReelSelection, LoopReelXPost } from '@/lib/loop-reel-mock'
import { ContentSlider, SliderItem } from './content-slider'
import { ArticleCard } from './article-card'
import { XPostCard } from './x-post-card'
import { GenerateReelDialog } from './generate-reel-dialog'
import { WorkflowInfo } from './workflow-info'

export function LoopReelView({
  articles,
  posts,
}: {
  articles: LoopReelArticle[]
  posts: LoopReelXPost[]
}) {
  const [selection, setSelection] = useState<LoopReelSelection | null>(null)

  return (
    <div className="flex flex-col gap-10 px-4 py-6 sm:px-8">
      <ContentSlider
        title="Goldesel Artikel"
        description="Aktuelle Artikel von goldesel.de als Quelle für dein Loop Reel."
        count={articles.length}
      >
        {articles.map((article) => (
          <SliderItem key={article.id}>
            <ArticleCard
              article={article}
              onGenerate={(item) => setSelection({ kind: 'article', item })}
            />
          </SliderItem>
        ))}
      </ContentSlider>

      <ContentSlider
        title="X Beiträge"
        description="Ausgewählte Finanz-Accounts auf X."
        count={posts.length}
      >
        {posts.map((post) => (
          <SliderItem key={post.id}>
            <XPostCard post={post} onGenerate={(item) => setSelection({ kind: 'x-post', item })} />
          </SliderItem>
        ))}
      </ContentSlider>

      <WorkflowInfo />

      <GenerateReelDialog selection={selection} onClose={() => setSelection(null)} />
    </div>
  )
}
