export type SessionDraft = {
  title: string
  count: number
  category: number
  difficulty: 'easy' | 'medium' | 'hard'
  type: 'boolean' | 'multiple'
}

export type CreatedSession = SessionDraft & {
  id: string
  createdAt: string
}

export type QuizQuestion = {
  id: string
  prompt: string
  choices: string[]
}

export type LeaderboardEntry = {
  player_wallet: string
  total_score: number
  updated_at: string
}

export const defaultDraft: SessionDraft = {
  title: 'Chaplain Quick Quiz',
  count: 10,
  category: 20,
  difficulty: 'easy',
  type: 'boolean',
}
