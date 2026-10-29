/**
 * Muyu Floating Widget UI Component
 * Features:
 * - Clean, consolidated single-row capsule dock in expanded mode (Auto, Voice, Merit, Settings, Collapse)
 * - Unified Zen Settings Sheet (禅修设置) with segmented tabs for Sutra, Sound Preset, and Voice
 * - Mini Zen Mode when collapsed: draggable header pill + compact sutra bubble + mini wooden fish + expand button
 * - Scoped DOM & full lifecycle cleanup on unmount()
 */
import type { MuyuSoundType } from '../types.js';
import type { SoundPresetOption } from './sound-player.js';
export interface SutraItem {
    id: string;
    title: string;
    summary: string;
    sentences: string[];
}
export interface MeritHistoryItem {
    dateKey: string;
    displayDate: string;
    count: number;
    tokens?: number;
}
export interface VoiceItem {
    id: string;
    name: string;
    lang: string;
    description: string;
    isCantonese: boolean;
}
export interface WidgetOptions {
    onKnock?: () => void;
    onToggleAuto?: () => void;
    onToggleVoice?: (enabled: boolean) => void;
    onToggleSound?: (enabled: boolean) => void;
    onSelectSutra?: (bookId: string) => void;
    getTokensPerMerit?: () => number;
    onSetTokensPerMerit?: (value: number) => Promise<boolean> | boolean | void;
    isTokensPerMeritSupported?: () => boolean;
    onSelectVoice?: (voiceId: string) => void;
    onSelectSound?: (soundId: MuyuSoundType) => void;
    onOpenMerit?: () => void;
    getVoiceList?: () => VoiceItem[];
    getCurrentVoiceId?: () => string;
    getSoundPresets?: () => SoundPresetOption[];
    getCurrentSoundId?: () => MuyuSoundType;
    sutraList: SutraItem[];
    currentBookId: string;
    initialVoiceEnabled?: boolean;
    initialSoundEnabled?: boolean;
    getMeritRecords: () => {
        todayMerit: number;
        totalMerit: number;
        todayTokens?: number;
        totalTokens?: number;
        pendingTokens?: number;
        records: MeritHistoryItem[];
    };
}
export declare function createMuyuFloatingPet(options: WidgetOptions): {
    mount(target?: HTMLElement): void;
    unmount: () => void;
    update(merit: number, sentence: string, isAutoRunning?: boolean, tokenStats?: {
        todayTokens: number;
        totalTokens: number;
    }): void;
    triggerKnockEffect: (text?: string) => void;
    animateKnock: () => void;
};
//# sourceMappingURL=widget-ui.d.ts.map