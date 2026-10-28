import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { MeritStorage } from '../lib/services/merit-storage.js'
import { ChantService } from '../lib/services/chant-service.js'
import { heartSutra, vajraSutra } from '../lib/data/sutras.js'
import { soundLibrary } from '../lib/data/sounds.js'
import { MuyuService } from '../lib/services/muyu-service.js'
import { createMuyuTools } from '../lib/tools/index.js'
import { apply } from '../lib/index.js'

test('ChantService - 经文切换与逐句流转', () => {
  const chant = new ChantService('heart_sutra')
  assert.equal(chant.getBook().id, 'heart_sutra')
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

test('MeritStorage - 功德累加与持久化统计', () => {
  const tmpFile = path.join(os.tmpdir(), 'test_merit_1.json')
  const storage = new MeritStorage(tmpFile)

  const initialStats = storage.getStats()
  assert.equal(initialStats.todayMerit, 0)
  assert.equal(initialStats.totalMerit, 0)

  storage.addMerit(1)
  storage.addMerit(10)
  assert.equal(storage.todayMerit, 11)
  assert.equal(storage.totalMerit, 11)

  const stats = storage.getStats()
  assert.equal(stats.todayMerit, 11)
  assert.equal(stats.records.length > 0, true)
  assert.equal(stats.records[0].count, 11)

  const storage2 = new MeritStorage(tmpFile)
  assert.equal(storage2.todayMerit, 11)
  assert.equal(storage2.totalMerit, 11)

  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile)
  }
})

test('SoundLibrary - 三种木鱼与磬音音色完整性', () => {
  assert.ok(soundLibrary.sandalwood)
  assert.ok(soundLibrary.whitewood)
  assert.ok(soundLibrary.bell)
  assert.equal(soundLibrary.sandalwood.fileName, 'muyu.wav')
  assert.equal(soundLibrary.whitewood.fileName, 'muyu_bright.wav')
  assert.equal(soundLibrary.bell.fileName, 'muyu_bell.wav')
})

test('MuyuService & DSH Tools - 完整修持流程验证', async () => {
  const registeredDisposers = []
  const fakeCtx = {
    provide: (k, v) => { fakeCtx[k] = v },
    effect: (fn) => {
      const disposer = fn()
      if (disposer) registeredDisposers.push(disposer)
      return disposer
    },
    tools: {
      register: (tool) => {
        return () => {}
      }
    }
  }
  const tmpFile = path.join(os.tmpdir(), 'test_service_1.json')
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
  assert.equal(tools.length, 5)

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

  const rendered = knockTool.output.render({}, knockRes)
  assert.ok(rendered[0].text.includes('功德 +5'))
  assert.ok(rendered[0].text.includes('古刹清磬'))

  const autoTool = tools.find(t => t.name === 'muyu_auto_knock')
  const autoStart = await autoTool.execute({ action: 'start', cycle: 9, intervalMs: 50 })
  assert.equal(autoStart.action, 'start')
  assert.equal(autoStart.targetCount, 9)

  const autoStop = await autoTool.execute({ action: 'stop' })
  assert.equal(autoStop.action, 'stop')

  const registeredTools = []
  const cordisCtx = {
    services: {},
    provide(k, v) {
      this.services[k] = v
    },
    effect(fn) {
      return fn()
    },
    tools: {
      register(tool) {
        registeredTools.push(tool)
        return () => {
          const idx = registeredTools.indexOf(tool)
          if (idx !== -1) registeredTools.splice(idx, 1)
        }
      }
    }
  }
  apply(cordisCtx, {})
  assert.ok(cordisCtx.services.muyu)
  assert.equal(registeredTools.length, 5)

  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile)
  }
})
