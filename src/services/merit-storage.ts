import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { DailyMeritRecord, MeritStats } from '../types.js'

export class MeritStorage {
  private storageFile: string
  private dailyRecords: Record<string, number> = {}

  constructor(customPath?: string) {
    if (customPath) {
      this.storageFile = customPath
      const dir = path.dirname(customPath)
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }) } catch {}
      }
    } else {
      const defaultDir = path.join(os.homedir(), '.dsh', 'muyu-data')
      if (!fs.existsSync(defaultDir)) {
        try { fs.mkdirSync(defaultDir, { recursive: true }) } catch {}
      }
      this.storageFile = path.join(defaultDir, 'merit_history.json')
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

  public get todayMerit(): number {
    return this.dailyRecords[this.todayKey] ?? 0
  }

  public get totalMerit(): number {
    return Object.values(this.dailyRecords).reduce((acc, curr) => acc + curr, 0)
  }

  public addMerit(amount: number = 1): { todayMerit: number; totalMerit: number } {
    const key = this.todayKey
    const current = this.dailyRecords[key] ?? 0
    this.dailyRecords[key] = current + amount
    this.save()
    return {
      todayMerit: this.dailyRecords[key],
      totalMerit: this.totalMerit
    }
  }

  public getStats(): MeritStats {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const records: DailyMeritRecord[] = Object.keys(this.dailyRecords)
      .sort()
      .reverse()
      .map(key => {
        const [y, m, d] = key.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const weekday = weekdays[date.getDay()]
        return {
          dateKey: key,
          count: this.dailyRecords[key],
          displayDate: `${m}月${d}日 ${weekday}`
        }
      })

    return {
      todayMerit: this.todayMerit,
      totalMerit: this.totalMerit,
      todayKey: this.todayKey,
      records
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const content = fs.readFileSync(this.storageFile, 'utf-8')
        this.dailyRecords = JSON.parse(content)
      }
    } catch (e) {
      this.dailyRecords = {}
    }
    if (!this.dailyRecords[this.todayKey]) {
      this.dailyRecords[this.todayKey] = 0
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(this.dailyRecords, null, 2), 'utf-8')
    } catch (e) {
      console.error('[dsh-plugin-muyu] Failed to save merit records:', e)
    }
  }
}
