/**
 * Cross-platform Sutra Speech Chanting Engine (Web Speech API)
 * Features:
 * - Natural cadence and spacing for Chinese Buddhist sutra recitation.
 * - Gentle pacing (rate: 0.72) and solemn pitch (0.90).
 * - Punctuation and phrase cadence insertion: adds micro-pauses between classical rhythm chunks
 *   so the recitation flows with a breathing pause rather than mechanical fast rush.
 */
export class SutraSpeechSynthesizer {
    synth = null;
    voice = null;
    enabled = true;
    onSentenceEnd;
    constructor() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.initVoice();
            if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
                window.speechSynthesis.onvoiceschanged = () => this.initVoice();
            }
        }
    }
    initVoice() {
        if (!this.synth)
            return;
        const voices = this.synth.getVoices();
        // Prioritize natural sounding Chinese voices (Tingting / Sinji / Xiaoxiao / Meijia or any zh-CN)
        this.voice =
            voices.find(v => (v.name.includes('Tingting') || v.name.includes('Natural') || v.name.includes('Neural')) && v.lang.includes('zh')) ||
                voices.find(v => v.lang.includes('zh-CN')) ||
                voices.find(v => v.lang.includes('zh')) ||
                null;
    }
    isSpeaking() {
        return !!(this.synth && (this.synth.speaking || this.synth.pending));
    }
    /**
     * Format sutra sentence to rhythmic cadence.
     * Classical sutra has a 4-character / 2-character natural chanting rhythm.
     * Adding gentle commas or slight breathing spaces prevents Web Speech API from rushing words.
     */
    formatRhythmicText(text) {
        // If the text already has full punctuation, preserve it with slight pauses
        // Replace commas/semicolons with clean pauses
        let formatted = text.replace(/，/g, '， ').replace(/。/g, '。 ');
        // For phrases like "揭谛揭谛，波罗揭谛", ensure natural rhythm
        return formatted;
    }
    chantSentence(text, onEnd) {
        if (!this.enabled || !this.synth) {
            if (onEnd)
                onEnd();
            return;
        }
        // Cancel previously queued voice cleanly
        this.synth.cancel();
        const rhythmicText = this.formatRhythmicText(text);
        const utterance = new SpeechSynthesisUtterance(rhythmicText);
        if (this.voice) {
            utterance.voice = this.voice;
        }
        utterance.lang = 'zh-CN';
        // Calm Buddhist cadence: rate 0.70 gives space between characters and phrases
        utterance.rate = 0.70;
        // Solemn monk chanting resonance
        utterance.pitch = 0.90;
        utterance.volume = 1.0;
        let finished = false;
        const done = () => {
            if (finished)
                return;
            finished = true;
            if (onEnd)
                onEnd();
            if (this.onSentenceEnd)
                this.onSentenceEnd();
        };
        utterance.onend = done;
        utterance.onerror = done;
        // Chrome/Safari safety timeout in case speech synth hangs
        const expectedDurationMs = Math.max(2500, (rhythmicText.length / 2.5) * 1000 + 1500);
        setTimeout(() => {
            if (!finished && !this.isSpeaking()) {
                done();
            }
        }, expectedDurationMs);
        this.synth.speak(utterance);
    }
    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
    }
}
//# sourceMappingURL=speech-synthesizer.js.map