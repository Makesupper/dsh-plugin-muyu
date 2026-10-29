import type { SutraBook, SutraSentence } from '../types.js'
import { heartSutra, sutraBookMap, allBooks } from '../data/sutras.js'

export class ChantService {
  private currentBook: SutraBook = heartSutra
  private currentSentenceIndex: number = 0
  private completedCycles: number = 0

  constructor(initialBookId?: string) {
    if (initialBookId && sutraBookMap.has(initialBookId)) {
      this.currentBook = sutraBookMap.get(initialBookId)!
    }
  }

  public getBook(): SutraBook {
    return this.currentBook
  }

  public getAllBooks(): SutraBook[] {
    return allBooks
  }

  public setBook(bookId: string): boolean {
    const book = sutraBookMap.get(bookId)
    if (!book) return false
    this.currentBook = book
    this.currentSentenceIndex = 0
    this.completedCycles = 0
    return true
  }

  public getSentenceIndex(): number {
    return this.currentSentenceIndex
  }

  public restore(bookId: string, sentenceIndex: number): boolean {
    const book = sutraBookMap.get(bookId)
    if (!book) return false
    this.currentBook = book
    const last = Math.max(0, book.sentences.length - 1)
    const index = Number.isFinite(sentenceIndex) ? Math.floor(sentenceIndex) : 0
    this.currentSentenceIndex = Math.min(last, Math.max(0, index))
    this.completedCycles = 0
    return true
  }

  public getCurrentSentence(): SutraSentence {
    const sentences = this.currentBook.sentences
    const text = sentences[this.currentSentenceIndex] || sentences[0]
    return {
      id: this.currentSentenceIndex,
      text,
      bookId: this.currentBook.id,
      bookTitle: this.currentBook.title
    }
  }

  public advanceSentence(): {
    current: SutraSentence
    next: SutraSentence
    cycleCompleted: boolean
    completedCycles: number
  } {
    const current = this.getCurrentSentence()
    const totalSentences = this.currentBook.sentences.length

    let cycleCompleted = false
    this.currentSentenceIndex += 1
    if (this.currentSentenceIndex >= totalSentences) {
      this.currentSentenceIndex = 0
      this.completedCycles += 1
      cycleCompleted = true
    }

    const next = this.getCurrentSentence()
    return {
      current,
      next,
      cycleCompleted,
      completedCycles: this.completedCycles
    }
  }

  public reset() {
    this.currentSentenceIndex = 0
    this.completedCycles = 0
  }
}
