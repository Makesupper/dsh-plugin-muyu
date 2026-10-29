/**
 * In-browser Web Audio synthesized & preset player for Muyu wooden fish.
 * Supports three distinct physical acoustic profiles:
 * - sandalwood (紫檀沉音): deep, warm temple wood resonance
 * - whitewood  (清脆白木): bright, crisp, high-pitched wood block
 * - bell       (古刹清磬): sustained bronze singing bowl / temple bell harmonics
 */
import type { MuyuSoundType } from '../types.js';
export interface SoundPresetOption {
    id: MuyuSoundType;
    name: string;
    description: string;
}
export declare const CLIENT_SOUND_PRESETS: SoundPresetOption[];
export declare class MuyuWebAudioPlayer {
    private ctx;
    private currentSound;
    volume: number;
    /** Independent from the sutra voice toggle: mute only the wooden-fish/percussion sound. */
    muted: boolean;
    constructor(initialSound?: MuyuSoundType);
    private initContext;
    setSoundType(type: MuyuSoundType): void;
    getSoundType(): MuyuSoundType;
    getSoundPresets(): SoundPresetOption[];
    /**
     * Synthesize real physical wooden fish or temple bell percussion using Web Audio oscillators & filters
     */
    playWoodenSound(overrideType?: MuyuSoundType): void;
    dispose(): void;
}
//# sourceMappingURL=sound-player.d.ts.map