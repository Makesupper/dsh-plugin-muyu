import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '../shims.js'
import { MeritStorage } from './merit-storage.js'
import { ChantService } from './chant-service.js'
import { soundLibrary } from '../data/sounds.js'
import type {
  MuyuSoundType,
  KnockResult,
  AutoKnockStatus,
  MeritStats,
  SutraBook,
  TokenConsumeResult
} from '../types.js'
import type { MuyuConfig } from '../config.js'

const MAX_KNOCK_BATCH = 108
const MIN_INTERVAL_MS = 200
const MAX_INTERVAL_MS = 60000
const DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000 // 30 minutes

function clampNumber(val: unknown, fallback: number, min: number, max: number): number {
  const num = Number(val)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

function clampCount(val: unknown, fallback: number = 1, max: number = MAX_KNOCK_BATCH): number {
  const num = Number(val)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.min(max, Math.max(1, Math.floor(num)))
}

export class MuyuService {
  private storage: MeritStorage
  private chantService: ChantService
  private currentSound: MuyuSoundType = 'sandalwood'
  private autoKnockTimer: ReturnType<typeof setInterval> | null = null
  private autoStatus: AutoKnockStatus = {
    running: false,
    targetCount: 0,
    currentCount: 0,
    intervalMs: 1200,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    cycleTitle: '无尽修持'
  }
  private assetsDir: string

  constructor(public ctx: Context, public config: MuyuConfig = {}) {
    this.storage = new MeritStorage(config.storagePath)
    this.chantService = new ChantService(config.defaultSutra)
    if (config.defaultSound && soundLibrary[config.defaultSound]) {
      this.currentSound = config.defaultSound
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    this.assetsDir = path.resolve(__dirname, '../../assets/sounds')

    this.ctx.effect(() => {
      return () => {
        this.stopAutoKnock()
      }
    })
  }

  public getSoundType(): MuyuSoundType {
    return this.currentSound
  }

  public setSoundType(type: MuyuSoundType): boolean {
    if (soundLibrary[type]) {
      this.currentSound = type
      return true
    }
    return false
  }

  public getSoundFile(type?: MuyuSoundType): string {
    const targetType = type || this.currentSound
    const def = soundLibrary[targetType] || soundLibrary.sandalwood
    return path.join(this.assetsDir, def.fileName)
  }

  private getVoiceSettings() {
    return {
      rate: clampNumber(this.config.voiceRate, 0.8, 0.1, 2.0),
      pitch: clampNumber(this.config.voicePitch, 0.95, 0.1, 2.0),
      volume: clampNumber(this.config.volume, 1.0, 0.0, 1.0)
    }
  }

  /**
   * Perform a single-write knock that adds `amount` merit and advances the sutra by 1 sentence.
   */
  public knock(amount: number = 1, tokens: number = 0): KnockResult {
    const safeAmount = clampCount(amount, 1, MAX_KNOCK_BATCH)
    const safeTokens = Number.isFinite(Number(tokens)) && Number(tokens) > 0 ? Math.floor(Number(tokens)) : 0
    const { todayMerit, totalMerit, todayTokens, totalTokens, pendingTokens } = this.storage.addMerit(
      safeAmount,
      safeTokens
    )
    const { current, next, cycleCompleted, completedCycles } = this.chantService.advanceSentence()
    const soundFile = this.getSoundFile()
    const voice = this.getVoiceSettings()

    return {
      amount: safeAmount,
      todayMerit,
      totalMerit,
      todayTokens,
      totalTokens,
      currentSentence: current,
      nextSentence: next,
      cycleCompleted,
      completedCycles,
      soundType: this.currentSound,
      soundFile,
      tokensConsumed: safeTokens,
      pendingTokens,
      voicePrompt: {
        text: current.text + '　',
        lang: 'zh-CN',
        rate: voice.rate,
        pitch: voice.pitch,
        volume: voice.volume
      }
    }
  }

  /**
   * Perform a batch of knocks with a SINGLE disk write while advancing the sutra `count` times.
   */
  public knockBatch(
    count: number,
    tokens: number = 0,
    pendingTokens?: number
  ): KnockResult[] {
    const safeCount = clampCount(count, 1, MAX_KNOCK_BATCH)
    const safeTokens = Number.isFinite(Number(tokens)) && Number(tokens) > 0 ? Math.floor(Number(tokens)) : 0

    // Single atomic disk write for the entire batch
    const baseMeritBefore = this.storage.todayMerit
    const totalMeritBefore = this.storage.totalMerit
    const { todayTokens, totalTokens, pendingTokens: savedPending } = this.storage.addMerit(
      safeCount,
      safeTokens,
      pendingTokens
    )

    const soundFile = this.getSoundFile()
    const voice = this.getVoiceSettings()
    const results: KnockResult[] = []

    for (let i = 0; i < safeCount; i++) {
      const { current, next, cycleCompleted, completedCycles } = this.chantService.advanceSentence()
      const stepMeritOffset = i + 1
      results.push({
        amount: 1,
        todayMerit: baseMeritBefore + stepMeritOffset,
        totalMerit: totalMeritBefore + stepMeritOffset,
        todayTokens,
        totalTokens,
        currentSentence: current,
        nextSentence: next,
        cycleCompleted,
        completedCycles,
        soundType: this.currentSound,
        soundFile,
        tokensConsumed: i === safeCount - 1 ? safeTokens : 0,
        pendingTokens: savedPending,
        voicePrompt: {
          text: current.text + '　',
          lang: 'zh-CN',
          rate: voice.rate,
          pitch: voice.pitch,
          volume: voice.volume
        }
      })
    }

    return results
  }

  /**
   * Consume LLM tokens, accumulate remainder in persistent pendingTokens, and trigger up to 108 knocks per call
   * with a single disk write.
   */
  public consumeTokens(tokens: number): TokenConsumeResult {
    const numTokens = Number(tokens)
    const safeTokens = Number.isFinite(numTokens) && numTokens > 0 ? Math.round(numTokens) : 0

    if (safeTokens === 0) {
      const stats = this.storage.getStats()
      return {
        tokensConsumed: 0,
        pendingTokens: stats.pendingTokens,
        knocksTriggered: 0,
        meritGained: 0,
        todayMerit: stats.todayMerit,
        totalMerit: stats.totalMerit,
        todayTokens: stats.todayTokens,
        totalTokens: stats.totalTokens,
        knockResults: []
      }
    }

    if (this.config.tokenKnockEnabled === false) {
      this.storage.addTokens(safeTokens)
      const stats = this.storage.getStats()
      return {
        tokensConsumed: safeTokens,
        pendingTokens: stats.pendingTokens,
        knocksTriggered: 0,
        meritGained: 0,
        todayMerit: stats.todayMerit,
        totalMerit: stats.totalMerit,
        todayTokens: stats.todayTokens,
        totalTokens: stats.totalTokens,
        knockResults: []
      }
    }

    const step = clampNumber(this.config.tokensPerMerit, 10000, 1, 10000000)
    const totalPool = this.storage.pendingTokens + safeTokens
    const rawKnocks = Math.floor(totalPool / step)
    const knocksToTrigger = Math.min(MAX_KNOCK_BATCH, rawKnocks)
    const nextPending = totalPool - knocksToTrigger * step

    let knockResults: KnockResult[] = []
    if (knocksToTrigger > 0) {
      knockResults = this.knockBatch(knocksToTrigger, safeTokens, nextPending)
    } else {
      this.storage.addTokens(safeTokens, nextPending)
    }

    const stats = this.storage.getStats()
    return {
      tokensConsumed: safeTokens,
      pendingTokens: stats.pendingTokens,
      knocksTriggered: knocksToTrigger,
      meritGained: knocksToTrigger,
      todayMerit: stats.todayMerit,
      totalMerit: stats.totalMerit,
      todayTokens: stats.todayTokens,
      totalTokens: stats.totalTokens,
      knockResults
    }
  }

  public getPendingTokens(): number {
    return this.storage.pendingTokens
  }

  public getTokensPerMerit(): number {
    return clampNumber(this.config.tokensPerMerit, 10000, 1, 10000000)
  }

  public startAutoKnock(
    targetCount: number = 0,
    intervalMs?: number,
    cycleTitle?: string,
    maxDurationMs?: number
  ): AutoKnockStatus {
    this.stopAutoKnock()

    const safeTarget = Number.isFinite(Number(targetCount)) && Number(targetCount) >= 0
      ? Math.floor(Number(targetCount))
      : 108
    const interval = clampNumber(
      intervalMs ?? this.config.autoKnockIntervalMs,
      1200,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS
    )
    const maxDuration = clampNumber(
      maxDurationMs ?? this.config.autoKnockMaxDurationMs,
      DEFAULT_MAX_DURATION_MS,
      1000,
      86400000
    )

    const startTime = Date.now()
    this.autoStatus = {
      running: true,
      targetCount: safeTarget,
      currentCount: 0,
      intervalMs: interval,
      maxDurationMs: maxDuration,
      cycleTitle: cycleTitle || (safeTarget === 0 ? '无尽修持' : `${safeTarget} 次圆满`),
      startTime
    }

    this.autoKnockTimer = setInterval(() => {
      if (Date.now() - startTime >= maxDuration) {
        this.stopAutoKnock()
        return
      }

      this.knock(1)
      this.autoStatus.currentCount += 1

      if (this.autoStatus.targetCount > 0 && this.autoStatus.currentCount >= this.autoStatus.targetCount) {
        this.stopAutoKnock()
      }
    }, interval)

    return { ...this.autoStatus }
  }

  public stopAutoKnock(): AutoKnockStatus {
    if (this.autoKnockTimer) {
      clearInterval(this.autoKnockTimer)
      this.autoKnockTimer = null
    }
    this.autoStatus.running = false
    return { ...this.autoStatus }
  }

  public getAutoKnockStatus(): AutoKnockStatus {
    return { ...this.autoStatus }
  }

  public getMeritStats(): MeritStats {
    return this.storage.getStats()
  }

  public getSutra(): SutraBook {
    return this.chantService.getBook()
  }

  public getAllSutras(): SutraBook[] {
    return this.chantService.getAllBooks()
  }

  public selectSutra(bookId: string): boolean {
    return this.chantService.setBook(bookId)
  }

  public getCurrentSentence() {
    return this.chantService.getCurrentSentence()
  }
}
