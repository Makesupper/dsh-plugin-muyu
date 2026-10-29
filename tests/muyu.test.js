import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { MeritStorage, resolveDefaultStorageFile } from '../lib/services/merit-storage.js'
import { ChantService } from '../lib/services/chant-service.js'
import { heartSutra, vajraSutra } from '../lib/data/sutras.js'
import { soundLibrary } from '../lib/data/sounds.js'
import { MuyuService } from '../lib/services/muyu-service.js'
import { createMuyuTools } from '../lib/tools/index.js'
import { apply, Config } from '../lib/index.js'
import { buildMuyuState, createMuyuRouteHandlers, registerMuyuClientApi } from '../lib/services/client-api.js'
import { formatTokenCount } from '../lib/format.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let testCounter = 0

function makeUniqueTmpFile(prefix = 'muyu_test') {
  testCounter += 1
  return path.join(
    os.tmpdir(),
    `${prefix}_${process.pid}_${Date.now()}_${testCounter}_${Math.random().toString(36).slice(2, 8)}.json`
  )
}

function cleanupTmpFiles(baseFile) {
  const dir = path.dirname(baseFile)
  const baseName = path.basename(baseFile)
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    if (
      entry === baseName ||
      entry === `${baseName}.lock` ||
      entry === `${baseName}.state.json` ||
      entry.startsWith(`${baseName}.corrupt-`) ||
      entry.startsWith(`${baseName}.tmp-`) ||
      entry.startsWith(`${baseName}.state.json.tmp-`)
    ) {
      try {
        fs.unlinkSync(path.join(dir, entry))
      } catch {}
    }
  }
}

function makeMockResponse() {
  let resolveDone
  const done = new Promise(resolve => {
    resolveDone = resolve
  })
  return {
    statusCode: 0,
    headers: {},
    body: '',
    done,
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers || {}
    },
    end(body) {
      this.body = body || ''
      resolveDone()
    }
  }
}

function makeMockRequest(method, url, body, extraHeaders = {}) {
  const listeners = { data: [], end: [], error: [] }
  const req = {
    method,
    url,
    headers: { host: '127.0.0.1:12345', ...extraHeaders },
    on(event, callback) {
      ;(listeners[event] ||= []).push(callback)
      return req
    },
    destroy() {}
  }
  setTimeout(() => {
    if (body !== undefined) {
      const buf = Buffer.from(body)
      for (const callback of listeners.data) callback(buf)
    }
    for (const callback of listeners.end) callback()
  }, 0)
  return req
}

async function invokeRoute(handler, method, url, body, extraHeaders = {}) {
  const headers = body !== undefined ? { 'content-type': 'application/json', ...extraHeaders } : { ...extraHeaders }
  const req = makeMockRequest(method, url, body, headers)
  const res = makeMockResponse()
  await handler(req, res)
  await res.done
  return {
    status: res.statusCode,
    headers: res.headers,
    json: res.body ? JSON.parse(res.body) : null
  }
}

test('ChantService - 经文切换与 14 句心经逐句流转', () => {
  const chant = new ChantService('heart_sutra')
  assert.equal(chant.getBook().id, 'heart_sutra')
  assert.equal(heartSutra.sentences.length, 14)
  assert.equal(chant.getCurrentSentence().id, 0)
  assert.equal(chant.getCurrentSentence().text, heartSutra.sentences[0])

  const step1 = chant.advanceSentence()
  assert.equal(step1.current.id, 0)
  assert.equal(step1.next.id, 1)
  assert.equal(step1.cycleCompleted, false)

  chant.reset()
  const totalSentences = heartSutra.sentences.length
  for (let i = 0; i < totalSentences - 1; i++) {
    chant.advanceSentence()
  }
  const lastStep = chant.advanceSentence()
  assert.equal(lastStep.cycleCompleted, true)
  assert.equal(lastStep.completedCycles, 1)
  assert.equal(chant.getCurrentSentence().id, 0)

  assert.equal(chant.setBook('vajra_sutra'), true)
  assert.equal(chant.getBook().id, 'vajra_sutra')
  assert.equal(chant.getCurrentSentence().text, vajraSutra.sentences[0])
})

