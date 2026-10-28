/**
 * Cross-platform Sutra Speech Chanting Engine (Web Speech API)
 * Features:
 * - Natural cadence and spacing for Chinese Buddhist sutra recitation.
 * - Gentle pacing (rate: 0.72) and solemn pitch (0.90).
 * - Punctuation and phrase cadence insertion: adds micro-pauses between classical rhythm chunks
 *   so the recitation flows with a breathing pause rather than mechanical fast rush.
 */
export declare class SutraSpeechSynthesizer {
    private synth;
    private voice;
    enabled: boolean;
    onSentenceEnd?: () => void;
    constructor();
    private initVoice;
    isSpeaking(): boolean;
    /**
     * Format sutra sentence to rhythmic cadence.
     * Classical sutra has a 4-character / 2-character natural chanting rhythm.
     * Adding gentle commas or slight breathing spaces prevents Web Speech API from rushing words.
     */
    private formatRhythmicText;
    chantSentence(text: string, onEnd?: () => void): void;
    stop(): void;
}
//# sourceMappingURL=speech-synthesizer.d.ts.map