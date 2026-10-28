export interface SutraSentence {
    id: number;
    text: string;
    bookId: string;
    bookTitle: string;
}
export interface SutraBook {
    id: string;
    title: string;
    summary: string;
    sentences: string[];
}
export type MuyuSoundType = 'sandalwood' | 'whitewood' | 'bell';
export interface SoundDefinition {
    id: MuyuSoundType;
    displayName: string;
    description: string;
    fileName: string;
}
export interface DailyMeritRecord {
    dateKey: string;
    count: number;
    displayDate: string;
}
export interface MeritStats {
    todayMerit: number;
    totalMerit: number;
    todayKey: string;
    records: DailyMeritRecord[];
}
export interface KnockResult {
    amount: number;
    todayMerit: number;
    totalMerit: number;
    currentSentence: SutraSentence;
    nextSentence: SutraSentence;
    cycleCompleted: boolean;
    completedCycles: number;
    soundType: MuyuSoundType;
    soundFile: string;
    voicePrompt: {
        text: string;
        lang: string;
        rate: number;
        pitch: number;
    };
}
export interface AutoKnockStatus {
    running: boolean;
    targetCount: number;
    currentCount: number;
    intervalMs: number;
    cycleTitle: string;
    startTime?: number;
}
//# sourceMappingURL=types.d.ts.map