import type { MuyuSoundType } from '../types.js';
export interface RuntimeState {
    bookId?: string;
    sentenceIndex?: number;
    soundType?: MuyuSoundType;
}
export declare function resolveRuntimeStateFile(storagePath?: string): string;
/**
 * Small last-write-wins companion file for the widget's current sutra position and sound.
 * It is intentionally separate from the merit ledger: merit is a shared, locked counter,
 * while the reading position is a per-user UI preference and can be overwritten safely.
 */
export declare class RuntimeStateStorage {
    private file;
    constructor(storagePath?: string);
    get path(): string;
    load(): RuntimeState;
    save(state: Required<RuntimeState>): void;
}
//# sourceMappingURL=state-storage.d.ts.map