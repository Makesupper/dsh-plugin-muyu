import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '../shims.js'
import { MeritStorage } from './merit-storage.js'
import { ChantService } from './chant-service.js'
import { soundLibrary } from '../data/sounds.js'
import type { MuyuSoundType, KnockResult, AutoKnockStatus, MeritStats, SutraBook } from '../types.js'
import type { MuyuConfig } from '../config.js'

export class MuyuService {
  private storage: MeritStorage
  private chantService: ChantService
  private currentSound: MuyuSoundType = 'sandalwood'
  private autoKnockTimer: NodeJS.Timeout | null = null
  private autoStatus: AutoKnockStatus = {
    running: false,
    targetCount: 0,
    currentCount: 0,
    intervalMs: 1200,
    cycleTitle: '无尽修持'
  }
  private assetsDir: string

  constructor(public ctx: Context, public config: MuyuConfig) {
    this.storage = new MeritStorage(config.storagePath)
    this.chantService = new ChantService(config.defaultSutra)
    this.currentSound = config.defaultSound || 'sandalwood'

    // 解析 assets/sounds 绝对路径
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    this.assetsDir = path.resolve(__dirname, '../../assets/sounds')

    // ctx.effect 确保插件被卸载或热重载时自动停止定时器
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

  public knock(amount: number = 1): KnockResult {
    const { todayMerit, totalMerit } = this.storage.addMerit(amount)
    const { current, next, cycleCompleted, completedCycles } = this.chantService.advanceSentence()

    const soundFile = this.getSoundFile()

    return {
      amount,
      todayMerit,
      totalMerit,
      currentSentence: current,
      nextSentence: next,
      cycleCompleted,
      completedCycles,
      soundType: this.currentSound,
      soundFile,
      voicePrompt: {
        text: current.text + '　', // 与 iOS 一致添加全角空格缓冲防爆音
        lang: 'zh-CN',
        rate: this.config.voiceRate ?? 0.8,
        pitch: this.config.voicePitch ?? 0.95
      }
    }
  }

  public startAutoKnock(
    targetCount: number = 0,
    intervalMs?: number,
    cycleTitle?: string
  ): AutoKnockStatus {
    this.stopAutoKnock()

    const interval = intervalMs || this.config.autoKnockIntervalMs || 1200
    this.autoStatus = {
      running: true,
      targetCount,
      currentCount: 0,
      intervalMs: interval,
      cycleTitle: cycleTitle || (targetCount === 0 ? '无尽修持' : `${targetCount} 次圆满`),
      startTime: Date.now()
    }

    this.autoKnockTimer = setInterval(() => {
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
