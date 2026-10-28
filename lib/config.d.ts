import Schema from './shims.js';
import type { MuyuSoundType } from './types.js';
export interface MuyuConfig {
    defaultSutra?: string;
    defaultSound?: MuyuSoundType;
    autoKnockIntervalMs?: number;
    autoKnockMaxDurationMs?: number;
    voiceEnabled?: boolean;
    voiceRate?: number;
    voicePitch?: number;
    volume?: number;
    storagePath?: string;
    tokenKnockEnabled?: boolean;
    tokensPerMerit?: number;
}
export declare const Config: Schema<MuyuConfig>;
//# sourceMappingURL=config.d.ts.map