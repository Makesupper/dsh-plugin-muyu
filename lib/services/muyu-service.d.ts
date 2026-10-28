import type { Context } from '../shims.js';
import type { MuyuSoundType, KnockResult, AutoKnockStatus, MeritStats, SutraBook } from '../types.js';
import type { MuyuConfig } from '../config.js';
export declare class MuyuService {
    ctx: Context;
    config: MuyuConfig;
    private storage;
    private chantService;
    private currentSound;
    private autoKnockTimer;
    private autoStatus;
    private assetsDir;
    constructor(ctx: Context, config: MuyuConfig);
    getSoundType(): MuyuSoundType;
    setSoundType(type: MuyuSoundType): boolean;
    getSoundFile(type?: MuyuSoundType): string;
    knock(amount?: number): KnockResult;
    startAutoKnock(targetCount?: number, intervalMs?: number, cycleTitle?: string): AutoKnockStatus;
    stopAutoKnock(): AutoKnockStatus;
    getAutoKnockStatus(): AutoKnockStatus;
    getMeritStats(): MeritStats;
    getSutra(): SutraBook;
    getAllSutras(): SutraBook[];
    selectSutra(bookId: string): boolean;
    getCurrentSentence(): import("../types.js").SutraSentence;
}
//# sourceMappingURL=muyu-service.d.ts.map