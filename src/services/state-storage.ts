import fs from 'node:fs'
import path from 'node:path'
import { resolveDefaultStorageFile } from './merit-storage.js'
import type { MuyuSoundType } from '../types.js'

export interface RuntimeState {
  bookId?: string
  sentenceIndex?: number
  soundType?: MuyuSoundType
}

export function resolveRuntimeStateFile(storagePath?: string): string {
  return `${resolveDefaultStorageFile(storagePath)}.state.json`
}

/**
 * Small last-write-wins companion file for the widget's current sutra position and sound.
 * It is intentionally separate from the merit ledger: merit is a shared, locked counter,
 * while the reading position is a per-user UI preference and can be overwritten safely.
 */
export class RuntimeStateStorage {
  private file: string

  constructor(storagePath?: string) {
    this.file = resolveRuntimeStateFile(storagePath)
  }

  public get path(): string {
    return this.file
  }

  public load(): RuntimeState {
    try {
      if (!fs.existsSync(this.file)) return {}
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
      const soundType = parsed.soundType
      return {
        bookId: typeof parsed.bookId === 'string' ? parsed.bookId : undefined,
        sentenceIndex:
          typeof parsed.sentenceIndex === 'number' && Number.isFinite(parsed.sentenceIndex)
            ? Math.max(0, Math.floor(parsed.sentenceIndex))
            : undefined,
        soundType:
          soundType === 'sandalwood' || soundType === 'whitewood' || soundType === 'bell'
            ? soundType
            : undefined
      }
    } catch (error) {
      console.warn('[dsh-plugin-muyu] Failed to read runtime state:', error)
      return {}
    }
  }

  public save(state: Required<RuntimeState>): void {
    try {
      const dir = path.dirname(this.file)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const payload = {
        version: 1,
        bookId: state.bookId,
        sentenceIndex: Math.max(0, Math.floor(state.sentenceIndex)),
        soundType: state.soundType,
        updatedAt: Date.now()
      }
      const tmpFile = `${this.file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8')
      fs.renameSync(tmpFile, this.file)
    } catch (error) {
      console.warn('[dsh-plugin-muyu] Failed to save runtime state:', error)
    }
  }
}
