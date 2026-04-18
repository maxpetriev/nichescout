export type AgentEvent =
  | { type: 'phase'; phase: 1 | 2 | 3; label: string }
  | { type: 'plan'; text: string }
  | { type: 'search'; query: string; platform: 'x' | 'reddit'; count: number }
  | { type: 'profile'; username: string; count: number }
  | { type: 'log'; text: string }
  | { type: 'result'; data: ResearchResult }
  | { type: 'error'; message: string }

export interface ResearchResult {
  prompt: string
  hypothesis: {
    title: string
    description: string
    confidence: 'low' | 'medium' | 'high'
  }
  icp: {
    who: string
    painPoints: string[]
    channels: string[]
    budget: string
    vocabulary: string[]
  }
  gtm: {
    positioning: string
    topChannel: string
    launchMove: string
    validation: string
    timeline: string
  }
  evidence: {
    handle: string
    platform: 'x' | 'reddit'
    text: string
    why: string
  }[]
  trends: string[]
}
