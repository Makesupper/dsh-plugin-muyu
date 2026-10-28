/**
 * Cross-platform Sutra Speech Chanting Engine (Web Speech API)
 * Features:
 * - Natural cadence and spacing for Chinese Buddhist sutra recitation.
 * - Configurable pacing (rate, pitch, volume) with safe clamping.
 * - Uses the selected voice's actual language tag (`this.voice.lang`) so Cantonese (`zh-HK` / `yue`)
 *   and Mandarin voices pronounce authentically.
 * - Clean listener lifecycle (`addEventListener` / `removeEventListener` + timer cleanup on `dispose()`).
 */
function clamp(val, fallback, min, max) {
    if (typeof val !== 'number' || !Number.isFinite(val))
        return fallback;
    return Math.min(max, Math.max(min, val));
}
export class SutraSpeechSynthesizer {
    synth = null;
    voice = null;
    selectedVoiceId = '';
    voicesChangedHandler = null;
    fallbackTimer = null;
    enabled = true;
    rate = 0.72;
    pitch = 0.92;
    volume = 1.0;
    onSentenceEnd;
    onVoicesLoaded;
    constructor(prefs) {
        if (prefs) {
            this.rate = clamp(prefs.rate, 0.72, 0.1, 2.0);
            this.pitch = clamp(prefs.pitch, 0.92, 0.1, 2.0);
            this.volume = clamp(prefs.volume, 1.0, 0.0, 1.0);
            if (prefs.voiceId) {
                this.selectedVoiceId = prefs.voiceId;
            }
        }
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.initVoice();
            this.voicesChangedHandler = () => this.initVoice();
            if (typeof this.synth.addEventListener === 'function') {
                this.synth.addEventListener('voiceschanged', this.voicesChangedHandler);
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
        // Prioritize Cantonese female voice -> any Cantonese -> Mandarin female -> any Chinese
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
    formatRhythmicText(text) {
        return text.replace(/，/g, '， ').replace(/。/g, '。 ');
    }
    chantSentence(text, onEnd) {
        if (!this.enabled || !this.synth) {
            if (onEnd)
                onEnd();
            return;
        }
        if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
        }
        this.synth.cancel();
        const rhythmicText = this.formatRhythmicText(text);
        const utterance = new SpeechSynthesisUtterance(rhythmicText);
        if (this.voice) {
            utterance.voice = this.voice;
            utterance.lang = this.voice.lang || 'zh-CN';
        }
        else {
            utterance.lang = 'zh-CN';
        }
        utterance.rate = clamp(this.rate, 0.72, 0.1, 2.0);
        utterance.pitch = clamp(this.pitch, 0.92, 0.1, 2.0);
        utterance.volume = clamp(this.volume, 1.0, 0.0, 1.0);
        let finished = false;
        const done = () => {
            if (finished)
                return;
            finished = true;
            if (this.fallbackTimer) {
                clearTimeout(this.fallbackTimer);
                this.fallbackTimer = null;
            }
            if (onEnd)
                onEnd();
            if (this.onSentenceEnd)
                this.onSentenceEnd();
        };
        utterance.onend = done;
        utterance.onerror = done;
        const expectedDurationMs = Math.max(2500, (rhythmicText.length / 2.5) * 1000 + 1500);
        this.fallbackTimer = setTimeout(() => {
            if (!finished && !this.isSpeaking()) {
                done();
            }
        }, expectedDurationMs);
        this.synth.speak(utterance);
    }
    stop() {
        if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
        }
        if (this.synth) {
            this.synth.cancel();
        }
    }
    dispose() {
        this.stop();
        if (this.synth && this.voicesChangedHandler && typeof this.synth.removeEventListener === 'function') {
            this.synth.removeEventListener('voiceschanged', this.voicesChangedHandler);
        }
        this.voicesChangedHandler = null;
    }
}
//# sourceMappingURL=speech-synthesizer.js.map