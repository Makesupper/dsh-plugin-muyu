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
    selectedVoiceId = '';
    enabled = true;
    onSentenceEnd;
    onVoicesLoaded;
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
        if (!voices || voices.length === 0)
            return;
        if (this.selectedVoiceId) {
            const found = voices.find(v => `${v.name}__${v.lang}` === this.selectedVoiceId);
            if (found) {
                this.voice = found;
                this.notifyVoicesLoaded();
                return;
            }
        }
        const cantoneseFemale = voices.find(v => this.checkIsCantonese(v) && this.checkIsFemale(v));
        const anyCantonese = voices.find(v => this.checkIsCantonese(v));
        const mandarinFemale = voices.find(v => (v.lang.includes('zh') || v.lang.includes('CN')) && this.checkIsFemale(v));
        const anyChinese = voices.find(v => v.lang.includes('zh'));
        this.voice = cantoneseFemale || anyCantonese || mandarinFemale || anyChinese || voices[0] || null;
        if (this.voice) {
            this.selectedVoiceId = `${this.voice.name}__${this.voice.lang}`;
        }
        this.notifyVoicesLoaded();
    }
    checkIsCantonese(v) {
        const lang = (v.lang || '').toLowerCase();
        const name = (v.name || '').toLowerCase();
        return (lang === 'zh-hk' ||
            lang.startsWith('zh-hk') ||
            lang === 'yue' ||
            lang.startsWith('yue') ||
            lang === 'zh-mo' ||
            name.includes('sinji') ||
            name.includes('cantonese') ||
            name.includes('hong kong') ||
            name.includes('香港') ||
            name.includes('粤语') ||
            name.includes('廣東'));
    }
    checkIsFemale(v) {
        const name = (v.name || '').toLowerCase();
        return (name.includes('sinji') ||
            name.includes('tingting') ||
            name.includes('xiaoxiao') ||
            name.includes('meijia') ||
            name.includes('shelley') ||
            name.includes('sandy') ||
            name.includes('flo') ||
            name.includes('female') ||
            name.includes('女') ||
            name.includes('善怡') ||
            name.includes('美佳') ||
            name.includes('婷婷'));
    }
    notifyVoicesLoaded() {
        if (this.onVoicesLoaded) {
            this.onVoicesLoaded(this.getAvailableVoiceOptions(), this.selectedVoiceId);
        }
    }
    getAvailableVoiceOptions() {
        if (!this.synth)
            return [];
        const voices = this.synth.getVoices();
        const chineseVoices = voices.filter(v => {
            const lang = (v.lang || '').toLowerCase();
            const name = (v.name || '').toLowerCase();
            return lang.includes('zh') || lang.includes('yue') || name.includes('cantonese') || name.includes('hong kong');
        });
        const list = chineseVoices.length > 0 ? chineseVoices : voices;
        return list.map(v => {
            const isCantonese = this.checkIsCantonese(v);
            let desc = v.lang;
            if (isCantonese) {
                desc = '粤语 / 广东话';
            }
            else if (v.lang.toLowerCase().includes('cn')) {
                desc = '普通话 (中国大陆)';
            }
            else if (v.lang.toLowerCase().includes('tw')) {
                desc = '国语 (中国台湾)';
            }
            return {
                id: `${v.name}__${v.lang}`,
                name: v.name,
                lang: v.lang,
                description: desc,
                isCantonese
            };
        });
    }
    setVoice(voiceId) {
        if (!this.synth)
            return false;
        const voices = this.synth.getVoices();
        const found = voices.find(v => `${v.name}__${v.lang}` === voiceId);
        if (found) {
            this.voice = found;
            this.selectedVoiceId = voiceId;
            return true;
        }
        return false;
    }
    getSelectedVoiceId() {
        return this.selectedVoiceId;
    }
    getSelectedVoiceName() {
        if (!this.voice)
            return '默认粤语女声';
        return this.voice.name;
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