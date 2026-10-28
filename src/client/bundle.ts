/**
 * DSH Official Client Bundle entry
 * Complies with DSH lazy CJS model: window.__ModuleLoader__.load({ id, factory })
 */

import { createMuyuFloatingPet, type MeritHistoryItem } from './widget-ui.js'
import { MuyuWebAudioPlayer } from './sound-player.js'
import { SutraSpeechSynthesizer } from './speech-synthesizer.js'
import { allBooks } from '../data/sutras.js'
import type { MuyuSoundType } from '../types.js'

const MAX_CLIENT_BURST_KNOCKS = 108

export function getLocalDateKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getLocalDisplayDate(now: Date = new Date()): string {
  return now.toLocaleDateString('zh-CN')
}

export function computePendingAndKnocks(
  pendingTokens: number,
  deltaTokens: number,
  tokensPerMerit: number = 10000,
  maxKnocks: number = MAX_CLIENT_BURST_KNOCKS
): { knocks: number; nextPending: number } {
  const safePending = Number.isFinite(pendingTokens) && pendingTokens > 0 ? Math.floor(pendingTokens) : 0
  const safeDelta = Number.isFinite(deltaTokens) && deltaTokens > 0 ? Math.round(deltaTokens) : 0
  const safeStep = Number.isFinite(tokensPerMerit) && tokensPerMerit > 0 ? Math.floor(tokensPerMerit) : 10000
  const total = safePending + safeDelta
  const rawKnocks = Math.floor(total / safeStep)
  const knocks = Math.min(maxKnocks, rawKnocks)
  const nextPending = total - knocks * safeStep
  return { knocks, nextPending }
}

interface ClientPreferences {
  soundId: MuyuSoundType
  bookId: string
  voiceId: string
  voiceEnabled: boolean
  rate: number
  pitch: number
  volume: number
  tokensPerMerit: number
}

