import type { MuyuService } from './muyu-service.js'
import type { AutoKnockStatus, DailyMeritRecord, SutraSentence } from '../types.js'

/**
 * Browser-facing JSON API for the floating widget.
 *
 * The host ledger is the single source of truth: the widget reads this state
 * and posts knocks/auto/sutra changes back here. There is deliberately no
 * second (localStorage) merit ledger on the client.
 */
export const MUYU_API_PREFIX = '/dsh-muyu'

export interface MuyuClientState {
  todayMerit: number
  totalMerit: number
  todayTokens: number
  totalTokens: number
  pendingTokens: number
  tokensPerMerit: number
  todayKey: string
  bookId: string
  bookTitle: string
  currentSentence: SutraSentence
  lastSentence: SutraSentence | null
  chantSeq: number
  auto: AutoKnockStatus
  records?: DailyMeritRecord[]
}

type JsonRequest = {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  on(event: string, listener: (...args: any[]) => void): unknown
}

type JsonResponse = {
  statusCode?: number
  headersSent?: boolean
  writeHead(status: number, headers: Record<string, string>): unknown
  end(body?: string): unknown
}

const MAX_BODY_CHARS = 8 * 1024
const MAX_CYCLE_TITLE = 80
const MAX_BOOK_ID = 64
const MAX_ACTION_CHARS = 16

export function buildMuyuState(muyu: MuyuService, includeHistory: boolean = false): MuyuClientState {
  const stats = muyu.getMeritStats()
  const book = muyu.getSutra()
  return {
    todayMerit: stats.todayMerit,
    totalMerit: stats.totalMerit,
    todayTokens: stats.todayTokens,
    totalTokens: stats.totalTokens,
    pendingTokens: stats.pendingTokens,
    tokensPerMerit: muyu.getTokensPerMerit(),
    todayKey: stats.todayKey,
    bookId: book.id,
    bookTitle: book.title,
    currentSentence: muyu.getCurrentSentence(),
    lastSentence: muyu.getLastChantedSentence(),
    chantSeq: muyu.getChantSeq(),
    auto: muyu.getAutoKnockStatus(),
    ...(includeHistory ? { records: stats.records } : {})
  }
}

function sendJson(res: JsonResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  res.end(body)
}

function readJsonBody(req: JsonRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let text = ''
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const decoder = new TextDecoder('utf-8')
    req.on('data', (chunk: any) => {
      if (settled) return
      text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
      if (text.length > MAX_BODY_CHARS) {
        fail(new Error('request body too large'))
      }
    })
    req.on('end', () => {
      if (settled) return
      text += decoder.decode()
      settled = true
      if (text.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', (error: any) => fail(error instanceof Error ? error : new Error(String(error))))
  })
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.floor(num)))
}

function headerValue(req: JsonRequest, name: string): string | undefined {
  const value = req.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

function expectedOrigin(webServer: any): URL | null {
  try {
    if (typeof webServer?.getOrigin === 'function') {
      const origin = webServer.getOrigin()
      if (origin) return new URL(String(origin))
    }
  } catch {}
  try {
    const protocol = typeof webServer?.protocol === 'string' ? webServer.protocol : 'http:'
    const host = webServer?.host
    const port = webServer?.port
    if (host && port !== undefined) {
      return new URL(`${protocol}//${host}:${port}`)
    }
  } catch {}
  return null
}

let warnedMissingOrigin = false

function warnMissingOrigin(): void {
  if (warnedMissingOrigin) return
  warnedMissingOrigin = true
  console.warn(
    '[dsh-plugin-muyu] webserver origin is unavailable; falling back to loopback-only Host/Origin checks'
  )
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

function defaultPort(url: URL): string {
  return url.port || (url.protocol === 'https:' ? '443' : '80')
}

function allowedHost(req: JsonRequest, webServer: any): boolean {
  const host = (headerValue(req, 'host') || '').trim().toLowerCase()
  if (!host) return false
  const expected = expectedOrigin(webServer)
  if (!expected) {
    warnMissingOrigin()
    if (host === 'dsh-app') return true
    try {
      return isLoopbackHostname(new URL(`http://${host}`).hostname)
    } catch {
      return false
    }
  }
  if (host === expected.host.toLowerCase()) return true
  const port = defaultPort(expected)
  return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host)
}

function allowedOrigin(req: JsonRequest, webServer: any): boolean {
  const origin = headerValue(req, 'origin')
  // Electron's dsh-app:// protocol bridge forwards requests without an Origin header.
  if (!origin) return true
  if (origin === 'dsh-app://app') return true
  const expected = expectedOrigin(webServer)
  if (!expected) {
    warnMissingOrigin()
    try {
      const parsed = new URL(origin)
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && isLoopbackHostname(parsed.hostname)
    } catch {
      return false
    }
  }
  if (origin === expected.origin) return true
  try {
    const parsed = new URL(origin)
    if (parsed.protocol !== expected.protocol) return false
    return defaultPort(parsed) === defaultPort(expected) && isLoopbackHostname(parsed.hostname)
  } catch {
    return false
  }
}

function requireJsonContentType(req: JsonRequest, res: JsonResponse): boolean {
  const contentType = (headerValue(req, 'content-type') || '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    sendJson(res, 415, { error: 'content-type must be application/json' })
    return false
  }
  return true
}

function checkRequestOrigin(req: JsonRequest, res: JsonResponse, webServer: any): boolean {
  if (!allowedHost(req, webServer)) {
    sendJson(res, 403, { error: 'forbidden host' })
    return false
  }
  if (!allowedOrigin(req, webServer)) {
    sendJson(res, 403, { error: 'forbidden origin' })
    return false
  }
  return true
}

function methodNotAllowed(res: JsonResponse, allowed: string): void {
  sendJson(res, 405, { error: `method not allowed; use ${allowed}` })
}

function guard(handler: (req: JsonRequest, res: JsonResponse) => Promise<void> | void) {
  return (req: JsonRequest, res: JsonResponse): void => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((error: any) => {
        const message = error instanceof Error ? error.message : String(error)
        if (!res.headersSent) {
          sendJson(res, 400, { error: message })
        } else {
          res.end()
        }
      })
  }
}

