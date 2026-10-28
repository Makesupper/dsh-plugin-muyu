import { heartSutra, sutraBookMap, allBooks } from '../data/sutras.js';
export class ChantService {
    currentBook = heartSutra;
    currentSentenceIndex = 0;
    completedCycles = 0;
    constructor(initialBookId) {
        if (initialBookId && sutraBookMap.has(initialBookId)) {
            this.currentBook = sutraBookMap.get(initialBookId);
        }
    }
    getBook() {
        return this.currentBook;
    }
    getAllBooks() {
        return allBooks;
    }
    setBook(bookId) {
        const book = sutraBookMap.get(bookId);
        if (!book)
            return false;
        this.currentBook = book;
        this.currentSentenceIndex = 0;
        this.completedCycles = 0;
        return true;
    }
    getCurrentSentence() {
        const sentences = this.currentBook.sentences;
        const text = sentences[this.currentSentenceIndex] || sentences[0];
        return {
            id: this.currentSentenceIndex,
            text,
            bookId: this.currentBook.id,
            bookTitle: this.currentBook.title
        };
    }
    advanceSentence() {
        const current = this.getCurrentSentence();
        const totalSentences = this.currentBook.sentences.length;
        let cycleCompleted = false;
        this.currentSentenceIndex += 1;
        if (this.currentSentenceIndex >= totalSentences) {
            this.currentSentenceIndex = 0;
            this.completedCycles += 1;
            cycleCompleted = true;
        }
        const next = this.getCurrentSentence();
        return {
            current,
            next,
            cycleCompleted,
            completedCycles: this.completedCycles
        };
    }
    reset() {
        this.currentSentenceIndex = 0;
        this.completedCycles = 0;
    }
}
//# sourceMappingURL=chant-service.js.map