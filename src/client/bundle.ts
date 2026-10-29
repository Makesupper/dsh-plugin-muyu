/**
 * DSH Official Client Bundle entry
 * Complies with DSH lazy CJS model: window.__ModuleLoader__.load({ id, factory })
 *
 * Single-ledger design: the Host's merit_history.json is the only ledger.
 * This bundle never computes tokens or merit locally; it reads /dsh-muyu/state
 * and posts knocks/auto/sutra changes back to the Host. Token consumption on
 * the Host therefore drives the widget animation through the polled state diff.
 */

import { createMuyuFloatingPet, type MeritHistoryItem, type WidgetOptions } from './widget-ui.js'
import { MuyuWebAudioPlayer } from './sound-player.js'
import { SutraSpeechSynthesizer } from './speech-synthesizer.js'
import { allBooks } from '../data/sutras.js'
import { formatMeritCount, formatTokenLabel } from '../format.js'
import type { MuyuSoundType } from '../types.js'

const API_BASE = '/dsh-muyu'
const POLL_INTERVAL_MS = 800
const MAX_VISUAL_BURST = 12
const LEGACY_MERIT_KEY = 'dsh_muyu_client_merit'
const PREF_KEY = 'dsh_muyu_client_prefs'

interface ClientPreferences {
  soundId: MuyuSoundType
  soundEnabled: boolean
  voiceId: string
  voiceEnabled: boolean
  rate: number
  pitch: number
  volume: number
}

interface ServerSentence {
  id: number
  text: string
  bookId: string
  bookTitle: string
}

interface ServerState {
  todayMerit: number
  totalMerit: number
  todayTokens: number
  totalTokens: number
  pendingTokens: number
  tokensPerMerit: number
  todayKey: string
  bookId: string
  bookTitle: string
  currentSentence: ServerSentence
  lastSentence: ServerSentence | null
  apiVersion?: number
  chantSeq: number
  auto: {
    running: boolean
    targetCount: number
    currentCount: number
    intervalMs: number
    cycleTitle: string
  }
  records?: MeritHistoryItem[]
}