test('MeritStorage - 功德、Token 与 pendingTokens 跨实例持久化、旧格式迁移与损坏隔离', () => {
  const tmpFile = makeUniqueTmpFile('merit_storage')
  try {
    // 1. 全新实例写入并跨重启读取
    const storage1 = new MeritStorage(tmpFile)
    assert.equal(storage1.todayMerit, 0)
    assert.equal(storage1.todayTokens, 0)
    assert.equal(storage1.pendingTokens, 0)

    storage1.addMerit(5, 12000, 2000)
    storage1.addTokens(3500, 5500)
    assert.equal(storage1.todayMerit, 5)
    assert.equal(storage1.totalMerit, 5)
    assert.equal(storage1.todayTokens, 15500)
    assert.equal(storage1.totalTokens, 15500)
    assert.equal(storage1.pendingTokens, 5500)

    // 2. 重启实例验证 todayMerit, todayTokens, pendingTokens 均完整恢复
    const storage2 = new MeritStorage(tmpFile)
    assert.equal(storage2.todayMerit, 5)
    assert.equal(storage2.totalMerit, 5)
    assert.equal(storage2.todayTokens, 15500)
    assert.equal(storage2.totalTokens, 15500)
    assert.equal(storage2.pendingTokens, 5500)

    // 3. 验证旧版扁平格式 { "YYYY-MM-DD": number } 自动迁移为 version: 1
    const todayKey = storage2.todayKey
    fs.writeFileSync(tmpFile, JSON.stringify({ [todayKey]: 42, '2026-01-01': 10 }), 'utf-8')
    const storageMigrated = new MeritStorage(tmpFile)
    assert.equal(storageMigrated.todayMerit, 42)
    assert.equal(storageMigrated.totalMerit, 52)
    const persisted = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'))
    assert.equal(persisted.version, 1)
    assert.equal(persisted.days[todayKey].merit, 42)

    // 4. 验证损坏的 JSON 文件被重命名隔离为 .corrupt-* 而非静默覆盖
    fs.writeFileSync(tmpFile, '{corrupted json...', 'utf-8')
    const storageRecovered = new MeritStorage(tmpFile)
    assert.equal(storageRecovered.todayMerit, 0)
    assert.equal(storageRecovered.totalMerit, 0)

    const dirEntries = fs.readdirSync(path.dirname(tmpFile))
    const corruptBackups = dirEntries.filter(name => name.startsWith(`${path.basename(tmpFile)}.corrupt-`))
    assert.equal(corruptBackups.length, 1)

    // 5. 验证 $DSH_HOME 环境变量优先解析与 ~ 展开
    const prevDshHome = process.env.DSH_HOME
    process.env.DSH_HOME = '/tmp/custom-dsh-home'
    assert.equal(
      resolveDefaultStorageFile(),
      path.join('/tmp/custom-dsh-home', 'muyu-data', 'merit_history.json')
    )
    assert.ok(resolveDefaultStorageFile('~/custom-muyu.json').startsWith(os.homedir()))
    if (prevDshHome === undefined) {
      delete process.env.DSH_HOME
    } else {
      process.env.DSH_HOME = prevDshHome
    }
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('MeritStorage - 多实例同文件写入不互相覆盖', () => {
  const tmpFile = makeUniqueTmpFile('merit_multi')
  try {
    const a = new MeritStorage(tmpFile)
    const b = new MeritStorage(tmpFile)
    const todayKey = a.todayKey

    a.addMerit(10, 0)
    b.addMerit(1, 0)
    const disk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'))
    assert.equal(disk.days[todayKey].merit, 11)
    assert.equal(new MeritStorage(tmpFile).todayMerit, 11)

    a.addTokens(1000)
    b.addTokens(2000)
    assert.equal(new MeritStorage(tmpFile).todayTokens, 3000)
    assert.equal(new MeritStorage(tmpFile).totalMerit, 11)
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('MuyuService - 两个宿主实例的 Token 缓冲池不会互相覆盖', () => {
  const tmpFile = makeUniqueTmpFile('service_multi')
  try {
    const fakeCtx = {
      provide: () => {},
      effect: fn => fn(),
      tools: { register: () => () => {} }
    }
    const a = new MuyuService(fakeCtx, { storagePath: tmpFile, tokensPerMerit: 10000 })
    const b = new MuyuService(fakeCtx, { storagePath: tmpFile, tokensPerMerit: 10000 })

    const first = a.consumeTokens(4000)
    assert.equal(first.pendingTokens, 4000)
    // b was constructed before a wrote; it must still see a's pending under the lock.
    const second = b.consumeTokens(8000)
    assert.equal(second.knocksTriggered, 1)
    assert.equal(second.pendingTokens, 2000)
    assert.equal(a.getMeritStats().todayMerit, 1)
    assert.equal(a.getPendingTokens(), 2000)
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('SoundLibrary & Config Schema - 音色完整性与配置校验', () => {
  assert.ok(soundLibrary.sandalwood)
  assert.ok(soundLibrary.whitewood)
  assert.ok(soundLibrary.bell)
  assert.equal(soundLibrary.sandalwood.fileName, 'muyu.wav')
  assert.equal(soundLibrary.whitewood.fileName, 'muyu_bright.wav')
  assert.equal(soundLibrary.bell.fileName, 'muyu_bell.wav')

  const validated = Config['~standard'].validate({
    autoKnockIntervalMs: 50, // below min 200 -> clamped to 200
    voiceRate: 5.0 // above max 2.0 -> clamped to 2.0
  })
  assert.ok('value' in validated)
  assert.equal(validated.value.autoKnockIntervalMs, 200)
  assert.equal(validated.value.voiceRate, 2.0)
  assert.equal(validated.value.tokensPerMerit, 10000)
})

test('MuyuService & DSH Tools - 修持流程、session/event 真实钩子与非法入参防护', async () => {
  const tmpFile = makeUniqueTmpFile('service_tools')
  try {
    const fakeCtx = {
      provide: (k, v) => { fakeCtx[k] = v },
      effect: (fn) => fn(),
      tools: { register: () => () => {} }
    }
    const muyu = new MuyuService(fakeCtx, {
      defaultSutra: 'heart_sutra',
      defaultSound: 'sandalwood',
      storagePath: tmpFile
    })

    const res1 = muyu.knock(1)
    assert.equal(res1.amount, 1)
    assert.equal(res1.todayMerit, 1)
    assert.equal(res1.totalMerit, 1)
    assert.equal(res1.soundType, 'sandalwood')
    assert.ok(res1.soundFile.endsWith('muyu.wav'))
    assert.ok(res1.voicePrompt.text.includes('观自在菩萨'))

    const tools = createMuyuTools(muyu)
    assert.equal(tools.length, 6)

    for (const t of tools) {
      assert.equal(t.parameters.type, 'object')
      assert.ok(typeof t.parameters.properties === 'object')
      assert.ok(Array.isArray(t.parameters.required))
    }

    const knockTool = tools.find(t => t.name === 'muyu_knock')
    const knockRes = await knockTool.execute({ count: 5, sound: 'bell' })
    assert.equal(knockRes.amount, 5)
    assert.equal(knockRes.todayMerit, 6)
    assert.equal(knockRes.soundType, 'bell')
    assert.equal(knockRes.soundDisplayName, '古刹清磬')

    // 非法入参保护：count 传字符串 "abc"、负数、小数、超大数不会污染为 NaN
    const nanKnock = await knockTool.execute({ count: 'abc' })
    assert.equal(nanKnock.amount, 1)
    assert.equal(nanKnock.todayMerit, 7)

    const floatKnock = await knockTool.execute({ count: 2.9 })
    assert.equal(floatKnock.amount, 2)
    assert.equal(floatKnock.todayMerit, 9)

    const hugeKnock = await knockTool.execute({ count: 9999 })
    assert.equal(hugeKnock.amount, 108)
    assert.equal(hugeKnock.todayMerit, 117)

    // muyu_select_sutra 返回体精简校验（不含整包 sentences 数组）
    const sutraTool = tools.find(t => t.name === 'muyu_select_sutra')
    const sutraRes = await sutraTool.execute({})
    assert.equal(sutraRes.currentBook.sentenceCount, 14)
    assert.equal('sentences' in sutraRes.currentBook, false)

    // 自动敲击 interval/cycle 校验与无尽修持超时停止
    const autoTool = tools.find(t => t.name === 'muyu_auto_knock')
    const autoStart = await autoTool.execute({ action: 'start', cycle: 77, intervalMs: 10 })
    assert.equal(autoStart.action, 'start')
    assert.equal(autoStart.targetCount, 108) // 非标准 77 自动归一为 108
    assert.equal(autoStart.intervalMs, 200) // 10ms 夹紧到 >= 200ms
    assert.ok(autoStart.cycleFallbackNote)

    const autoStatus = await autoTool.execute({ action: 'status' })
    assert.equal(autoStatus.running, true)

    const autoStop = await autoTool.execute({ action: 'stop' })
    assert.equal(autoStop.running, false)

    // 验证 session/event + assistant/message.data.usage 真实监听（忽略 assistant/attempt）
    const registeredTools = []
    const eventListeners = {}
    const injected = []
    const routes = []
    const cordisCtx = {
      services: {},
      provide(k, v) {
        this.services[k] = v
      },
      on(evt, cb) {
        eventListeners[evt] = cb
        return () => { delete eventListeners[evt] }
      },
      effect(fn) {
        return fn()
      },
      inject(names, callback) {
        injected.push(names)
        callback({
          ...this,
          webServer: {
            register(route) {
              routes.push(route)
              return () => {}
            }
          }
        })
      },
      tools: {
        register(tool) {
          registeredTools.push(tool)
          return () => {}
        }
      }
    }
    apply(cordisCtx, { storagePath: tmpFile, tokensPerMerit: 10000 })
    assert.ok(cordisCtx.services.muyu)
    assert.equal(registeredTools.length, 6)
    assert.equal(typeof eventListeners['session/event'], 'function')

    // 验证 Host 侧通过可选 webServer 注入注册挂件 API，而不影响无 Web 的 profile
    assert.deepEqual(injected, [['webServer']])
    assert.deepEqual(
      routes.map(route => route.path),
      ['/dsh-muyu/state', '/dsh-muyu/knock', '/dsh-muyu/auto', '/dsh-muyu/sutra']
    )
    assert.ok(routes.every(route => route.kind === 'exact'))

    const beforeMerit = cordisCtx.services.muyu.getMeritStats().todayMerit
    // 触发 assistant/attempt 应被忽略
    eventListeners['session/event']({}, {
      type: 'assistant/attempt',
      data: { usage: { inputTokens: 20000, outputTokens: 5000 } }
    })
    assert.equal(cordisCtx.services.muyu.getMeritStats().todayMerit, beforeMerit)

    // 触发 assistant/message 应真实累计 Token 并敲击 2 次
    eventListeners['session/event']({}, {
      type: 'assistant/message',
      data: {
        usage: {
          inputTokens: 12000,
          outputTokens: 3000,
          cacheReadTokens: 8000,
          cacheWriteTokens: 2000
        }
      }
    })
    const afterStats = cordisCtx.services.muyu.getMeritStats()
    assert.equal(afterStats.todayMerit, beforeMerit + 2)
    assert.equal(afterStats.todayTokens, 25000)
    assert.equal(afterStats.pendingTokens, 5000)
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('Token 驱动敲木鱼 - 跨重启持久化、大额 Token 单次封顶与 pending 截断', async () => {
  const tmpFile = makeUniqueTmpFile('token_engine')
  try {
    const fakeCtx = {
      provide: () => {},
      effect: (fn) => fn(),
      tools: { register: () => () => {} }
    }

    const muyu1 = new MuyuService(fakeCtx, {
      defaultSutra: 'heart_sutra',
      defaultSound: 'sandalwood',
      storagePath: tmpFile,
      tokensPerMerit: 10000,
      tokenKnockEnabled: true
    })

    // 1. 消耗 4,000 tokens：未到 10000 阈值，缓冲池存 4000
    const r1 = muyu1.consumeTokens(4000)
    assert.equal(r1.tokensConsumed, 4000)
    assert.equal(r1.pendingTokens, 4000)
    assert.equal(r1.knocksTriggered, 0)
    assert.equal(r1.todayTokens, 4000)
    assert.equal(r1.todayMerit, 0)

    // 2. 模拟宿主重启：新建 MuyuService 实例加载同一文件，再消耗 8,000 tokens（4000+8000=12000 -> 1敲 + 余2000）
    const muyu2 = new MuyuService(fakeCtx, {
      defaultSutra: 'heart_sutra',
      defaultSound: 'sandalwood',
      storagePath: tmpFile,
      tokensPerMerit: 10000,
      tokenKnockEnabled: true
    })
    assert.equal(muyu2.getPendingTokens(), 4000)
    const r2 = muyu2.consumeTokens(8000)
    assert.equal(r2.knocksTriggered, 1)
    assert.equal(r2.meritGained, 1)
    assert.equal(r2.pendingTokens, 2000)
    assert.equal(r2.todayMerit, 1)
    assert.equal(r2.todayTokens, 12000)

    // 3. 非法 Token 入参（NaN / 负数）不污染账本
    const tools = createMuyuTools(muyu2)
    const feedTool = tools.find(t => t.name === 'muyu_feed_tokens')
    const badRes = await feedTool.execute({ tokens: 'invalid_nan' })
    assert.equal(badRes.tokensConsumed, 0)
    assert.equal(badRes.pendingTokens, 2000)
    assert.equal(badRes.todayTokens, 12000)

    // 4. 一次性喂入 2,000,000 Tokens：单次最多接受 1,080,000 Tokens（108 敲），
    // 超出部分丢弃，pending 保持在阈值以内，不会留下几十万次才能消化的积压。
    const burstRes = muyu2.consumeTokens(2000000)
    assert.equal(burstRes.knocksTriggered, 108)
    assert.equal(burstRes.meritGained, 108)
    assert.equal(burstRes.todayMerit, 109)
    assert.equal(burstRes.todayTokens, 1092000)
    assert.equal(burstRes.pendingTokens, 2000)
    assert.equal(burstRes.truncatedTokens, 920000)

    // 5. 1e12 级别的恶意/误调用也只产生 108 敲和不足一个 step 的 pending
    const hugeRes = muyu2.consumeTokens(1e12)
    assert.equal(hugeRes.knocksTriggered, 108)
    assert.ok(hugeRes.pendingTokens < 10000)
    assert.ok(hugeRes.truncatedTokens > 0)
    assert.ok(hugeRes.todayTokens < 3000000)
    const nextRes = muyu2.consumeTokens(150000)
    assert.equal(nextRes.knocksTriggered, 15) // 只按 150k 正常折算，不再连续 108 敲
    assert.ok(nextRes.pendingTokens < 10000)

    // 6. 模型可见的 muyu_feed_tokens 同样受单次上限保护
    const hugeFeed = await feedTool.execute({ tokens: 1e12 })
    assert.equal(hugeFeed.knocksTriggered, 108)
    assert.ok(hugeFeed.pendingTokens < 10000)
    assert.ok(hugeFeed.truncatedTokens > 0)
    assert.ok(hugeFeed.todayTokens < 5000000)
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('运行状态 - 经文句序与音色跨重启恢复', () => {
  const tmpFile = makeUniqueTmpFile('runtime_state')
  try {
    const fakeCtx = {
      provide: () => {},
      effect: fn => fn(),
      tools: { register: () => () => {} }
    }
    const service1 = new MuyuService(fakeCtx, {
      storagePath: tmpFile,
      defaultSutra: 'heart_sutra',
      defaultSound: 'sandalwood',
      tokensPerMerit: 10000
    })
    service1.knock(1)
    service1.knock(1)
    service1.selectSutra('vajra_sutra')
    service1.knock(1)
    service1.knock(1)
    service1.setSoundType('bell')

    const service2 = new MuyuService(fakeCtx, {
      storagePath: tmpFile,
      defaultSutra: 'heart_sutra',
      defaultSound: 'sandalwood',
      tokensPerMerit: 10000
    })
    assert.equal(service2.getSutra().id, 'vajra_sutra')
    assert.equal(service2.getCurrentSentence().id, 2)
    assert.equal(service2.getSoundType(), 'bell')

    // 损坏的 state 文件不应阻止服务启动，回落到默认经文/音色
    fs.writeFileSync(`${tmpFile}.state.json`, '{broken', 'utf-8')
    const service3 = new MuyuService(fakeCtx, {
      storagePath: tmpFile,
      defaultSutra: 'heart_sutra',
      defaultSound: 'sandalwood',
      tokensPerMerit: 10000
    })
    assert.equal(service3.getSutra().id, 'heart_sutra')
    assert.equal(service3.getSoundType(), 'sandalwood')
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('Client API - 前端与服务端工具共用同一本账，并驱动挂件状态', async () => {
  const tmpFile = makeUniqueTmpFile('client_api')
  try {
    const fakeCtx = {
      provide: () => {},
      effect: fn => fn(),
      tools: { register: () => () => {} }
    }
    const muyu = new MuyuService(fakeCtx, {
      storagePath: tmpFile,
      tokensPerMerit: 10000,
      tokenKnockEnabled: true
    })
    const webServer = {
      getOrigin: () => 'http://127.0.0.1:12345',
      register() {
        return () => {}
      }
    }
    const handlers = createMuyuRouteHandlers(muyu, webServer)

    // 1. 初始状态：同一账本、当前经文、令牌换算阈值
    const initial = await invokeRoute(handlers.state, 'GET', '/dsh-muyu/state')
    assert.equal(initial.status, 200)
    assert.equal(initial.json.todayMerit, 0)
    assert.equal(initial.json.todayTokens, 0)
    assert.equal(initial.json.tokensPerMerit, 10000)
    assert.equal(initial.json.bookId, 'heart_sutra')
    assert.equal(initial.json.currentSentence.bookId, 'heart_sutra')
    assert.equal('records' in initial.json, false)

    // 1b. 来源/主机/Content-Type 防护：跨站与 text/plain 一律拒绝
    const validOrigin = await invokeRoute(handlers.state, 'GET', '/dsh-muyu/state', undefined, {
      origin: 'http://127.0.0.1:12345'
    })
    assert.equal(validOrigin.status, 200)
    const evilOrigin = await invokeRoute(handlers.state, 'GET', '/dsh-muyu/state', undefined, {
      origin: 'http://evil.example'
    })
    assert.equal(evilOrigin.status, 403)
    const evilHost = await invokeRoute(handlers.state, 'GET', '/dsh-muyu/state', undefined, {
      host: 'evil.example:12345'
    })
    assert.equal(evilHost.status, 403)
    const wrongContentType = await invokeRoute(
      handlers.knock,
      'POST',
      '/dsh-muyu/knock',
      JSON.stringify({ count: 1 }),
      { 'content-type': 'text/plain' }
    )
    assert.equal(wrongContentType.status, 415)
    const evilPost = await invokeRoute(
      handlers.knock,
      'POST',
      '/dsh-muyu/knock',
      JSON.stringify({ count: 1 }),
      { origin: 'http://evil.example' }
    )
    assert.equal(evilPost.status, 403)
    assert.equal(muyu.getMeritStats().todayMerit, 0)
    const longTitle = await invokeRoute(
      handlers.auto,
      'POST',
      '/dsh-muyu/auto',
      JSON.stringify({ action: 'start', cycleTitle: 'x'.repeat(4000) })
    )
    assert.equal(longTitle.status, 200)
    assert.equal(longTitle.json.state.auto.cycleTitle.length, 80)
    await invokeRoute(handlers.auto, 'POST', '/dsh-muyu/auto', JSON.stringify({ action: 'stop' }))
    const longBookId = await invokeRoute(
      handlers.sutra,
      'POST',
      '/dsh-muyu/sutra',
      JSON.stringify({ bookId: 'x'.repeat(100) })
    )
    assert.equal(longBookId.status, 400)

    // 2. 仅在显式请求历史时返回按日明细
    const withHistory = await invokeRoute(handlers.state, 'GET', '/dsh-muyu/state?history=1')
    assert.ok(Array.isArray(withHistory.json.records))
    assert.ok(withHistory.json.records.length >= 1)

    // 3. 前端敲击直接写入服务端账本，并返回本次诵读句
    const knock = await invokeRoute(handlers.knock, 'POST', '/dsh-muyu/knock', JSON.stringify({ count: 1 }))
    assert.equal(knock.status, 200)
    assert.equal(knock.json.state.todayMerit, 1)
    assert.equal(knock.json.state.totalMerit, 1)
    assert.ok(knock.json.knock.currentSentence.text.length > 0)
    assert.equal(muyu.getMeritStats().todayMerit, 1)

    // 4. 自动修持由服务端持有，前端只发开始/停止
    const autoStart = await invokeRoute(
      handlers.auto,
      'POST',
      '/dsh-muyu/auto',
      JSON.stringify({ action: 'start', intervalMs: 200 })
    )
    assert.equal(autoStart.json.state.auto.running, true)
    const autoStop = await invokeRoute(handlers.auto, 'POST', '/dsh-muyu/auto', JSON.stringify({ action: 'stop' }))
    assert.equal(autoStop.json.state.auto.running, false)

    // 5. 经文切换同步到服务端账本
    const sutra = await invokeRoute(
      handlers.sutra,
      'POST',
      '/dsh-muyu/sutra',
      JSON.stringify({ bookId: 'vajra_sutra' })
    )
    assert.equal(sutra.status, 200)
    assert.equal(sutra.json.state.bookId, 'vajra_sutra')
    assert.equal(sutra.json.state.currentSentence.bookId, 'vajra_sutra')
    const badSutra = await invokeRoute(handlers.sutra, 'POST', '/dsh-muyu/sutra', JSON.stringify({ bookId: 'nope' }))
    assert.equal(badSutra.status, 400)

    // 6. 只读状态不接受 POST
    const wrongMethod = await invokeRoute(handlers.state, 'POST', '/dsh-muyu/state', '{}')
    assert.equal(wrongMethod.status, 405)

    // 7. Token 消耗仍走同一账本；state 能立即读到 token 与功德增量
    muyu.consumeTokens(25000)
    const afterTokens = await invokeRoute(handlers.state, 'GET', '/dsh-muyu/state')
    assert.equal(afterTokens.json.todayTokens, 25000)
    assert.equal(afterTokens.json.todayMerit, 3) // 1 次手敲 + 2 次 Token 度化
    assert.equal(afterTokens.json.pendingTokens, 5000)
    assert.equal(afterTokens.json.chantSeq, 3)

    // 8. 注册函数只挂 4 条精确路由，并能在卸载时全部撤销
    const routes = []
    const routeWebServer = {
      getOrigin: () => 'http://127.0.0.1:12345',
      register(route) {
        routes.push(route)
        return () => {
          const index = routes.indexOf(route)
          if (index >= 0) routes.splice(index, 1)
        }
      }
    }
    const dispose = registerMuyuClientApi(routeWebServer, muyu)
    assert.deepEqual(
      routes.map(route => route.path),
      ['/dsh-muyu/state', '/dsh-muyu/knock', '/dsh-muyu/auto', '/dsh-muyu/sutra']
    )
    assert.ok(routes.every(route => route.kind === 'exact'))
    dispose()
    assert.equal(routes.length, 0)

    // 9. buildMuyuState 是纯快照，能同时给出账本与经文进度
    const snapshot = buildMuyuState(muyu, true)
    assert.equal(snapshot.todayTokens, 25000)
    assert.equal(snapshot.bookId, 'vajra_sutra')
    assert.ok(Array.isArray(snapshot.records))
    assert.ok(snapshot.lastSentence)
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('Token 显示单位 - 1M 以上用 M，千位用 k', () => {
  assert.equal(formatTokenCount(0), '0')
  assert.equal(formatTokenCount(999), '999')
  assert.equal(formatTokenCount(1000), '1k')
  assert.equal(formatTokenCount(1500), '1.5k')
  assert.equal(formatTokenCount(12345), '12.3k')
  assert.equal(formatTokenCount(999499), '999k')
  assert.equal(formatTokenCount(999999), '1M')
  assert.equal(formatTokenCount(1000000), '1M')
  assert.equal(formatTokenCount(1234567), '1.2M')
  assert.equal(formatTokenCount(29634326), '29.6M')
})

test('客户端打包产物 lib/client.js 完整性与单一账本接线', () => {
  const clientJsPath = path.resolve(__dirname, '../lib/client.js')
  const clientCode = fs.readFileSync(clientJsPath, 'utf-8')
  assert.equal(/(^|\n)\s*import\s+/.test(clientCode), false)
  assert.equal(/(^|\n)\s*export\s+/.test(clientCode), false)

  // 单一账本：客户端不得再维护本地 Token 折算/功德写入，也不再暴露旧的全局部件。
  assert.equal(clientCode.includes('__dsh_muyu_feed_tokens__'), false)
  assert.equal(clientCode.includes('computePendingAndKnocks'), false)
  assert.equal(clientCode.includes("const API_BASE = '/dsh-muyu'"), true)
  assert.equal(clientCode.includes("apiRequest('/state"), true)
  assert.equal(clientCode.includes("apiRequest('/knock'"), true)
  assert.equal(clientCode.includes("apiRequest('/auto'"), true)
  assert.equal(clientCode.includes("apiRequest('/sutra'"), true)

  let registered = null
  vm.runInNewContext(clientCode, {
    window: {
      __ModuleLoader__: {
        load(entry) {
          registered = entry
        }
      }
    },
    document: undefined,
    console
  })
  assert.ok(registered)
  assert.equal(registered.id, 'dsh-plugin-muyu')
  const pluginExports = registered.factory()
  assert.equal(pluginExports.name, 'muyu-client')
  assert.deepEqual([...pluginExports.inject], ['slots'])
  assert.equal(typeof pluginExports.apply, 'function')
})

test('客户端挂件轮询服务端账本并触发 Token 功德动画', async () => {
  const created = []
  function makeEl(tag = 'div') {
    const el = {
      tagName: String(tag).toUpperCase(),
      id: '',
      className: '',
      type: '',
      title: '',
      textContent: '',
      children: [],
      style: {},
      dataset: {},
      _listeners: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false } },
      appendChild(child) { this.children.push(child); return child },
      replaceChildren() { this.children.length = 0 },
      addEventListener(type, callback) {
        ;(this._listeners[type] ||= []).push(callback)
      },
      removeEventListener() {},
      click() {
        for (const callback of this._listeners.click || []) {
          callback({ stopPropagation() {}, preventDefault() {} })
        }
      },
      setAttribute() {},
      getAttribute() { return null },
      getBoundingClientRect() { return { left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120 } },
      remove() {},
      querySelector() { return null },
      querySelectorAll() { return [] },
      focus() {},
      blur() {}
    }
    created.push(el)
    return el
  }
  const body = makeEl('body')
  const documentStub = {
    readyState: 'complete',
    body,
    createElement: tag => makeEl(tag),
    getElementById: () => null,
    addEventListener() {},
    removeEventListener() {}
  }
  const localStorageStub = {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
    setItem(key, value) { this.store.set(key, String(value)) },
    removeItem(key) { this.store.delete(key) }
  }
  const windowStub = {
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  }
  function serverState(merit, tokens) {
    const sentence = {
      id: merit % 14,
      text: '观自在菩萨，行深般若波罗蜜多时。',
      bookId: 'heart_sutra',
      bookTitle: '般若波罗蜜多心经'
    }
    return {
      todayMerit: merit,
      totalMerit: merit,
      todayTokens: tokens,
      totalTokens: tokens,
      pendingTokens: tokens % 10000,
      tokensPerMerit: 10000,
      todayKey: '2026-10-29',
      bookId: 'heart_sutra',
      bookTitle: '般若波罗蜜多心经',
      currentSentence: sentence,
      lastSentence: sentence,
      chantSeq: merit,
      auto: { running: false, targetCount: 0, currentCount: 0, intervalMs: 1200, cycleTitle: '无尽修持' },
      records: []
    }
  }
  let stateCalls = 0
  const fetchStub = async url => {
    const target = String(url)
    if (target.includes('history=1')) {
      return { ok: true, json: async () => ({ ...serverState(0, 0), records: [] }) }
    }
    if (target.endsWith('/state')) {
      stateCalls += 1
      return { ok: true, json: async () => (stateCalls <= 1 ? serverState(0, 0) : serverState(1, 12000)) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: localStorageStub,
    fetch: fetchStub,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    Promise,
    Object,
    Array,
    Set,
    Map,
    JSON,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Error,
    RegExp,
    Symbol,
    WeakMap
  }
  sandbox.globalThis = sandbox

  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf-8')
  let entry = null
  sandbox.window.__ModuleLoader__ = { load(value) { entry = value } }
  vm.runInNewContext(clientCode, sandbox)

  const cleanups = []
  const ctx = {
    effect(fn) {
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      return () => {}
    }
  }
  entry.factory().apply(ctx)

  await new Promise(resolve => setTimeout(resolve, 1400))

  const tokenBar = created.find(el => typeof el.textContent === 'string' && el.textContent.includes('度化'))
  const sparks = created.filter(el => typeof el.textContent === 'string' && el.textContent.includes('功德 +'))
  assert.ok(tokenBar, 'token bar should be rendered')
  assert.ok(tokenBar.textContent.includes('12k Tokens'), tokenBar.textContent)
  assert.ok(tokenBar.textContent.includes('功德: 1'), tokenBar.textContent)
  assert.ok(sparks.some(el => el.textContent.includes('Tokens')), 'Token merit should trigger a knock effect')

  const soundBtn = created.find(el => typeof el.className === 'string' && el.className.includes('dsh-muyu-sound-pill'))
  assert.ok(soundBtn, 'wooden-fish sound toggle should be rendered')
  assert.equal(soundBtn.textContent, '🔔')
  soundBtn.click()
  assert.equal(soundBtn.textContent, '🔕')
  assert.equal(JSON.parse(localStorageStub.getItem('dsh_muyu_client_prefs') || '{}').soundEnabled, false)
  soundBtn.click()
  assert.equal(soundBtn.textContent, '🔔')
  assert.equal(JSON.parse(localStorageStub.getItem('dsh_muyu_client_prefs') || '{}').soundEnabled, true)

  for (const cleanup of cleanups) cleanup()
})
