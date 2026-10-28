import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { DailyMeritRecord, MeritStats } from '../types.js'

interface DayBucket {
  merit: number
  tokens: number
}

interface PersistedLedgerV1 {
  version: 1
  days: Record<string, DayBucket>
  pendingTokens: number
}

const MAX_RETAINED_DAYS = 3650

function expandHome(filePath: string): string {
  if (filePath === '~') return os.homedir()
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return filePath
}

export function resolveDefaultStorageFile(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    return path.resolve(expandHome(customPath.trim()))
  }
  const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim().length > 0
    ? path.resolve(expandHome(process.env.DSH_HOME.trim()))
    : path.join(os.homedir(), '.dsh')
  return path.join(dshHome, 'muyu-data', 'merit_history.json')
}

function toSafeNonNegInt(val: unknown): number {
  const num = Number(val)
  if (!Number.isFinite(num) || num <= 0) return 0
  return Math.floor(num)
}

/**
 * Single-host persistent ledger for daily merit, token consumption, and pending token remainder.
 * Multi-process note: assumes a single active DSH host; concurrent writers use last-write-wins via atomic rename.
 */
export class MeritStorage {
  private storageFile: string
  private days: Record<string, DayBucket> = {}
  private _pendingTokens: number = 0

  constructor(customPath?: string) {
    this.storageFile = resolveDefaultStorageFile(customPath)
    const dir = path.dirname(this.storageFile)
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (err) {
        console.warn('[dsh-plugin-muyu] Failed to create storage directory:', dir, err)
      }
    }
    this.load()
  }

  public get todayKey(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  private ensureTodayBucket(): DayBucket {
    const key = this.todayKey
    if (!this.days[key]) {
      this.days[key] = { merit: 0, tokens: 0 }
    }
    return this.days[key]
  }

  public get todayMerit(): number {
    return this.days[this.todayKey]?.merit ?? 0
  }

  public get totalMerit(): number {
    let sum = 0
    for (const bucket of Object.values(this.days)) {
      sum += bucket.merit
    }
    return sum
  }

  public get todayTokens(): number {
    return this.days[this.todayKey]?.tokens ?? 0
  }

  public get totalTokens(): number {
    let sum = 0
    for (const bucket of Object.values(this.days)) {
      sum += bucket.tokens
    }
    return sum
  }

  public get pendingTokens(): number {
    return this._pendingTokens
  }

  public setPendingTokens(pending: number): void {
    this._pendingTokens = toSafeNonNegInt(pending)
    this.save()
  }

  public addMerit(
    amount: number = 1,
    tokens: number = 0,
    pendingTokens?: number
  ): { todayMerit: number; totalMerit: number; todayTokens: number; totalTokens: number; pendingTokens: number } {
    const safeMerit = toSafeNonNegInt(amount)
    const safeTokens = toSafeNonNegInt(tokens)
    const bucket = this.ensureTodayBucket()
    bucket.merit += safeMerit
    bucket.tokens += safeTokens
    if (pendingTokens !== undefined) {
      this._pendingTokens = toSafeNonNegInt(pendingTokens)
    }
    this.pruneOldDays()
    this.save()
    return {
      todayMerit: bucket.merit,
      totalMerit: this.totalMerit,
      todayTokens: bucket.tokens,
      totalTokens: this.totalTokens,
      pendingTokens: this._pendingTokens
    }
  }

  public addTokens(
    tokens: number,
    pendingTokens?: number
  ): { todayTokens: number; totalTokens: number; pendingTokens: number } {
    const safeTokens = toSafeNonNegInt(tokens)
    const bucket = this.ensureTodayBucket()
    bucket.tokens += safeTokens
    if (pendingTokens !== undefined) {
      this._pendingTokens = toSafeNonNegInt(pendingTokens)
    }
    this.pruneOldDays()
    this.save()
    return {
      todayTokens: bucket.tokens,
      totalTokens: this.totalTokens,
      pendingTokens: this._pendingTokens
    }
  }

  public getStats(): MeritStats {
    this.ensureTodayBucket()
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const records: DailyMeritRecord[] = Object.keys(this.days)
      .sort()
      .reverse()
      .map(key => {
        const [y, m, d] = key.split('-').map(Number)
        const date = new Date(y, (m || 1) - 1, d || 1)
        const weekday = weekdays[date.getDay()] || ''
        const bucket = this.days[key]
        return {
          dateKey: key,
          count: bucket.merit,
          displayDate: `${m}月${d}日 ${weekday}`.trim(),
          tokens: bucket.tokens
        }
      })

    return {
      todayMerit: this.todayMerit,
      totalMerit: this.totalMerit,
      todayTokens: this.todayTokens,
      totalTokens: this.totalTokens,
      pendingTokens: this._pendingTokens,
      todayKey: this.todayKey,
      records
    }
  }

  private pruneOldDays() {
    const keys = Object.keys(this.days).sort()
    if (keys.length <= MAX_RETAINED_DAYS) return
    const toRemove = keys.slice(0, keys.length - MAX_RETAINED_DAYS)
    for (const k of toRemove) {
      delete this.days[k]
    }
  }

  private quarantineCorruptFile(reason: unknown) {
    try {
      if (fs.existsSync(this.storageFile)) {
        const corruptPath = `${this.storageFile}.corrupt-${Date.now()}`
        fs.renameSync(this.storageFile, corruptPath)
        console.warn(`[dsh-plugin-muyu] Corrupted merit ledger isolated to ${corruptPath}:`, reason)
      }
    } catch (err) {
      console.warn('[dsh-plugin-muyu] Failed to isolate corrupted merit file:', err)
    }
  }

  private load() {
    this.days = {}
    this._pendingTokens = 0

    if (!fs.existsSync(this.storageFile)) {
      this.ensureTodayBucket()
      return
    }

    try {
      const content = fs.readFileSync(this.storageFile, 'utf-8')
      const parsed = JSON.parse(content)

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Root JSON value must be a plain object')
      }

      if (parsed.version === 1 && parsed.days && typeof parsed.days === 'object' && !Array.isArray(parsed.days)) {
        // Current V1 schema
        for (const [k, v] of Object.entries(parsed.days as Record<string, any>)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object') {
            this.days[k] = {
              merit: toSafeNonNegInt(v.merit),
              tokens: toSafeNonNegInt(v.tokens)
            }
          }
        }
        this._pendingTokens = toSafeNonNegInt(parsed.pendingTokens)
      } else if (
        (parsed.merit && typeof parsed.merit === 'object') ||
        (parsed.tokens && typeof parsed.tokens === 'object')
      ) {
        // Intermediate dual-map format { merit: {}, tokens: {} }
        const meritMap = (parsed.merit && typeof parsed.merit === 'object') ? parsed.merit : {}
        const tokenMap = (parsed.tokens && typeof parsed.tokens === 'object') ? parsed.tokens : {}
        const allKeys = new Set([...Object.keys(meritMap), ...Object.keys(tokenMap)])
        for (const k of allKeys) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
            this.days[k] = {
              merit: toSafeNonNegInt(meritMap[k]),
              tokens: toSafeNonNegInt(tokenMap[k])
            }
          }
        }
        this._pendingTokens = toSafeNonNegInt(parsed.pendingTokens)
        this.save()
      } else {
        // Legacy flat format { "YYYY-MM-DD": number }
        let validLegacy = true
        for (const [k, v] of Object.entries(parsed)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) {
            this.days[k] = {
              merit: toSafeNonNegInt(v),
              tokens: 0
            }
          } else {
            validLegacy = false
            break
          }
        }
        if (!validLegacy) {
          throw new Error('Unrecognized merit_history.json structure')
        }
        this.save()
      }
    } catch (e) {
      this.quarantineCorruptFile(e)
      this.days = {}
      this._pendingTokens = 0
    }

    this.ensureTodayBucket()
  }

  private save() {
    try {
      const dir = path.dirname(this.storageFile)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const payload: PersistedLedgerV1 = {
        version: 1,
        days: this.days,
        pendingTokens: this._pendingTokens
      }
      const tmpFile = `${this.storageFile}.tmp-${process.pid}-${Date.now()}`
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8')
      fs.renameSync(tmpFile, this.storageFile)
    } catch (e) {
      console.error('[dsh-plugin-muyu] Failed to save merit records:', e)
    }
  }
}
