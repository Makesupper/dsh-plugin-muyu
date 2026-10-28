/**
 * Cross-platform Sutra Speech Chanting Engine (Web Speech API)
 * Features:
 * - Natural cadence and spacing for Chinese Buddhist sutra recitation.
 * - Configurable pacing (rate, pitch, volume) with safe clamping.
 * - Uses the selected voice's actual language tag (`this.voice.lang`) so Cantonese (`zh-HK` / `yue`)
 *   and Mandarin voices pronounce authentically.
 * - Clean listener lifecycle (`addEventListener` / `removeEventListener` + timer cleanup on `dispose()`).
 */
export interface VoiceOption {
    id: string;
    name: string;
    lang: string;
    description: string;
    isCantonese: boolean;
}
export interface SpeechPreferences {
    rate?: number;
    pitch?: number;
    volume?: number;
    voiceId?: string;
}
export declare class SutraSpeechSynthesizer {
    private synth;
    private voice;
    private selectedVoiceId;
    private voicesChangedHandler;
    private fallbackTimer;
    enabled: boolean;
    rate: number;
    pitch: number;
    volume: number;
    onSentenceEnd?: () => void;
    onVoicesLoaded?: (voices: VoiceOption[], currentId: string) => void;
    constructor(prefs?: SpeechPreferences);
    private initVoice;
    private checkIsCantonese;
    private checkIsFemale;
    private notifyVoicesLoaded;
    getAvailableVoiceOptions(): VoiceOption[];
    setVoice(voiceId: string): boolean;
    getSelectedVoiceId(): string;
    getSelectedVoiceName(): string;
    isSpeaking(): boolean;
    private formatRhythmicText;
    chantSentence(text: string, onEnd?: () => void): void;
    stop(): void;
    dispose(): void;
}
//# sourceMappingURL=speech-synthesizer.d.ts.map