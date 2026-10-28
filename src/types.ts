export interface SutraSentence {
  id: number
  text: string
  bookId: string
  bookTitle: string
}

export interface SutraBook {
  id: string
  title: string
  summary: string
  sentences: string[]
}

export type MuyuSoundType = 'sandalwood' | 'whitewood' | 'bell'

export interface SoundDefinition {
  id: MuyuSoundType
  displayName: string
  description: string
  fileName: string
}

export interface DailyMeritRecord {
  dateKey: string // Local "YYYY-MM-DD"
  count: number
  displayDate: string
  tokens?: number
}

export interface MeritStats {
  todayMerit: number
  totalMerit: number
  todayTokens: number
  totalTokens: number
  pendingTokens: number
  todayKey: string
  records: DailyMeritRecord[]
}

export interface KnockResult {
  amount: number
  todayMerit: number
  totalMerit: number
  todayTokens: number
  totalTokens: number
  currentSentence: SutraSentence
  nextSentence: SutraSentence
  cycleCompleted: boolean
  completedCycles: number
  soundType: MuyuSoundType
  soundFile: string
  tokensConsumed?: number
  pendingTokens?: number
  voicePrompt: {
    text: string
    lang: string
    rate: number
    pitch: number
    volume: number
  }
}

export interface AutoKnockStatus {
  running: boolean
  targetCount: number
  currentCount: number
  intervalMs: number
  maxDurationMs: number
  cycleTitle: string
  startTime?: number
}

export interface TokenConsumeResult {
  tokensConsumed: number
  pendingTokens: number
  knocksTriggered: number
  meritGained: number
  todayMerit: number
  totalMerit: number
  todayTokens: number
  totalTokens: number
  knockResults: KnockResult[]
}
