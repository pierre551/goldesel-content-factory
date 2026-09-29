// Domain types for the Goldesel Content Factory.
// These are intentionally decoupled from any data source so that the mock
// layer in `lib/data.ts` can later be swapped for real API/DB calls.

export type WorkflowStage =
  | 'research'
  | 'content'
  | 'image'
  | 'quality'
  | 'canva'
  | 'finished'

export type WorkflowStatus =
  | 'idle'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'done'

export type NewsCategory = 'aktien' | 'wirtschaft'

export interface NewsCandidate {
  id: string
  category: NewsCategory
  company: string
  ticker: string
  headline: string
  explanation: string
  source: string
  publishedAt: string
  relevanceScore: number
  viralScore: number
  status: WorkflowStatus
}

export interface GeneratedImage {
  id: string
  version: 'V1' | 'V2'
  url: string
  status: 'approved' | 'rejected' | 'pending'
  qaScore: number
}

export interface ProductionStep {
  stage: WorkflowStage
  label: string
  status: WorkflowStatus
  detail: string
}

export interface Production {
  id: string
  company: string
  ticker: string
  headline: string
  category: NewsCategory
  currentStage: WorkflowStage
  createdAt: string
  steps: ProductionStep[]
  images: GeneratedImage[]
  canvaPreview?: string
}

export interface CompletedPost {
  id: string
  company: string
  ticker: string
  headline: string
  canvaPreview: string
  createdAt: string
}

export interface DashboardStats {
  researched: number
  selected: number
  inProgress: number
  completed: number
}
