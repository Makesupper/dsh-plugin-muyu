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
import { getLocalDateKey, computePendingAndKnocks } from '../lib/client/bundle.js'

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
    if (entry === baseName || entry.startsWith(`${baseName}.corrupt-`) || entry.startsWith(`${baseName}.tmp-`)) {
      try {
        fs.unlinkSync(path.join(dir, entry))
      } catch {}
    }
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

test('Token 驱动敲木鱼 - 跨重启持久化、100万Token单次封顶108敲与单次写盘', async () => {
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

    // 4. 一次性喂入 2,000,000 Tokens（理论 200 敲），单次调用封顶触发 108 敲，剩余留在 pendingTokens
    const burstRes = muyu2.consumeTokens(2000000)
    assert.equal(burstRes.knocksTriggered, 108)
    assert.equal(burstRes.meritGained, 108)
    assert.equal(burstRes.todayMerit, 109)
    assert.equal(burstRes.todayTokens, 2012000)
    assert.equal(burstRes.pendingTokens, 2000000 + 2000 - 108 * 10000) // 922,000
  } finally {
    cleanupTmpFiles(tmpFile)
  }
})

test('客户端纯函数与打包产物 lib/client.js 完整性验证', () => {
  const d = new Date(2026, 9, 29) // Local 2026-10-29
  assert.equal(getLocalDateKey(d), '2026-10-29')

  const calc1 = computePendingAndKnocks(4000, 8000, 10000, 108)
  assert.equal(calc1.knocks, 1)
  assert.equal(calc1.nextPending, 2000)

  const calcCap = computePendingAndKnocks(0, 1500000, 10000, 108)
  assert.equal(calcCap.knocks, 108)
  assert.equal(calcCap.nextPending, 420000)

  // 验证 lib/client.js 沙箱加载与无顶层 import/export
  const clientJsPath = path.resolve(__dirname, '../lib/client.js')
  const clientCode = fs.readFileSync(clientJsPath, 'utf-8')
  assert.equal(/(^|\n)\s*import\s+/.test(clientCode), false)
  assert.equal(/(^|\n)\s*export\s+/.test(clientCode), false)

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