function buildExports(_require?: any) {
  return {
    name: 'muyu-client',
    inject: ['slots'],
    apply(ctx: any) {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return
      }

      let prefs: ClientPreferences = {
        soundId: 'sandalwood',
        soundEnabled: true,
        voiceId: '',
        voiceEnabled: true,
        rate: 0.72,
        pitch: 0.92,
        volume: 1.0
      }

      try {
        const savedPrefs = localStorage.getItem(PREF_KEY)
        if (savedPrefs) {
          const parsed = JSON.parse(savedPrefs)
          if (parsed && typeof parsed === 'object') {
            prefs = { ...prefs, ...parsed }
          }
        }
        // The old local merit ledger is obsolete: the Host ledger is authoritative now.
        localStorage.removeItem(LEGACY_MERIT_KEY)
      } catch {}

      const savePrefs = () => {
        try {
          localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
        } catch {}
      }

      const audioPlayer = new MuyuWebAudioPlayer(prefs.soundId)
      audioPlayer.volume = prefs.volume
      audioPlayer.muted = !prefs.soundEnabled

      const speechSynth = new SutraSpeechSynthesizer({
        rate: prefs.rate,
        pitch: prefs.pitch,
        volume: prefs.volume,
        voiceId: prefs.voiceId
      })
      speechSynth.enabled = prefs.voiceEnabled

      const transport = (globalThis as any).__DSH_TRANSPORT__
      const fetchImpl: any =
        transport && typeof transport.fetch === 'function'
          ? transport.fetch.bind(transport)
          : typeof fetch === 'function'
            ? fetch.bind(globalThis)
            : undefined

      let serverState: ServerState | null = null
      let historyRecords: MeritHistoryItem[] = []
      let currentBook = allBooks[0]
      let lastMerit = -1
      let lastTokens = -1
      let meritInitialized = false
      let lastChantSeq = -1
      let displaySentenceText: string | null = null
      let pendingSentenceText: string | null = null
      let speechGeneration = 0
      let alive = true
      let pollTimer: ReturnType<typeof setInterval> | null = null
      let pollInFlight = false
      let historyInFlight = false
      const burstTimers = new Set<ReturnType<typeof setTimeout>>()

      async function apiRequest(path: string, init: { method?: string; body?: string } = {}): Promise<any> {
        if (!fetchImpl) throw new Error('fetch unavailable')
        const headers: Record<string, string> = { accept: 'application/json' }
        if (init.body !== undefined) {
          headers['content-type'] = 'application/json'
        }
        const response = await fetchImpl(`${API_BASE}${path}`, {
          method: init.method || 'GET',
          headers,
          body: init.body,
          credentials: 'same-origin'
        })
        if (!response || !response.ok) {
          const error: any = new Error(`muyu api HTTP ${response?.status ?? '???'}`)
          error.status = response?.status
          throw error
        }
        return (await response.json()) as ServerState
      }

      async function refreshHistory(): Promise<void> {
        if (historyInFlight) return
        historyInFlight = true
        try {
          const next = await apiRequest('/state?history=1')
          if (Array.isArray(next.records)) {
            historyRecords = next.records
          }
        } catch {
        } finally {
          historyInFlight = false
        }
      }

      function updatePetView(): void {
        const state = serverState
        const sentence = displaySentenceText || state?.currentSentence?.text || currentBook.sentences[0] || ''
        pet.update(
          state?.todayMerit ?? 0,
          sentence,
          state?.auto?.running ?? false,
          { todayTokens: state?.todayTokens ?? 0, totalTokens: state?.totalTokens ?? 0 }
        )
      }

      function speak(text: string | undefined, onEnd?: () => void): void {
        if (!text || !speechSynth.enabled) {
          onEnd?.()
          return
        }
        if (speechSynth.isSpeaking()) return
        const generation = ++speechGeneration
        speechSynth.chantSentence(text, () => {
          if (generation !== speechGeneration || !alive) return
          onEnd?.()
        })
      }

      function finishSpeechDisplay(): void {
        if (!alive) return
        if (pendingSentenceText !== null) {
          displaySentenceText = pendingSentenceText
          updatePetView()
        }
      }

      function animateMeritLoss(loss: number, tokenDelta: number): void {
        if (!alive) return
        pet.triggerKnockEffect(`⚡ ${formatTokenLabel(tokenDelta)} · 功德 -${formatMeritCount(loss)}`)
        updatePetView()
      }

      function animateMerit(delta: number, tokenDelta: number): void {
        const count = Math.min(delta, MAX_VISUAL_BURST)
        for (let i = 0; i < count; i++) {
          const timer = setTimeout(() => {
            burstTimers.delete(timer)
            if (!alive) return
            audioPlayer.playWoodenSound()
            pet.animateKnock()
            if (i === 0) {
              const label =
                tokenDelta > 0
                  ? `⚡ ${formatTokenLabel(tokenDelta)} · 功德 +${formatMeritCount(delta)}`
                  : `功德 +${formatMeritCount(delta)}`
              pet.triggerKnockEffect(label)
            } else {
              pet.triggerKnockEffect(`功德 +${formatMeritCount(1)}`)
            }
            updatePetView()
          }, i * 130)
          burstTimers.add(timer)
        }
        if (delta > count) {
          const timer = setTimeout(() => {
            burstTimers.delete(timer)
            if (!alive) return
            pet.triggerKnockEffect(`功德 +${formatMeritCount(delta)}`)
          }, 450)
          burstTimers.add(timer)
        }
      }

      function applyState(
        next: ServerState,
        opts: {
          animate?: boolean
          speak?: boolean
          speakSentence?: ServerSentence
          resetDisplay?: boolean
          mergeHistory?: boolean
        } = {}
      ): void {
        if (!alive || !next) return
        const prevMerit = lastMerit
        const prevTokens = lastTokens
        const chantChanged = typeof next.chantSeq === 'number' && next.chantSeq !== lastChantSeq
        const bookChanged = !!next.bookId && next.bookId !== serverState?.bookId
        serverState = next

        if (next.bookId) {
          widgetOptions.currentBookId = next.bookId
          const book = allBooks.find(b => b.id === next.bookId)
          if (book) currentBook = book
        }
        if (opts.mergeHistory && Array.isArray(next.records)) {
          historyRecords = next.records
        }

        if (opts.animate && meritInitialized) {
          const tokenDelta = Math.max(0, next.todayTokens - prevTokens)
          if (next.todayMerit > prevMerit) {
            animateMerit(next.todayMerit - prevMerit, tokenDelta)
          } else if (next.todayMerit < prevMerit) {
            animateMeritLoss(prevMerit - next.todayMerit, tokenDelta)
          }
        }

        lastMerit = next.todayMerit
        lastTokens = next.todayTokens
        meritInitialized = true
        lastChantSeq = next.chantSeq

        const currentText = next.currentSentence?.text || ''
        if (opts.speakSentence) {
          // A manual knock: keep the spoken sentence in the bubble, then advance to the
          // server's next sentence when that sentence finishes.
          pendingSentenceText = currentText
          if (!speechSynth.isSpeaking()) {
            displaySentenceText = opts.speakSentence.text
            speak(displaySentenceText, finishSpeechDisplay)
          }
        } else if (opts.speak && chantChanged) {
          // Token/auto knocks: same pacing as a manual knock.
          pendingSentenceText = currentText
          if (!speechSynth.isSpeaking()) {
            displaySentenceText = next.lastSentence?.text || currentText
            speak(displaySentenceText, finishSpeechDisplay)
          }
        } else if (opts.resetDisplay || bookChanged || displaySentenceText === null) {
          displaySentenceText = currentText
          pendingSentenceText = currentText
        }

        updatePetView()
        if (next.todayMerit !== prevMerit) {
          void refreshHistory()
        }
      }

      const widgetOptions: WidgetOptions = {
        sutraList: allBooks,
        currentBookId: currentBook.id,
        initialVoiceEnabled: prefs.voiceEnabled,
        initialSoundEnabled: prefs.soundEnabled,
        getTokensPerMerit: () => serverState?.tokensPerMerit ?? 10000,
        isTokensPerMeritSupported: () => (serverState?.apiVersion ?? 1) >= 2,
        onSetTokensPerMerit: async (value: number) => {
          try {
            const res = await apiRequest('/tokens-per-merit', {
              method: 'POST',
              body: JSON.stringify({ value })
            })
            applyState(res.state, { animate: false })
            return true
          } catch (error: any) {
            const status = Number(error?.status)
            pet.triggerKnockEffect(
              status === 404 || status === 405 ? 'Host 未加载阈值接口，请重启 DSH' : '阈值保存失败'
            )
            return false
          }
        },
        getMeritRecords: () => ({
          todayMerit: serverState?.todayMerit ?? 0,
          totalMerit: serverState?.totalMerit ?? 0,
          todayTokens: serverState?.todayTokens ?? 0,
          totalTokens: serverState?.totalTokens ?? 0,
          pendingTokens: serverState?.pendingTokens ?? 0,
          records: historyRecords
        }),
        onKnock: () => {
          audioPlayer.playWoodenSound()
          void (async () => {
            try {
              const res = await apiRequest('/knock', {
                method: 'POST',
                body: JSON.stringify({ count: 1 })
              })
              applyState(res.state, {
                animate: false,
                speakSentence: res.knock?.currentSentence
              })
            } catch {
              pet.triggerKnockEffect('服务端未响应')
            }
          })()
        },
        onToggleAuto: () => {
          const action = serverState?.auto?.running ? 'stop' : 'start'
          void (async () => {
            try {
              const res = await apiRequest('/auto', {
                method: 'POST',
                body: JSON.stringify({ action })
              })
              applyState(res.state, { animate: false })
            } catch {
              pet.triggerKnockEffect('服务端未响应')
            }
          })()
        },
        onToggleVoice: (enabled: boolean) => {
          prefs.voiceEnabled = enabled
          speechSynth.enabled = enabled
          savePrefs()
          if (!enabled) {
            speechSynth.stop()
          }
        },
        onToggleSound: (enabled: boolean) => {
          prefs.soundEnabled = enabled
          audioPlayer.muted = !enabled
          savePrefs()
        },
        onSelectSutra: (bookId: string) => {
          widgetOptions.currentBookId = bookId
          void (async () => {
            try {
              const res = await apiRequest('/sutra', {
                method: 'POST',
                body: JSON.stringify({ bookId })
              })
              applyState(res.state, { animate: false, resetDisplay: true })
            } catch {
              pet.triggerKnockEffect('切换失败')
              void refreshStateSoon()
            }
          })()
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
            speak(serverState?.lastSentence?.text || serverState?.currentSentence?.text)
          }
        },
        onOpenMerit: () => {
          void refreshHistory()
        }
      }

      const pet = createMuyuFloatingPet(widgetOptions)

      async function refreshStateSoon(): Promise<void> {
        try {
          const next = await apiRequest('/state')
          applyState(next, { animate: false, resetDisplay: true })
        } catch {}
      }

      async function poll(): Promise<void> {
        if (!alive || pollInFlight) return
        pollInFlight = true
        try {
          const next = await apiRequest('/state')
          applyState(next, { animate: true, speak: true })
        } catch {
          // Transient Host restart / route not mounted yet; keep the last good state.
        } finally {
          pollInFlight = false
        }
      }

      function startPolling(): void {
        if (pollTimer !== null || !alive) return
        pollTimer = setInterval(() => {
          void poll()
        }, POLL_INTERVAL_MS)
        void poll()
      }

      async function boot(): Promise<void> {
        try {
          const next = await apiRequest('/state?history=1')
          applyState(next, { animate: false, mergeHistory: true, resetDisplay: true })
        } catch (error) {
          console.warn('[dsh-plugin-muyu:client] 服务端功德簿暂不可用，稍后自动重试', error)
        }
        startPolling()
      }

      const mount = () => {
        pet.mount(document.body)
        updatePetView()
        void boot()
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', mount, { once: true })
      } else {
        mount()
      }

      const cleanup = () => {
        alive = false
        if (pollTimer !== null) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        for (const timer of burstTimers) {
          clearTimeout(timer)
        }
        burstTimers.clear()
        speechSynth.dispose()
        audioPlayer.dispose()
        pet.unmount()
      }

      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => cleanup)
      }

      console.log('[dsh-plugin-muyu:client] 木鱼挂件已加载：账本与服务端 /dsh-muyu/state 同源，Token 度化实时同步')
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
