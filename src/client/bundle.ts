/**
 * DSH Official Client Bundle entry
 * Complies with DSH lazy CJS model: window.__ModuleLoader__.load({ id, factory })
 */

import { createMuyuFloatingPet, type SutraItem, type MeritHistoryItem } from './widget-ui.js'
import { MuyuWebAudioPlayer } from './sound-player.js'
import { SutraSpeechSynthesizer } from './speech-synthesizer.js'

function buildExports(require?: any) {
  return {
    name: 'muyu-client',
    inject: ['slots'],
    apply(ctx: any) {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return
      }

      const audioPlayer = new MuyuWebAudioPlayer()
      const speechSynth = new SutraSpeechSynthesizer()

      // Local storage persistence for merit
      const STORAGE_KEY = 'dsh_muyu_client_merit'
      let meritData = {
        todayMerit: 0,
        totalMerit: 0,
        records: [] as MeritHistoryItem[],
        lastDate: new Date().toLocaleDateString('zh-CN')
      }

      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          meritData = { ...meritData, ...parsed }
          const today = new Date().toLocaleDateString('zh-CN')
          if (meritData.lastDate !== today) {
            meritData.todayMerit = 0
            meritData.lastDate = today
          }
        }
      } catch {}

      const saveMerit = (count: number = 1) => {
        const today = new Date().toLocaleDateString('zh-CN')
        const dateKey = new Date().toISOString().slice(0, 10)
        meritData.todayMerit += count
        meritData.totalMerit += count

        let rec = meritData.records.find(r => r.dateKey === dateKey)
        if (!rec) {
          rec = { dateKey, displayDate: today, count: 0 }
          meritData.records.unshift(rec)
        }
        rec.count += count
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(meritData))
        } catch {}
      }

      // Predefined 8 Sutras
      const sutraLibrary: SutraItem[] = [
        {
          id: 'heart_sutra',
          title: '般若波罗蜜多心经',
          summary: '玄奘大师译本，阐释五蕴皆空与般若究竟智慧，共260字。',
          sentences: [
            '观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。',
            '舍利子，色不异空，空不异色，色即是空，空即是色。',
            '受想行识，亦复如是。舍利子，是诸法空相。',
            '不生不灭，不垢不净，不增不减。',
            '是故空中无色，无受想行识，无眼耳鼻舌身意，无色声香味触法。',
            '无眼界，乃至无意识界，无无明，亦无无明尽，乃至无老死，亦无老死尽。',
            '无苦集灭道，无智亦无得，以无所得故。',
            '菩提萨埵，依般若波罗蜜多故，心无挂碍。',
            '无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。',
            '三世诸佛，依般若波罗蜜多故，得阿耨多罗三藐三菩提。',
            '故知般若波罗蜜多，是大神咒，是大明咒，是无上咒，是无等等咒。',
            '能除一切苦，真实不虚。故说般若波罗蜜多咒，即说咒曰：',
            '揭谛揭谛，波罗揭谛，波罗僧揭谛，菩提萨婆诃。'
          ]
        },
        {
          id: 'vajra_sutra',
          title: '金刚般若波罗蜜经',
          summary: '阐述无相破执、应无所住而生其心的至高禅意经王。',
          sentences: [
            '凡所有相，皆是虚妄。若见诸相非相，则见如来。',
            '不应住色生心，不应住声香味触法生心，应无所住而生其心。',
            '一切有为法，如梦幻泡影，如露亦如电，应作如是观。',
            '若以色见我，以音声求我，是人行邪道，不能见如来。',
            '知我说法，如筏喻者；法尚应舍，何况非法。',
            '过去心不可得，现在心不可得，未来心不可得。',
            '如来者，无所从来，亦无所去，故名如来。'
          ]
        },
        {
          id: 'dharani',
          title: '大悲心陀罗尼神咒',
          summary: '千手千眼观世音菩萨无碍大悲神咒，消灾降福、除一切障。',
          sentences: [
            '南无喝啰怛那哆啰夜耶，南无阿唎耶。',
            '婆卢羯帝烁钵啰耶，菩提萨埵婆耶，摩诃萨埵婆耶，摩诃迦卢尼迦耶。',
            '唵，萨皤啰罚曳，数怛那怛写。',
            '南无悉吉栗埵伊蒙阿唎耶，婆卢吉帝室佛啰楞驮婆。',
            '南无那啰谨墀，醯利摩诃皤哆沙咩。',
            '萨婆阿他豆输朋，阿逝孕，萨婆萨哆那摩婆萨哆，那摩婆伽，摩罚特豆。',
            '怛侄他：唵，阿婆卢醯，卢迦帝，迦罗帝，夷醯利，摩诃菩提萨埵。'
          ]
        },
        {
          id: 'zen_verses',
          title: '六字真言与禅林名偈',
          summary: '菩提本无树、明镜亦非台，历代祖师禅修清净偈语。',
          sentences: [
            '嗡嘛呢叭咪吽，大慈大悲，福慧双增，一切业障咸皆消除。',
            '南无阿弥陀佛，极乐清凉，身心安宁，诸佛护念。',
            '一花一世界，一叶一菩提，一刹那即是清净永恒。',
            '身如菩提树，心如明镜台，时时勤拂拭，勿使惹尘埃。',
            '菩提本无树，明镜亦非台，本来无一物，何处惹尘埃。',
            '诸恶莫作，众善奉行，自净其意，是诸佛教。'
          ]
        },
        {
          id: 'medicine_buddha',
          title: '药师灌顶真言',
          summary: '药师琉璃光如来消灾延寿药师咒，拔除一切业障与身心疾苦。',
          sentences: [
            '南谟薄伽伐帝，鞞杀社，窭噜薜琉璃。',
            '钵喇婆，喝啰阇也，怛他揭多也，阿啰喝帝。',
            '三藐三勃陀也，怛侄他：',
            '唵，鞞杀逝，鞞杀逝，鞞杀社，三没揭帝，娑婆诃。'
          ]
        },
        {
          id: 'zhunti_mantra',
          title: '准提神咒',
          summary: '七俱胝佛母所说准提陀罗尼，求愿顺遂，能灭重罪，成就悉地。',
          sentences: [
            '稽首皈依苏悉帝，头面顶礼七俱胝。',
            '我今称赞大准提，唯愿慈悲垂加护。',
            '南无飒哆喃，三藐三菩陀，俱胝喃，怛侄他：',
            '唵，折隶，主隶，准提，娑婆诃。'
          ]
        },
        {
          id: 'amitabha_rebirth',
          title: '往生咒（拔一切业障根本）',
          summary: '阿弥陀佛极乐净土陀罗尼，清净拔苦，随念消业，常得安稳。',
          sentences: [
            '南无阿弥多婆夜，哆他伽多夜，哆地夜他。',
            '阿弥利都婆毗，阿弥利哆，悉耽婆毗。',
            '阿弥利哆，毗迦兰帝，阿弥利哆，毗迦兰多。',
            '伽弥腻，伽伽诺，枳多迦隶，娑婆诃。'
          ]
        },
        {
          id: 'shurangama_excerpt',
          title: '楞严咒心赞偈',
          summary: '大佛顶首楞严经启请清净偈与咒心，破诸障惑，开显妙心。',
          sentences: [
            '妙湛总持不动尊，首楞严王世稀有。',
            '销我亿劫颠倒想，不历僧祇获法身。',
            '愿今得果成宝王，还度如是恒沙众。',
            '将此深心奉尘刹，是则名为报佛恩。',
            '伏请世尊为证明，五浊恶世誓先入。',
            '如一众生未成佛，终不于此取泥洹。',
            '哆侄他：唵，阿那隶，毗舍提，鞞啰跋阇啰陀唎，槃陀槃陀你，跋阇啰谤尼泮，虎𤙖都嚧瓮泮，娑婆诃。'
          ]
        }
      ]

      let currentBook = sutraLibrary[0]
      let currentSentenceIndex = 0
      let isAuto = false
      let autoTimer: any = null

      const chantNextSentence = () => {
        const sentence = currentBook.sentences[currentSentenceIndex]
        speechSynth.chantSentence(sentence, () => {
          // Advance to next sentence ONLY when recitation finishes!
          currentSentenceIndex = (currentSentenceIndex + 1) % currentBook.sentences.length
          const nextSentence = currentBook.sentences[currentSentenceIndex]
          pet.update(meritData.todayMerit, nextSentence, isAuto)
          if (isAuto) {
            chantNextSentence()
          }
        })
      }

      const handleKnock = () => {
        saveMerit(1)
        audioPlayer.playWoodenSound()
        pet.update(meritData.todayMerit, currentBook.sentences[currentSentenceIndex], isAuto)

        // If not currently chanting, start chanting current sentence
        if (!speechSynth.isSpeaking()) {
          chantNextSentence()
        }
      }

      const pet = createMuyuFloatingPet({
        sutraList: sutraLibrary,
        currentBookId: currentBook.id,
        getMeritRecords: () => ({
          todayMerit: meritData.todayMerit,
          totalMerit: meritData.totalMerit,
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
              saveMerit(1)
              audioPlayer.playWoodenSound()
              pet.animateKnock()
              pet.triggerKnockEffect('功德 +1')
              pet.update(meritData.todayMerit, currentBook.sentences[currentSentenceIndex], isAuto)
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
          pet.update(meritData.todayMerit, currentBook.sentences[currentSentenceIndex], isAuto)
        },
        onToggleVoice: (enabled: boolean) => {
          speechSynth.enabled = enabled
          if (!enabled) {
            speechSynth.stop()
          }
        },
        onSelectSutra: (bookId: string) => {
          const found = sutraLibrary.find(b => b.id === bookId)
          if (found) {
            currentBook = found
            currentSentenceIndex = 0
            speechSynth.stop()
            pet.update(meritData.todayMerit, currentBook.sentences[0], isAuto)
            if (isAuto) {
              chantNextSentence()
            }
          }
        }
      })

      // Mount into DSH root DOM
      const mount = () => {
        pet.mount(document.body)
        pet.update(meritData.todayMerit, currentBook.sentences[0], isAuto)
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', mount, { once: true })
      } else {
        mount()
      }

      // Cleanup on unload
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => () => {
          if (autoTimer) clearInterval(autoTimer)
          speechSynth.stop()
          pet.unmount()
        })
      }

      console.log('[dsh-plugin-muyu:client] 3D 木鱼挂件已完全加载（包含木槌交互、功德簿、经典宝库与连贯诵经）')
    }
  }
}

// 1. Export for Node / standard ESM/CJS
export const name = 'muyu-client'
export const inject = ['slots']
export function apply(ctx: any) {
  return buildExports().apply(ctx)
}

// 2. Register into window.__ModuleLoader__ for DSH Client runtime
if (typeof window !== 'undefined' && (window as any).__ModuleLoader__) {
  (window as any).__ModuleLoader__.load({
    id: 'dsh-plugin-muyu',
    factory: (require: any) => buildExports(require)
  })
}
