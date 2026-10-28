import type { SutraBook, SutraSentence } from '../types.js';
export declare class ChantService {
    private currentBook;
    private currentSentenceIndex;
    private completedCycles;
    constructor(initialBookId?: string);
    getBook(): SutraBook;
    getAllBooks(): SutraBook[];
    setBook(bookId: string): boolean;
    getCurrentSentence(): SutraSentence;
    advanceSentence(): {
        current: SutraSentence;
        next: SutraSentence;
        cycleCompleted: boolean;
        completedCycles: number;
    };
    reset(): void;
}
//# sourceMappingURL=chant-service.d.ts.map