import type { MeritStats } from '../types.js';
export declare function resolveDefaultStorageFile(customPath?: string): string;
/**
 * Single-host persistent ledger for daily merit, token consumption, and pending token remainder.
 * Multi-process note: assumes a single active DSH host; concurrent writers use last-write-wins via atomic rename.
 */
export declare class MeritStorage {
    private storageFile;
    private days;
    private _pendingTokens;
    constructor(customPath?: string);
    get todayKey(): string;
    private ensureTodayBucket;
    get todayMerit(): number;
    get totalMerit(): number;
    get todayTokens(): number;
    get totalTokens(): number;
    get pendingTokens(): number;
    setPendingTokens(pending: number): void;
    addMerit(amount?: number, tokens?: number, pendingTokens?: number): {
        todayMerit: number;
        totalMerit: number;
        todayTokens: number;
        totalTokens: number;
        pendingTokens: number;
    };
    addTokens(tokens: number, pendingTokens?: number): {
        todayTokens: number;
        totalTokens: number;
        pendingTokens: number;
    };
    getStats(): MeritStats;
    private pruneOldDays;
    private quarantineCorruptFile;
    private load;
    private save;
}
//# sourceMappingURL=merit-storage.d.ts.map