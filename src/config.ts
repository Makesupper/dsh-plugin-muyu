import Schema from './shims.js'
import type { MuyuSoundType } from './types.js'

export interface MuyuConfig {
  defaultSutra?: string
  defaultSound?: MuyuSoundType
  autoKnockIntervalMs?: number
  autoKnockMaxDurationMs?: number
  voiceEnabled?: boolean
  voiceRate?: number
  voicePitch?: number
  volume?: number
  storagePath?: string
  tokenKnockEnabled?: boolean
  tokensPerMerit?: number
}

export const Config: Schema<MuyuConfig> = Schema.object({
  defaultSutra: Schema.string()
    .default('heart_sutra')
    .description('默认诵读经文 ID（服务端工具生效），例如 heart_sutra、vajra_sutra'),
  defaultSound: Schema.union(['sandalwood', 'whitewood', 'bell'])
    .default('sandalwood')
    .description('默认木鱼音色（服务端工具生效）：sandalwood(紫檀沉音)、whitewood(清脆白木)、bell(古刹清磬)'),
  autoKnockIntervalMs: Schema.number()
    .min(200)
    .max(60000)
    .default(1200)
    .description('自动敲击节拍间隔(毫秒，范围 200 ~ 60000)'),
  autoKnockMaxDurationMs: Schema.number()
    .min(1000)
    .max(86400000)
    .default(1800000)
    .description('无尽修持单次最大持续时长(毫秒，默认 30 分钟自动停止防遗忘)'),
  voiceEnabled: Schema.boolean()
    .default(true)
    .description('是否默认开启诵经语音提示配置'),
  voiceRate: Schema.number()
    .min(0.1)
    .max(2.0)
    .default(0.8)
    .description('诵经语音语速 (0.1 ~ 2.0，0.8 为舒缓诵读)'),
  voicePitch: Schema.number()
    .min(0.1)
    .max(2.0)
    .default(0.95)
    .description('诵经语音音调 (0.1 ~ 2.0，0.95 为沉稳端庄)'),
  volume: Schema.number()
    .min(0.0)
    .max(1.0)
    .default(1.0)
    .description('声音音量 (0.0 ~ 1.0)'),
  storagePath: Schema.string()
    .description('功德记录自定义持久化存储路径（留空则优先使用 $DSH_HOME/muyu-data/merit_history.json，否则保存在 ~/.dsh/muyu-data/）'),
  tokenKnockEnabled: Schema.boolean()
    .default(true)
    .description('是否开启按会话消耗 Token 自动敲木鱼积攒功德'),
  tokensPerMerit: Schema.number()
    .min(1)
    .max(10000000)
    .default(10000)
    .description('敲击一次木鱼积攒一点功德所需的 Token 消耗阈值（默认 10000 Tokens）')
})
