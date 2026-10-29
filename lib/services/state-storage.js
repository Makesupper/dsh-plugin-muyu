import fs from 'node:fs';
import path from 'node:path';
import { resolveDefaultStorageFile } from './merit-storage.js';
export function resolveRuntimeStateFile(storagePath) {
    return `${resolveDefaultStorageFile(storagePath)}.state.json`;
}
/**
 * Small last-write-wins companion file for the widget's current sutra position and sound.
 * It is intentionally separate from the merit ledger: merit is a shared, locked counter,
 * while the reading position is a per-user UI preference and can be overwritten safely.
 */
export class RuntimeStateStorage {
    file;
    constructor(storagePath) {
        this.file = resolveRuntimeStateFile(storagePath);
    }
    get path() {
        return this.file;
    }
    clear() {
        try {
            if (fs.existsSync(this.file)) {
                fs.unlinkSync(this.file);
            }
        }
        catch (error) {
            console.warn('[dsh-plugin-muyu] Failed to clear runtime state:', error);
        }
    }
    load() {
        try {
            if (!fs.existsSync(this.file))
                return {};
            const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                return {};
            const soundType = parsed.soundType;
            return {
                bookId: typeof parsed.bookId === 'string' ? parsed.bookId : undefined,
                sentenceIndex: typeof parsed.sentenceIndex === 'number' && Number.isFinite(parsed.sentenceIndex)
                    ? Math.max(0, Math.floor(parsed.sentenceIndex))
                    : undefined,
                soundType: soundType === 'sandalwood' || soundType === 'whitewood' || soundType === 'bell'
                    ? soundType
                    : undefined,
                tokensPerMerit: typeof parsed.tokensPerMerit === 'number' &&
                    Number.isFinite(parsed.tokensPerMerit) &&
                    parsed.tokensPerMerit !== 0 &&
                    Math.abs(parsed.tokensPerMerit) <= 10000000
                    ? Math.trunc(parsed.tokensPerMerit)
                    : undefined
            };
        }
        catch (error) {
            console.warn('[dsh-plugin-muyu] Failed to read runtime state:', error);
            return {};
        }
    }
    save(state) {
        try {
            const dir = path.dirname(this.file);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const payload = {
                version: 1,
                bookId: state.bookId,
                sentenceIndex: Math.max(0, Math.floor(state.sentenceIndex ?? 0)),
                soundType: state.soundType,
                tokensPerMerit: typeof state.tokensPerMerit === 'number' && Number.isFinite(state.tokensPerMerit) && state.tokensPerMerit !== 0
                    ? Math.trunc(state.tokensPerMerit)
                    : undefined,
                updatedAt: Date.now()
            };
            const tmpFile = `${this.file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
            fs.renameSync(tmpFile, this.file);
        }
        catch (error) {
            console.warn('[dsh-plugin-muyu] Failed to save runtime state:', error);
        }
    }
}
//# sourceMappingURL=state-storage.js.map