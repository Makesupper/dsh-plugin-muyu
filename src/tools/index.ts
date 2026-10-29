import type { MuyuService } from '../services/muyu-service.js'
import { soundLibrary } from '../data/sounds.js'
import { formatTokenCount } from '../format.js'
import type { MuyuSoundType } from '../types.js'

const VALID_CYCLES = new Set([0, 9, 21, 49, 108, 1080])

export function createMuyuTools(muyu: MuyuService) {
  const muyuKnock = {
    name: 'muyu_knock',
    description: '敲击电子木鱼积攒服务端功德（count 表示单次累加的功德点数，上限 108，每次调用推进 1 句经文诵念），返回当前经文与音效信息。',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: '本次敲击累加的功德点数（整数 1 ~ 108，默认 1，每次调用推进 1 句经文）'
        },
        sound: {
          type: 'string',
          enum: ['sandalwood', 'whitewood', 'bell'],
          description: '可选指定音色：sandalwood(紫檀沉音), whitewood(清脆白木), bell(古刹清磬)'
        }
      },
      required: []
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        let text = `🪷 功德 +${res.amount}！\n`
        text += `【今日服务端功德】${res.todayMerit}  |  【历劫总功德】${res.totalMerit}\n`
        text += `【当前诵读】《${res.currentSentence.bookTitle}》第 ${res.currentSentence.id + 1} 句：\n`
        text += `「${res.currentSentence.text}」\n`
        text += `【下一句】「${res.nextSentence.text}」\n`
        if (res.cycleCompleted) {
          text += `✨ 南无阿弥陀佛！本卷经文已圆满诵毕第 ${res.completedCycles} 遍，回向十方法界！\n`
        }
        text += `🔔 音色：${res.soundDisplayName} (${res.soundType})`
        return [{ type: 'text', text }]
      }
    },
    async execute(args: any) {
      const rawCount = Number(args?.count)
      const count = Number.isFinite(rawCount)
        ? Math.min(108, Math.max(1, Math.floor(rawCount)))
        : 1
      if (args?.sound && (args.sound === 'sandalwood' || args.sound === 'whitewood' || args.sound === 'bell')) {
        muyu.setSoundType(args.sound as MuyuSoundType)
      }
      const result = muyu.knock(count)
      const soundDef = soundLibrary[result.soundType]
      return {
        ...result,
        soundDisplayName: soundDef.displayName
      }
    }
  }

  const muyuAutoKnock = {
    name: 'muyu_auto_knock',
    description: '控制服务端自动敲木鱼修持任务（开始、停止或查询状态），支持指定佛教圆满周期（9/21/49/108/1080次或无尽修持）。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop', 'status'],
          description: '操作类型："start"、"stop" 或 "status"'
        },
        cycle: {
          type: 'number',
          description: '圆满目标次数：0(无尽修持), 9(九九归一), 21(真言圆满), 49(祈福安康), 108(断除百八烦恼), 1080(千佛功德)。默认为 108 次。'
        },
        intervalMs: {
          type: 'number',
          description: '每次敲击的间隔毫秒数，范围 200 ~ 60000，默认 1200 毫秒'
        }
      },
      required: ['action']
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        if (res.action === 'stop') {
          return [{
            type: 'text',
            text: `⏹️ 自动敲木鱼已停止。本轮共完成修持 ${res.currentCount} 次。`
          }]
        }
        if (res.action === 'status') {
          return [{
            type: 'text',
            text: `📊 自动敲木鱼状态：${res.running ? '运行中' : '已停止'} | 周期：${res.cycleTitle} | 已完成：${res.currentCount}/${res.targetCount === 0 ? '∞' : res.targetCount} 次 | 间隔：${res.intervalMs}ms`
          }]
        }
        let note = ''
        if (res.cycleFallbackNote) {
          note = `\n⚠️ 提示：${res.cycleFallbackNote}`
        }
        return [{
          type: 'text',
          text: `▶️ 自动敲木鱼已启动！\n周期目标：${res.cycleTitle}（目标 ${res.targetCount === 0 ? '无尽，最长 ' + Math.round(res.maxDurationMs / 60000) + ' 分钟自动停止' : res.targetCount + ' 次'}）\n敲击节奏：每 ${res.intervalMs}ms 敲击一次\n静心安神，经文正在随节拍逐句流转...${note}`
        }]
      }
    },
    async execute(args: any) {
      if (args?.action === 'stop') {
        const status = muyu.stopAutoKnock()
        return { action: 'stop', ...status }
      }
      if (args?.action === 'status') {
        const status = muyu.getAutoKnockStatus()
        return { action: 'status', ...status }
      }

      const rawCycle = Number(args?.cycle)
      let cycle = 108
      let cycleFallbackNote: string | undefined
      if (args?.cycle === undefined || args?.cycle === null) {
        cycle = 108
      } else if (Number.isFinite(rawCycle) && VALID_CYCLES.has(Math.floor(rawCycle))) {
        cycle = Math.floor(rawCycle)
      } else {
        cycle = 108
        cycleFallbackNote = `传入的周期 (${args?.cycle}) 非标准圆满周期，已自动归一为 108 次（悉断百八烦恼）。`
      }

      const rawInterval = Number(args?.intervalMs)
      const interval = Number.isFinite(rawInterval)
        ? Math.min(60000, Math.max(200, Math.floor(rawInterval)))
        : undefined

      const cycleNames: Record<number, string> = {
        0: '无尽修持',
        9: '九次 • 九九归一',
        21: '21 次 • 真言圆满',
        49: '49 次 • 祈福安康',
        108: '108 次 • 悉断百八烦恼',
        1080: '1080 次 • 庄严千佛功德'
      }
      const title = cycleNames[cycle] || `${cycle} 次圆满修持`
      const status = muyu.startAutoKnock(cycle, interval, title)
      return { action: 'start', cycleFallbackNote, ...status }
    }
  }

  const muyuGetMerit = {
    name: 'muyu_get_merit',
    description: '查看服务端功德簿、今日与历劫总功德、会话度化 Token 统计、蓄力缓冲池余数以及按日历史明细。',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        let text = `📿 【服务端功德簿总览】\n`
        text += `• 今日修行功德：${res.todayMerit} (今日共度 ${formatTokenCount(res.todayTokens)} Tokens)\n`
        text += `• 历劫累积功德：${res.totalMerit} (历劫共度 ${formatTokenCount(res.totalTokens)} Tokens)\n`
        text += `• 缓冲池蓄力余数：${res.pendingTokens ?? 0} Tokens\n\n`
        text += `📅 【近期修行记录】\n`
        if (res.records && res.records.length > 0) {
          for (const item of res.records.slice(0, 7)) {
            const tokInfo = item.tokens ? ` (消耗 ${formatTokenCount(item.tokens)} Tokens)` : ''
            text += `  - ${item.displayDate} (${item.dateKey})：积攒 ${item.count} 功德${tokInfo}\n`
          }
        } else {
          text += `  (暂无历史记录)\n`
        }
        return [{ type: 'text', text }]
      }
    },
    async execute() {
      return muyu.getMeritStats()
    }
  }

  const muyuSelectSutra = {
    name: 'muyu_select_sutra',
    description: '浏览经文宝库摘要或切换服务端当前修持研读的经典经咒（如心经、金刚经、大悲咒、药师咒、准提神咒等）。',
    parameters: {
      type: 'object',
      properties: {
        bookId: {
          type: 'string',
          description: '可选指定经书ID：heart_sutra, vajra_sutra, dharani, zen_verses, medicine_buddha, zhunti_mantra, amitabha_rebirth, shurangama_excerpt。不填则列出全部目录摘要。'
        }
      },
      required: []
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        if (res.selected) {
          return [{
            type: 'text',
            text: `📖 已切换研读经典为：《${res.currentBook.title}》\n概述：${res.currentBook.summary}\n全篇共 ${res.currentBook.sentenceCount} 句。\n当前从第 1 句开始诵持：「${res.currentSentence.text}」`
          }]
        }
        let text = `📜 【传世经典宝库】（当前正在修持：《${res.currentBook.title}》）\n\n`
        for (const book of res.availableBooks) {
          const isCurrent = book.id === res.currentBook.id ? '👉 (当前)' : '  '
          text += `${isCurrent} [${book.id}] 《${book.title}》 (${book.sentenceCount}句)\n    ${book.summary}\n`
        }
        text += `\n可使用 muyu_select_sutra 并传入对应的 bookId 进行切换。`
        return [{ type: 'text', text }]
      }
    },
    async execute(args: any) {
      let selected = false
      if (typeof args?.bookId === 'string' && args.bookId.trim().length > 0) {
        selected = muyu.selectSutra(args.bookId.trim())
      }
      const book = muyu.getSutra()
      const currentSentence = muyu.getCurrentSentence()
      const availableBooks = muyu.getAllSutras().map(b => ({
        id: b.id,
        title: b.title,
        summary: b.summary,
        sentenceCount: b.sentences.length
      }))
      return {
        selected,
        currentBook: {
          id: book.id,
          title: book.title,
          summary: book.summary,
          sentenceCount: book.sentences.length
        },
        currentSentence,
        availableBooks
      }
    }
  }

  const muyuPlaySound = {
    name: 'muyu_play_sound',
    description: '切换或获取服务端木鱼音色（紫檀沉音、清脆白木、古刹清磬），返回音频定义与资源路径信息。',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['sandalwood', 'whitewood', 'bell'],
          description: '音色类型：sandalwood(紫檀沉音), whitewood(清脆白木), bell(古刹清磬)'
        }
      },
      required: []
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        let text = `🔔 【木鱼与磬音音色】当前音色：${res.currentSound.displayName}\n`
        text += `描述：${res.currentSound.description}\n`
        text += `本地音频资源路径：${res.soundFilePath}\n\n`
        text += `全部可用音色：\n`
        for (const s of Object.values(soundLibrary)) {
          const mark = s.id === res.currentSound.id ? '👉 (当前)' : '  '
          text += `${mark} [${s.id}] ${s.displayName} —— ${s.description}\n`
        }
        return [{ type: 'text', text }]
      }
    },
    async execute(args: any) {
      if (args?.type && (args.type === 'sandalwood' || args.type === 'whitewood' || args.type === 'bell')) {
        muyu.setSoundType(args.type as MuyuSoundType)
      }
      const soundType = muyu.getSoundType()
      const def = soundLibrary[soundType]
      return {
        currentSound: def,
        soundFilePath: muyu.getSoundFile(soundType)
      }
    }
  }

  const muyuFeedTokens = {
    name: 'muyu_feed_tokens',
    description: '外部或手动补记 Token 消耗量（注：DSH 会话消息已通过 session/event 自动计量，通常无需模型主动调用，仅用于外部离线补记）。按配置的 tokensPerMerit（默认 10000）自动折算敲击与功德；单次最多 108 敲，超出部分忽略且不会留下 pending 积压。',
    parameters: {
      type: 'object',
      properties: {
        tokens: {
          type: 'number',
          description: '手动补记的 Token 数量（非负整数）'
        }
      },
      required: ['tokens']
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        const step = res.tokensPerMerit ?? 10000
        let text = `⚡ 补记消耗 ${formatTokenCount(res.tokensConsumed)} Tokens（兑换阈值：${step} Tokens/功德）！\n`
        if (res.truncatedTokens && res.truncatedTokens > 0) {
          text += `⚠️ 单次最多处理 ${formatTokenCount(step * 108)} Tokens，已忽略 ${formatTokenCount(res.truncatedTokens)} Tokens，避免缓冲池积压。\n`
        }
        if (res.knocksTriggered > 0) {
          text += `🪷 功德 +${res.meritGained}（触发木鱼敲击 ${res.knocksTriggered} 次）！\n`
          const last = res.knockResults[res.knockResults.length - 1]
          if (last) {
            text += `【诵读推进】《${last.currentSentence.bookTitle}》：「${last.currentSentence.text}」\n`
          }
        } else {
          text += `🪵 功德蓄力中：当前缓冲池已积攒 ${res.pendingTokens} / ${step} Tokens，静待下次敲击！\n`
        }
        text += `【今日修行】今日 Token: ${formatTokenCount(res.todayTokens)} | 今日功德: ${res.todayMerit} (历劫: ${res.totalMerit})`
        return [{ type: 'text', text }]
      }
    },
    async execute(args: any) {
      const rawTokens = Number(args?.tokens)
      const tokens = Number.isFinite(rawTokens) && rawTokens > 0
        ? Math.round(rawTokens)
        : 0
      const res = muyu.consumeTokens(tokens)
      return {
        ...res,
        tokensPerMerit: muyu.getTokensPerMerit()
      }
    }
  }

  return [muyuKnock, muyuAutoKnock, muyuGetMerit, muyuSelectSutra, muyuPlaySound, muyuFeedTokens]
}