export function createMuyuRouteHandlers(muyu: MuyuService, webServer?: any) {
  const state = guard(async (req, res) => {
    if (!checkRequestOrigin(req, res, webServer)) return
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    const url = new URL(req.url || `${MUYU_API_PREFIX}/state`, 'http://localhost')
    const includeHistory = url.searchParams.get('history') === '1'
    sendJson(res, 200, buildMuyuState(muyu, includeHistory))
  })

  const knock = guard(async (req, res) => {
    if (!checkRequestOrigin(req, res, webServer)) return
    if ((req.method || '').toUpperCase() !== 'POST') {
      methodNotAllowed(res, 'POST')
      return
    }
    if (!requireJsonContentType(req, res)) return
    const body = await readJsonBody(req)
    const count = clampInteger(body?.count, 1, 1, 108)
    const result = muyu.knock(count)
    sendJson(res, 200, {
      state: buildMuyuState(muyu),
      knock: {
        amount: result.amount,
        currentSentence: result.currentSentence,
        cycleCompleted: result.cycleCompleted,
        completedCycles: result.completedCycles
      }
    })
  })

  const auto = guard(async (req, res) => {
    if (!checkRequestOrigin(req, res, webServer)) return
    if ((req.method || '').toUpperCase() !== 'POST') {
      methodNotAllowed(res, 'POST')
      return
    }
    if (!requireJsonContentType(req, res)) return
    const body = await readJsonBody(req)
    const action = String(body?.action || 'status')
    if (action.length > MAX_ACTION_CHARS) {
      sendJson(res, 400, { error: 'action is too long' })
      return
    }
    if (action === 'start') {
      const targetCount = clampInteger(body?.targetCount, 0, 0, 1080)
      const intervalMs = body?.intervalMs === undefined ? undefined : clampInteger(body.intervalMs, 1200, 200, 60000)
      const title = typeof body?.cycleTitle === 'string' ? body.cycleTitle.slice(0, MAX_CYCLE_TITLE) : undefined
      muyu.startAutoKnock(targetCount, intervalMs, title)
    } else if (action === 'stop') {
      muyu.stopAutoKnock()
    } else if (action !== 'status') {
      sendJson(res, 400, { error: 'action must be start, stop, or status' })
      return
    }
    sendJson(res, 200, { state: buildMuyuState(muyu) })
  })

  const tokensPerMerit = guard(async (req, res) => {
    if (!checkRequestOrigin(req, res, webServer)) return
    if ((req.method || '').toUpperCase() !== 'POST') {
      methodNotAllowed(res, 'POST')
      return
    }
    if (!requireJsonContentType(req, res)) return
    const body = await readJsonBody(req)
    const value = Number(body?.value)
    if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 10000000) {
      sendJson(res, 400, { error: 'value must be a non-zero integer within +/-10,000,000' })
      return
    }
    const step = Math.trunc(value)
    if (step === 0 || !muyu.setTokensPerMerit(step)) {
      sendJson(res, 400, { error: 'invalid tokensPerMerit' })
      return
    }
    sendJson(res, 200, { state: buildMuyuState(muyu) })
  })

  const sutra = guard(async (req, res) => {
    if (!checkRequestOrigin(req, res, webServer)) return
    if ((req.method || '').toUpperCase() !== 'POST') {
      methodNotAllowed(res, 'POST')
      return
    }
    if (!requireJsonContentType(req, res)) return
    const body = await readJsonBody(req)
    const bookId = typeof body?.bookId === 'string' ? body.bookId : ''
    if (bookId.length > MAX_BOOK_ID) {
      sendJson(res, 400, { error: 'bookId is too long' })
      return
    }
    if (!bookId || !muyu.selectSutra(bookId)) {
      sendJson(res, 400, { error: `unknown sutra: ${bookId || '(empty)'}` })
      return
    }
    sendJson(res, 200, { state: buildMuyuState(muyu) })
  })

  return { state, knock, auto, sutra, tokensPerMerit }
}

/**
 * Register the widget API on the host web server. Returns a disposer that
 * removes every route (used by the plugin's Cordis effect).
 */
export function registerMuyuClientApi(webServer: any, muyu: MuyuService): () => void {
  if (!webServer || typeof webServer.register !== 'function') {
    return () => {}
  }
  const handlers = createMuyuRouteHandlers(muyu, webServer)
  const routes: Array<{ kind: 'exact'; path: string; handler: any }> = [
    { kind: 'exact', path: `${MUYU_API_PREFIX}/state`, handler: handlers.state },
    { kind: 'exact', path: `${MUYU_API_PREFIX}/knock`, handler: handlers.knock },
    { kind: 'exact', path: `${MUYU_API_PREFIX}/auto`, handler: handlers.auto },
    { kind: 'exact', path: `${MUYU_API_PREFIX}/sutra`, handler: handlers.sutra },
    { kind: 'exact', path: `${MUYU_API_PREFIX}/tokens-per-merit`, handler: handlers.tokensPerMerit }
  ]
  const disposers = routes.map(route => {
    try {
      return webServer.register(route)
    } catch (error) {
      console.warn('[dsh-plugin-muyu] failed to register client API route', route.path, error)
      return () => {}
    }
  })
  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {}
    }
  }
}
