import Schema from './shims.js';
export const Config = Schema.object({
    defaultSutra: Schema.string().default('heart_sutra').description('默认诵读经文 ID，例如 heart_sutra、vajra_sutra'),
    defaultSound: Schema.union(['sandalwood', 'whitewood', 'bell']).default('sandalwood').description('默认木鱼音色：sandalwood(紫檀沉音)、whitewood(清脆白木)、bell(古刹清磬)'),
    autoKnockIntervalMs: Schema.number().default(1200).description('自动敲击节拍间隔(毫秒)'),
    voiceEnabled: Schema.boolean().default(true).description('是否默认开启跨平台诵经语音合成'),
    voiceRate: Schema.number().default(0.8).description('诵经语音语速 (0.1 ~ 2.0，0.8 为舒缓诵读)'),
    voicePitch: Schema.number().default(0.95).description('诵经语音音调 (0.1 ~ 2.0，0.95 为沉稳端庄)'),
    volume: Schema.number().default(1.0).description('声音音量 (0.0 ~ 1.0)'),
    storagePath: Schema.string().description('功德记录自定义持久化存储路径（留空则默认保存在 ~/.dsh/muyu-data/）')
});
//# sourceMappingURL=config.js.map