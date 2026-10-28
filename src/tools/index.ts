import type { MuyuService } from '../services/muyu-service.js'
import { soundLibrary } from '../data/sounds.js'
import type { MuyuSoundType } from '../types.js'

export function createMuyuTools(muyu: MuyuService) {
  const muyuKnock = {
    name: 'muyu_knock',
    description: '敲击电子木鱼一次或多次，积攒功德，推进经文诵念句子，并返回当前经文与音效信息。',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: '敲击次数，默认为 1 次，上限 108 次'
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
        text += `【今日功德】${res.todayMerit}  |  【历劫总功德】${res.totalMerit}\n`
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
      const count = Math.max(1, Math.min(args?.count || 1, 108))
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
    description: '控制自动敲木鱼修持任务（开始或停止），支持指定佛教圆满周期（9次/21次/49次/108次/1080次或持续自动敲击）。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop'],
          description: '操作类型："start" 或 "stop"'
        },
        cycle: {
          type: 'number',
          description: '圆满目标次数：0(无尽修持), 9(九九归一), 21(真言圆满), 49(祈福安康), 108(断除百八烦恼), 1080(千佛功德)。默认为 108 次。'
        },
        intervalMs: {
          type: 'number',
          description: '每次敲击的间隔毫秒数，默认 1200 毫秒'
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
            text: `⏹️ 自动敲木鱼已停止。当前共完成修持 ${res.currentCount} 次。`
          }]
        }
        return [{
          type: 'text',
          text: `▶️ 自动敲木鱼已启动！\n周期目标：${res.cycleTitle}（目标 ${res.targetCount === 0 ? '无尽' : res.targetCount} 次）\n敲击节奏：每 ${res.intervalMs}ms 敲击一次\n静心安神，经文正在随节拍逐句流转...`
        }]
      }
    },
    async execute(args: any) {
      if (args?.action === 'stop') {
        const status = muyu.stopAutoKnock()
        return { action: 'stop', ...status }
      }
      const cycle = args?.cycle ?? 108
      const interval = args?.intervalMs ?? 1200
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
      return { action: 'start', ...status }
    }
  }

  const muyuGetMerit = {
    name: 'muyu_get_merit',
    description: '查看今日功德簿、历劫总功德统计以及按日期的历史修持明细记录。',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    output: {
      schema: { type: 'object' },
      render: (_args: any, res: any) => {
        let text = `📿 【功德簿总览】\n`
        text += `• 今日修行功德：${res.todayMerit}\n`
        text += `• 历劫累积功德：${res.totalMerit}\n\n`
        text += `📅 【近期修行记录】\n`
        if (res.records && res.records.length > 0) {
          for (const item of res.records.slice(0, 7)) {
            text += `  - ${item.displayDate} (${item.dateKey})：积攒 ${item.count} 功德\n`
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
    description: '浏览经文宝库或切换当前修持研读的经典经咒（如心经、金刚经、大悲咒、药师咒、准提神咒等）。',
    parameters: {
      type: 'object',
      properties: {
        bookId: {
          type: 'string',
          description: '可选指定经书ID：heart_sutra, vajra_sutra, dharani, zen_verses, medicine_buddha, zhunti_mantra, amitabha_rebirth, shurangama_excerpt。不填则列出全部。'
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
            text: `📖 已切换研读经典为：《${res.currentBook.title}》\n概述：${res.currentBook.summary}\n全篇共 ${res.currentBook.sentences.length} 句。\n当前从第 1 句开始诵持：「${res.currentSentence.text}」`
          }]
        }
        let text = `📜 【传世经典宝库】（当前正在修持：《${res.currentBook.title}》）\n\n`
        for (const book of res.availableBooks) {
          const isCurrent = book.id === res.currentBook.id ? '👉 (当前)' : '  '
          text += `${isCurrent} [${book.id}] 《${book.title}》 (${book.sentences.length}句)\n    ${book.summary}\n`
        }
        text += `\n可使用 muyu_select_sutra 并传入对应的 bookId 进行切换。`
        return [{ type: 'text', text }]
      }
    },
    async execute(args: any) {
      let selected = false
      if (args?.bookId) {
        selected = muyu.selectSutra(args.bookId)
      }
      const currentBook = muyu.getSutra()
      const currentSentence = muyu.getCurrentSentence()
      const availableBooks = muyu.getAllSutras().map(b => ({
        id: b.id,
        title: b.title,
        summary: b.summary,
        sentences: b.sentences
      }))
      return {
        selected,
        currentBook,
        currentSentence,
        availableBooks
      }
    }
  }

  const muyuPlaySound = {
    name: 'muyu_play_sound',
    description: '切换或获取木鱼音色（紫檀沉音、清脆白木、古刹清磬），返回跨平台发声与音频切片信息。',
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

  return [muyuKnock, muyuAutoKnock, muyuGetMerit, muyuSelectSutra, muyuPlaySound]
}
