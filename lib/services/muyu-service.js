import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeritStorage } from './merit-storage.js';
import { ChantService } from './chant-service.js';
import { RuntimeStateStorage } from './state-storage.js';
import { soundLibrary } from '../data/sounds.js';
const MAX_KNOCK_BATCH = 108;
const MIN_INTERVAL_MS = 200;
const MAX_INTERVAL_MS = 60000;
const DEFAULT_MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes
function clampNumber(val, fallback, min, max) {
    const num = Number(val);
    if (!Number.isFinite(num))
        return fallback;
    return Math.min(max, Math.max(min, num));
}
function clampCount(val, fallback = 1, max = MAX_KNOCK_BATCH) {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0)
        return fallback;
    return Math.min(max, Math.max(1, Math.floor(num)));
}
function clampSignedStep(val, fallback = 10000) {
    const num = Number(val);
    if (!Number.isFinite(num) || num === 0)
        return fallback;
    const sign = num < 0 ? -1 : 1;
    return sign * Math.min(10000000, Math.max(1, Math.floor(Math.abs(num))));
}
export class MuyuService {
    ctx;
    config;
    storage;
    chantService;
    stateStorage;
    tokensPerMeritOverride = null;
    currentSound = 'sandalwood';
    autoKnockTimer = null;
    autoStatus = {
        running: false,
        targetCount: 0,
        currentCount: 0,
        intervalMs: 1200,
        maxDurationMs: DEFAULT_MAX_DURATION_MS,
        cycleTitle: '无尽修持'
    };
    assetsDir;
    /** Last sentence actually chanted by a knock, used by the widget to speak the right line. */
    lastChantedSentence = null;
    /** Monotonic counter incremented once per knock, so the widget can detect new chants. */
    chantSeq = 0;
    constructor(ctx, config = {}) {
        this.ctx = ctx;
        this.config = config;
        this.storage = new MeritStorage(config.storagePath);
        this.stateStorage = new RuntimeStateStorage(config.storagePath);
        if (config.resetRuntimeState) {
            this.stateStorage.clear();
            this.tokensPerMeritOverride = null;
        }
        const persisted = config.resetRuntimeState ? {} : this.stateStorage.load();
        if (persisted.tokensPerMerit) {
            this.tokensPerMeritOverride = clampSignedStep(persisted.tokensPerMerit, 10000);
        }
        this.chantService = new ChantService(config.defaultSutra);
        if (persisted.bookId) {
            this.chantService.restore(persisted.bookId, persisted.sentenceIndex ?? 0);
        }
        this.lastChantedSentence = this.chantService.getCurrentSentence();
        if (config.defaultSound && soundLibrary[config.defaultSound]) {
            this.currentSound = config.defaultSound;
        }
        if (persisted.soundType && soundLibrary[persisted.soundType]) {
            this.currentSound = persisted.soundType;
        }
        // Materialize a legacy/step-change pending pool instead of dropping it. At most
        // 108 knocks are applied; only the sub-step remainder stays in pendingTokens.
        const persistedStep = this.getTokensPerMerit();
        const absStep = Math.abs(persistedStep);
        const direction = persistedStep < 0 ? -1 : 1;
        const persistedPending = this.storage.pendingTokens;
        if (this.config.tokenKnockEnabled !== false && persistedPending >= absStep) {
            const knocks = Math.min(MAX_KNOCK_BATCH, Math.floor(persistedPending / absStep));
            const nextPending = persistedPending % absStep;
            const meritDelta = direction * knocks;
            try {
                this.storage.addMeritDelta(meritDelta, 0, nextPending);
                if (meritDelta > 0) {
                    for (let i = 0; i < knocks; i++) {
                        const { current } = this.chantService.advanceSentence();
                        this.lastChantedSentence = current;
                    }
                    this.chantSeq += knocks;
                }
                this.persistState();
                console.warn(`[dsh-plugin-muyu] materialized ${meritDelta} pending merit and kept ${nextPending} pending tokens`);
            }
            catch (error) {
                console.warn('[dsh-plugin-muyu] failed to materialize pending tokens:', error);
            }
        }
        if (config.resetRuntimeState) {
            this.persistState();
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        this.assetsDir = path.resolve(__dirname, '../../assets/sounds');
        this.ctx.effect(() => {
            return () => {
                this.stopAutoKnock();
            };
        });
    }
    getSoundType() {
        return this.currentSound;
    }
    setSoundType(type) {
        if (soundLibrary[type]) {
            this.currentSound = type;
            this.persistState();
            return true;
        }
        return false;
    }
    getSoundFile(type) {
        const targetType = type || this.currentSound;
        const def = soundLibrary[targetType] || soundLibrary.sandalwood;
        return path.join(this.assetsDir, def.fileName);
    }
    getVoiceSettings() {
        return {
            rate: clampNumber(this.config.voiceRate, 0.8, 0.1, 2.0),
            pitch: clampNumber(this.config.voicePitch, 0.95, 0.1, 2.0),
            volume: clampNumber(this.config.volume, 1.0, 0.0, 1.0)
        };
    }
    /**
     * Perform a single-write knock that adds `amount` merit and advances the sutra by 1 sentence.
     */
    knock(amount = 1, tokens = 0) {
        const safeAmount = clampCount(amount, 1, MAX_KNOCK_BATCH);
        const safeTokens = Number.isFinite(Number(tokens)) && Number(tokens) > 0 ? Math.floor(Number(tokens)) : 0;
        const { todayMerit, totalMerit, todayTokens, totalTokens, pendingTokens } = this.storage.addMerit(safeAmount, safeTokens);
        const { current, next, cycleCompleted, completedCycles } = this.chantService.advanceSentence();
        this.lastChantedSentence = current;
        this.chantSeq += 1;
        this.persistState();
        const soundFile = this.getSoundFile();
        const voice = this.getVoiceSettings();
        return {
            amount: safeAmount,
            todayMerit,
            totalMerit,
            todayTokens,
            totalTokens,
            currentSentence: current,
            nextSentence: next,
            cycleCompleted,
            completedCycles,
            soundType: this.currentSound,
            soundFile,
            tokensConsumed: safeTokens,
            pendingTokens,
            voicePrompt: {
                text: current.text + '　',
                lang: 'zh-CN',
                rate: voice.rate,
                pitch: voice.pitch,
                volume: voice.volume
            }
        };
    }
    /**
     * Perform a batch of knocks with a SINGLE disk write while advancing the sutra `count` times.
     * The ledger add is atomic across processes; the returned per-step merit values are derived
     * from the post-write snapshot.
     */
    knockBatch(count, tokens = 0, pendingTokens) {
        const safeCount = clampCount(count, 1, MAX_KNOCK_BATCH);
        const safeTokens = Number.isFinite(Number(tokens)) && Number(tokens) > 0 ? Math.floor(Number(tokens)) : 0;
        const stats = this.storage.addMerit(safeCount, safeTokens, pendingTokens);
        return this.buildKnockResults(safeCount, stats, safeTokens);
    }
    buildKnockResults(count, stats, tokensConsumed) {
        const safeCount = Math.max(1, count);
        const soundFile = this.getSoundFile();
        const voice = this.getVoiceSettings();
        const todayBase = stats.todayMerit - safeCount;
        const totalBase = stats.totalMerit - safeCount;
        const results = [];
        for (let i = 0; i < safeCount; i++) {
            const { current, next, cycleCompleted, completedCycles } = this.chantService.advanceSentence();
            this.lastChantedSentence = current;
            results.push({
                amount: 1,
                todayMerit: todayBase + i + 1,
                totalMerit: totalBase + i + 1,
                todayTokens: stats.todayTokens,
                totalTokens: stats.totalTokens,
                currentSentence: current,
                nextSentence: next,
                cycleCompleted,
                completedCycles,
                soundType: this.currentSound,
                soundFile,
                tokensConsumed: i === safeCount - 1 ? tokensConsumed : 0,
                pendingTokens: stats.pendingTokens,
                voicePrompt: {
                    text: current.text + '　',
                    lang: 'zh-CN',
                    rate: voice.rate,
                    pitch: voice.pitch,
                    volume: voice.volume
                }
            });
        }
        this.chantSeq += safeCount;
        this.persistState();
        return results;
    }
    /**
     * Consume LLM tokens, accumulate remainder in persistent pendingTokens, and trigger up to 108 knocks per call
     * with a single disk write.
     */
    /**
     * Session/event usage: record the full token count, cap only the number of knocks.
     * The sub-step remainder is kept; capped-away whole steps are not carried as backlog.
     */
    consumeTokens(tokens) {
        return this.consumeTokenAmount(tokens, false);
    }
    /**
     * Manual/external feed: cap the accepted input at 108 x tokensPerMerit so a single
     * bad call cannot leave a multi-billion pending queue. Excess input is reported.
     */
    feedTokens(tokens) {
        return this.consumeTokenAmount(tokens, true);
    }
    consumeTokenAmount(tokens, capInput) {
        const numTokens = Number(tokens);
        const safeTokens = Number.isFinite(numTokens) && numTokens > 0 ? Math.round(numTokens) : 0;
        const step = this.getTokensPerMerit();
        const absStep = Math.abs(step);
        const maxTokensPerCall = MAX_KNOCK_BATCH * absStep;
        if (safeTokens === 0) {
            const stats = this.storage.getStats();
            return {
                tokensConsumed: 0,
                truncatedTokens: 0,
                pendingTokens: stats.pendingTokens,
                knocksTriggered: 0,
                meritGained: 0,
                todayMerit: stats.todayMerit,
                totalMerit: stats.totalMerit,
                todayTokens: stats.todayTokens,
                totalTokens: stats.totalTokens,
                knockResults: []
            };
        }
        const acceptedTokens = capInput ? Math.min(safeTokens, maxTokensPerCall) : safeTokens;
        const truncatedTokens = safeTokens - acceptedTokens;
        if (this.config.tokenKnockEnabled === false) {
            this.storage.addTokens(acceptedTokens);
            const stats = this.storage.getStats();
            return {
                tokensConsumed: acceptedTokens,
                truncatedTokens,
                pendingTokens: stats.pendingTokens,
                knocksTriggered: 0,
                meritGained: 0,
                todayMerit: stats.todayMerit,
                totalMerit: stats.totalMerit,
                todayTokens: stats.todayTokens,
                totalTokens: stats.totalTokens,
                knockResults: []
            };
        }
        const result = this.storage.consumeTokensAndKnock(acceptedTokens, step, MAX_KNOCK_BATCH, capInput);
        let knockResults = [];
        if (result.meritDelta > 0) {
            knockResults = this.buildKnockResults(result.meritDelta, result.stats, result.tokensAccepted);
        }
        return {
            tokensConsumed: result.tokensAccepted,
            truncatedTokens: safeTokens - result.tokensAccepted,
            pendingTokens: result.pendingTokens,
            knocksTriggered: result.meritDelta > 0 ? result.meritDelta : 0,
            meritGained: result.meritDelta,
            todayMerit: result.stats.todayMerit,
            totalMerit: result.stats.totalMerit,
            todayTokens: result.stats.todayTokens,
            totalTokens: result.stats.totalTokens,
            knockResults
        };
    }
    getPendingTokens() {
        return this.storage.getStats().pendingTokens;
    }
    getTokensPerMerit() {
        return this.tokensPerMeritOverride ?? clampSignedStep(this.config.tokensPerMerit, 10000);
    }
    setTokensPerMerit(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num === 0 || Math.abs(num) > 10000000) {
            return false;
        }
        const step = Math.trunc(num);
        if (step === 0)
            return false;
        this.tokensPerMeritOverride = step;
        this.persistState();
        return true;
    }
    startAutoKnock(targetCount = 0, intervalMs, cycleTitle, maxDurationMs) {
        this.stopAutoKnock();
        const safeTarget = Number.isFinite(Number(targetCount)) && Number(targetCount) >= 0
            ? Math.floor(Number(targetCount))
            : 108;
        const interval = clampNumber(intervalMs ?? this.config.autoKnockIntervalMs, 1200, MIN_INTERVAL_MS, MAX_INTERVAL_MS);
        const maxDuration = clampNumber(maxDurationMs ?? this.config.autoKnockMaxDurationMs, DEFAULT_MAX_DURATION_MS, 1000, 86400000);
        const startTime = Date.now();
        const trimmedTitle = typeof cycleTitle === 'string' ? cycleTitle.trim().slice(0, 80) : '';
        this.autoStatus = {
            running: true,
            targetCount: safeTarget,
            currentCount: 0,
            intervalMs: interval,
            maxDurationMs: maxDuration,
            cycleTitle: trimmedTitle || (safeTarget === 0 ? '无尽修持' : `${safeTarget} 次圆满`),
            startTime
        };
        this.autoKnockTimer = setInterval(() => {
            if (Date.now() - startTime >= maxDuration) {
                this.stopAutoKnock();
                return;
            }
            try {
                this.knock(1);
            }
            catch (error) {
                console.warn('[dsh-plugin-muyu] auto knock skipped (ledger busy):', error);
                return;
            }
            this.autoStatus.currentCount += 1;
            if (this.autoStatus.targetCount > 0 && this.autoStatus.currentCount >= this.autoStatus.targetCount) {
                this.stopAutoKnock();
            }
        }, interval);
        return { ...this.autoStatus };
    }
    stopAutoKnock() {
        if (this.autoKnockTimer) {
            clearInterval(this.autoKnockTimer);
            this.autoKnockTimer = null;
        }
        this.autoStatus.running = false;
        return { ...this.autoStatus };
    }
    getAutoKnockStatus() {
        return { ...this.autoStatus };
    }
    getMeritStats() {
        return this.storage.getStats();
    }
    getSutra() {
        return this.chantService.getBook();
    }
    getAllSutras() {
        return this.chantService.getAllBooks();
    }
    selectSutra(bookId) {
        const changed = this.chantService.setBook(bookId);
        if (changed) {
            this.lastChantedSentence = this.chantService.getCurrentSentence();
            this.persistState();
        }
        return changed;
    }
    persistState() {
        this.stateStorage.save({
            bookId: this.chantService.getBook().id,
            sentenceIndex: this.chantService.getSentenceIndex(),
            soundType: this.currentSound,
            tokensPerMerit: this.tokensPerMeritOverride ?? undefined
        });
    }
    getCurrentSentence() {
        return this.chantService.getCurrentSentence();
    }
    getLastChantedSentence() {
        return this.lastChantedSentence;
    }
    getChantSeq() {
        return this.chantSeq;
    }
}
//# sourceMappingURL=muyu-service.js.map