/**
 * In-browser Web Audio synthesized & preset player for Muyu wooden fish.
 * Supports three distinct physical acoustic profiles:
 * - sandalwood (紫檀沉音): deep, warm temple wood resonance
 * - whitewood  (清脆白木): bright, crisp, high-pitched wood block
 * - bell       (古刹清磬): sustained bronze singing bowl / temple bell harmonics
 */

import type { MuyuSoundType } from '../types.js'

export interface SoundPresetOption {
  id: MuyuSoundType
  name: string
  description: string
}

export const CLIENT_SOUND_PRESETS: SoundPresetOption[] = [
  {
    id: 'sandalwood',
    name: '紫檀沉音',
    description: '浑厚沉稳，声如古庙老木，定心凝神'
  },
  {
    id: 'whitewood',
    name: '清脆白木',
    description: '轻盈通透，高频脆爽，提神醒脑'
  },
  {
    id: 'bell',
    name: '古刹清磬',
    description: '悠扬致远，余音绕梁，震荡心扉'
  }
]

export class MuyuWebAudioPlayer {
  private ctx: AudioContext | null = null
  private currentSound: MuyuSoundType = 'sandalwood'
  public volume: number = 1.0

  constructor(initialSound: MuyuSoundType = 'sandalwood') {
    this.currentSound = initialSound
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  public setSoundType(type: MuyuSoundType) {
    if (type === 'sandalwood' || type === 'whitewood' || type === 'bell') {
      this.currentSound = type
    }
  }

  public getSoundType(): MuyuSoundType {
    return this.currentSound
  }

  public getSoundPresets(): SoundPresetOption[] {
    return CLIENT_SOUND_PRESETS
  }

  /**
   * Synthesize real physical wooden fish or temple bell percussion using Web Audio oscillators & filters
   */
  public playWoodenSound(overrideType?: MuyuSoundType) {
    this.initContext()
    if (!this.ctx) return

    const soundType = overrideType || this.currentSound
    const now = this.ctx.currentTime
    const vol = Math.min(1.0, Math.max(0.0, this.volume))
    if (vol <= 0) return

    if (soundType === 'bell') {
      // Bronze temple singing bowl / bell with long harmonic decay
      const fundamental = 528
      const partials = [1.0, 2.756, 5.404]
      const gains = [0.65, 0.25, 0.12]
      const decays = [1.45, 0.85, 0.45]

      partials.forEach((ratio, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(fundamental * ratio, now)

        const peak = gains[idx] * vol
        const decay = decays[idx]
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.linearRampToValueAtTime(peak, now + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0008, now + decay)

        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(now)
        osc.stop(now + decay + 0.05)
      })
      return
    }

    // Wooden fish cavity resonance (sandalwood vs whitewood)
    const isWhitewood = soundType === 'whitewood'
    const baseFreq = isWhitewood ? 340 : 210
    const decayTime = isWhitewood ? 0.24 : 0.36
    const qFactor = isWhitewood ? 6.5 : 4.2

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(baseFreq * 2.15, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.035)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(baseFreq * (isWhitewood ? 1.8 : 1.45), now)
    filter.Q.setValueAtTime(qFactor, now)

    gain.gain.setValueAtTime(0.85 * vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(now)
    osc.stop(now + decayTime + 0.03)
  }

  public dispose() {
    if (this.ctx) {
      const ctxToClose = this.ctx
      this.ctx = null
      try {
        ctxToClose.close().catch(() => {})
      } catch {}
    }
  }
}
