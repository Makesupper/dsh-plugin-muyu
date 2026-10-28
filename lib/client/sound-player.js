/**
 * In-browser Web Audio synthesized & sample player for Muyu wooden fish
 */
export class MuyuWebAudioPlayer {
    ctx = null;
    initContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    /**
     * Synthesize real physical wooden fish resonant percussion using Web Audio oscillator & filter
     */
    playWoodenSound(pitchMultiplier = 1.0) {
        this.initContext();
        if (!this.ctx)
            return;
        const now = this.ctx.currentTime;
        // Fundamental body resonance
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'triangle';
        const baseFreq = 220 * pitchMultiplier;
        osc.frequency.setValueAtTime(baseFreq * 2.2, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.04);
        // Resonant bandpass filter
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(baseFreq * 1.5, now);
        filter.Q.setValueAtTime(4.0, now);
        // Wood impact envelope
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
    }
}
//# sourceMappingURL=sound-player.js.map