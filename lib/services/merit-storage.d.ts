import type { MeritStats } from '../types.js';
export declare class MeritStorage {
    private storageFile;
    private dailyRecords;
    constructor(customPath?: string);
    get todayKey(): string;
    get todayMerit(): number;
    get totalMerit(): number;
    addMerit(amount?: number): {
        todayMerit: number;
        totalMerit: number;
    };
    getStats(): MeritStats;
    private load;
    private save;
}
//# sourceMappingURL=merit-storage.d.ts.map