function buildExports(_require?: any) {
  return {
    name: 'muyu-client',
    inject: ['slots'],
    apply(ctx: any) {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return
      }

      const STORAGE_KEY = 'dsh_muyu_client_merit'
      const PREF_KEY = 'dsh_muyu_client_prefs'

      let prefs: ClientPreferences = {
        soundId: 'sandalwood',
        bookId: 'heart_sutra',
        voiceId: '',
        voiceEnabled: true,
        rate: 0.72,
        pitch: 0.92,
        volume: 1.0,
        tokensPerMerit: 10000
      }

      try {
        const savedPrefs = localStorage.getItem(PREF_KEY)
        if (savedPrefs) {
          const parsed = JSON.parse(savedPrefs)
          if (parsed && typeof parsed === 'object') {
            prefs = { ...prefs, ...parsed }
          }
        }
      } catch {}

      const savePrefs = () => {
        try {
          localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
        } catch {}
      }

      const audioPlayer = new MuyuWebAudioPlayer(prefs.soundId)
      audioPlayer.volume = prefs.volume

      const speechSynth = new SutraSpeechSynthesizer({
        rate: prefs.rate,
        pitch: prefs.pitch,
        volume: prefs.volume,
        voiceId: prefs.voiceId
      })
      speechSynth.enabled = prefs.voiceEnabled

      let meritData = {
        todayMerit: 0,
        totalMerit: 0,
        todayTokens: 0,
        totalTokens: 0,
        pendingTokens: 0,
        records: [] as MeritHistoryItem[],
        lastDateKey: getLocalDateKey()
      }

      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && typeof parsed === 'object') {
            meritData = { ...meritData, ...parsed }
            const todayKey = getLocalDateKey()
            // Reconcile day rollover using unified local YYYY-MM-DD key
            if (meritData.lastDateKey !== todayKey) {
              const todayRecord = meritData.records.find(r => r.dateKey === todayKey)
              meritData.todayMerit = todayRecord?.count ?? 0
              meritData.todayTokens = todayRecord?.tokens ?? 0
              meritData.lastDateKey = todayKey
            }
          }
        }
      } catch {}

      const reconcileDayRollover = () => {
        const todayKey = getLocalDateKey()
        if (meritData.lastDateKey !== todayKey) {
          const todayRecord = meritData.records.find(r => r.dateKey === todayKey)
          meritData.todayMerit = todayRecord?.count ?? 0
          meritData.todayTokens = todayRecord?.tokens ?? 0
          meritData.lastDateKey = todayKey
        }
      }

      const saveMerit = (count: number = 1, tokens: number = 0) => {
        reconcileDayRollover()
        const now = new Date()
        const dateKey = getLocalDateKey(now)
        const displayDate = getLocalDisplayDate(now)

        const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
        const safeTokens = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0

        meritData.todayMerit += safeCount
        meritData.totalMerit += safeCount
        if (safeTokens > 0) {
          meritData.todayTokens = (meritData.todayTokens || 0) + safeTokens
          meritData.totalTokens = (meritData.totalTokens || 0) + safeTokens
        }

        let rec = meritData.records.find(r => r.dateKey === dateKey)
        if (!rec) {
          rec = { dateKey, displayDate, count: 0, tokens: 0 }
          meritData.records.unshift(rec)
        }
        rec.count += safeCount
        if (safeTokens > 0) {
          rec.tokens = (rec.tokens || 0) + safeTokens
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(meritData))
        } catch {}
      }

      let currentBook = allBooks.find(b => b.id === prefs.bookId) || allBooks[0]
      let currentSentenceIndex = 0
      let isAuto = false
      let autoTimer: ReturnType<typeof setInterval> | null = null
      const burstTimers = new Set<ReturnType<typeof setTimeout>>()

      const clearBurstTimers = () => {
        for (const t of burstTimers) {
          clearTimeout(t)
        }
        burstTimers.clear()
      }

      const updatePetView = () => {
        pet.update(
          meritData.todayMerit,
          currentBook.sentences[currentSentenceIndex],
          isAuto,
          { todayTokens: meritData.todayTokens || 0, totalTokens: meritData.totalTokens || 0 }
        )
      }

      const chantNextSentence = () => {
        const sentence = currentBook.sentences[currentSentenceIndex]
        speechSynth.chantSentence(sentence, () => {
          currentSentenceIndex = (currentSentenceIndex + 1) % currentBook.sentences.length
          updatePetView()
          if (isAuto) {
            chantNextSentence()
          }
        })
      }

      const handleKnock = () => {
        saveMerit(1, 0)
        audioPlayer.playWoodenSound()
        updatePetView()

        if (!speechSynth.isSpeaking()) {
          chantNextSentence()
        }
      }

      // Client-side helper to feed token counts into the floating widget with smooth burst throttling
      const feedTokensToClientPet = (tokens: number, tokensPerMerit: number = prefs.tokensPerMerit || 10000) => {
        const safeTokens = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0
        if (safeTokens <= 0) return

        const { knocks, nextPending } = computePendingAndKnocks(
          meritData.pendingTokens || 0,
          safeTokens,
          tokensPerMerit,
          MAX_CLIENT_BURST_KNOCKS
        )
        meritData.pendingTokens = nextPending

        saveMerit(0, safeTokens)
        if (knocks <= 0) {
          updatePetView()
          return
        }

        const safeStep = Number.isFinite(tokensPerMerit) && tokensPerMerit > 0 ? Math.floor(tokensPerMerit) : 10000
        for (let i = 0; i < knocks; i++) {
          const timer = setTimeout(() => {
            burstTimers.delete(timer)
            saveMerit(1, 0)
            audioPlayer.playWoodenSound()
            pet.animateKnock()
            pet.triggerKnockEffect(`⚡ Token +${safeStep.toLocaleString()} · 功德 +1`)
            updatePetView()
            if (!speechSynth.isSpeaking()) {
              chantNextSentence()
            }
          }, i * 130)
          burstTimers.add(timer)
        }
      }

      if (typeof window !== 'undefined') {
        ;(window as any).__dsh_muyu_feed_tokens__ = feedTokensToClientPet
      }

      const pet = createMuyuFloatingPet({
        sutraList: allBooks,
        currentBookId: currentBook.id,
        initialVoiceEnabled: prefs.voiceEnabled,
        getMeritRecords: () => ({
          todayMerit: meritData.todayMerit,
          totalMerit: meritData.totalMerit,
          todayTokens: meritData.todayTokens || 0,
          totalTokens: meritData.totalTokens || 0,
          pendingTokens: meritData.pendingTokens || 0,
          records: meritData.records
        }),
        onKnock: () => {
          handleKnock()
        },
        onToggleAuto: () => {
          isAuto = !isAuto
          if (isAuto) {
            handleKnock()
            pet.triggerKnockEffect('功德 +1')
            autoTimer = setInterval(() => {
              saveMerit(1, 0)
              audioPlayer.playWoodenSound()
              pet.animateKnock()
              pet.triggerKnockEffect('功德 +1')
              updatePetView()
            }, 1300)
            if (!speechSynth.isSpeaking()) {
              chantNextSentence()
            }
          } else {
            if (autoTimer) {
              clearInterval(autoTimer)
              autoTimer = null
            }
            speechSynth.stop()
          }
          updatePetView()
        },
        onToggleVoice: (enabled: boolean) => {
          prefs.voiceEnabled = enabled
          speechSynth.enabled = enabled
          savePrefs()
          if (!enabled) {
            speechSynth.stop()
          }
        },
        onSelectSutra: (bookId: string) => {
          const found = allBooks.find(b => b.id === bookId)
          if (found) {
            currentBook = found
            prefs.bookId = found.id
            savePrefs()
            currentSentenceIndex = 0
            speechSynth.stop()
            updatePetView()
            if (isAuto) {
              chantNextSentence()
            }
          }
        },
        getSoundPresets: () => {
          return audioPlayer.getSoundPresets()
        },
        getCurrentSoundId: () => {
          return audioPlayer.getSoundType()
        },
        onSelectSound: (soundId: MuyuSoundType) => {
          audioPlayer.setSoundType(soundId)
          prefs.soundId = soundId
          savePrefs()
          audioPlayer.playWoodenSound(soundId)
        },
        getVoiceList: () => {
          return speechSynth.getAvailableVoiceOptions()
        },
        getCurrentVoiceId: () => {
          return speechSynth.getSelectedVoiceId()
        },
        onSelectVoice: (voiceId: string) => {
          speechSynth.setVoice(voiceId)
          prefs.voiceId = voiceId
          savePrefs()
          if (speechSynth.isSpeaking()) {
            speechSynth.stop()
            chantNextSentence()
          }
        }
      })

      const mount = () => {
        pet.mount(document.body)
        updatePetView()
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', mount, { once: true })
      } else {
        mount()
      }

      // Full cleanup on unload / HMR reload
      const cleanup = () => {
        if (autoTimer) {
          clearInterval(autoTimer)
          autoTimer = null
        }
        clearBurstTimers()
        speechSynth.dispose()
        audioPlayer.dispose()
        pet.unmount()
        if (typeof window !== 'undefined' && (window as any).__dsh_muyu_feed_tokens__ === feedTokensToClientPet) {
          delete (window as any).__dsh_muyu_feed_tokens__
        }
      }

      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => cleanup)
      }

      console.log('[dsh-plugin-muyu:client] 3D 木鱼挂件已完全加载（包含木槌交互、功德簿、经典宝库、三种音色与连贯诵经）')
    }
  }
}

export const name = 'muyu-client'
export const inject = ['slots']
export function apply(ctx: any) {
  return buildExports().apply(ctx)
}

if (typeof window !== 'undefined' && (window as any).__ModuleLoader__) {
  ;(window as any).__ModuleLoader__.load({
    id: 'dsh-plugin-muyu',
    factory: (require: any) => buildExports(require)
  })
}
