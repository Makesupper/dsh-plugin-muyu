import type { MeritStats } from '../types.js';
export declare function resolveDefaultStorageFile(customPath?: string): string;
/**
 * Single-host persistent ledger for daily merit, token consumption, and pending token remainder.
 *
 * Multi-process note: desktop and web hosts can both open this file. Every mutation takes an
 * exclusive lock file, re-reads the latest on-disk ledger, applies one delta, and atomically
 * renames the result back. This prevents the classic "last writer wins and loses the other
 * host's merit" failure while keeping the on-disk format unchanged.
 */
export declare class MeritStorage {
    private storageFile;
    private lockFile;
    private days;
    private _pendingTokens;
    constructor(customPath?: string);
    get todayKey(): string;
    private ensureBucket;
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
    /**
     * Atomically add tokens, consume whole steps from the pending pool, and add the resulting
     * merit knocks in the same locked write. A legacy backlog is truncated to below one step so
     * a single bogus feed can never leave a multi-billion pending queue behind.
     */
    consumeTokensAndKnock(tokens: number, step: number, maxKnocks: number): {
        knocks: number;
        pendingTokens: number;
        trimmedPending: number;
        stats: MeritStats;
    };
    getStats(): MeritStats;
    private buildStats;
    private prune;
    private quarantineCorruptFile;
    private load;
    private refresh;
    private readLedger;
    private writeLedger;
    private acquireLock;
    private sleep;
    private withLock;
}
//# sourceMappingURL=merit-storage.d.ts.map