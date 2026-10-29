import type { Context } from '../shims.js';
import type { MuyuSoundType, KnockResult, AutoKnockStatus, MeritStats, SutraBook, SutraSentence, TokenConsumeResult } from '../types.js';
import type { MuyuConfig } from '../config.js';
export declare class MuyuService {
    ctx: Context;
    config: MuyuConfig;
    private storage;
    private chantService;
    private stateStorage;
    private currentSound;
    private autoKnockTimer;
    private autoStatus;
    private assetsDir;
    /** Last sentence actually chanted by a knock, used by the widget to speak the right line. */
    private lastChantedSentence;
    /** Monotonic counter incremented once per knock, so the widget can detect new chants. */
    private chantSeq;
    constructor(ctx: Context, config?: MuyuConfig);
    getSoundType(): MuyuSoundType;
    setSoundType(type: MuyuSoundType): boolean;
    getSoundFile(type?: MuyuSoundType): string;
    private getVoiceSettings;
    /**
     * Perform a single-write knock that adds `amount` merit and advances the sutra by 1 sentence.
     */
    knock(amount?: number, tokens?: number): KnockResult;
    /**
     * Perform a batch of knocks with a SINGLE disk write while advancing the sutra `count` times.
     * The ledger add is atomic across processes; the returned per-step merit values are derived
     * from the post-write snapshot.
     */
    knockBatch(count: number, tokens?: number, pendingTokens?: number): KnockResult[];
    private buildKnockResults;
    /**
     * Consume LLM tokens, accumulate remainder in persistent pendingTokens, and trigger up to 108 knocks per call
     * with a single disk write.
     */
    consumeTokens(tokens: number): TokenConsumeResult;
    getPendingTokens(): number;
    getTokensPerMerit(): number;
    startAutoKnock(targetCount?: number, intervalMs?: number, cycleTitle?: string, maxDurationMs?: number): AutoKnockStatus;
    stopAutoKnock(): AutoKnockStatus;
    getAutoKnockStatus(): AutoKnockStatus;
    getMeritStats(): MeritStats;
    getSutra(): SutraBook;
    getAllSutras(): SutraBook[];
    selectSutra(bookId: string): boolean;
    private persistState;
    getCurrentSentence(): SutraSentence;
    getLastChantedSentence(): SutraSentence | null;
    getChantSeq(): number;
}
//# sourceMappingURL=muyu-service.d.ts.map