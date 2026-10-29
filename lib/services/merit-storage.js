import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const MAX_RETAINED_DAYS = 3650;
const LOCK_STALE_MS = 15000;
const LOCK_TIMEOUT_MS = 3000;
const LOCK_RETRY_MS = 20;
function expandHome(filePath) {
    if (filePath === '~')
        return os.homedir();
    if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
}
export function resolveDefaultStorageFile(customPath) {
    if (customPath && customPath.trim().length > 0) {
        return path.resolve(expandHome(customPath.trim()));
    }
    const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim().length > 0
        ? path.resolve(expandHome(process.env.DSH_HOME.trim()))
        : path.join(os.homedir(), '.dsh');
    return path.join(dshHome, 'muyu-data', 'merit_history.json');
}
function toSafeNonNegInt(val) {
    const num = Number(val);
    if (!Number.isFinite(num) || num <= 0)
        return 0;
    return Math.floor(num);
}
/**
 * Single-host persistent ledger for daily merit, token consumption, and pending token remainder.
 *
 * Multi-process note: desktop and web hosts can both open this file. Every mutation takes an
 * exclusive lock file, re-reads the latest on-disk ledger, applies one delta, and atomically
 * renames the result back. This prevents the classic "last writer wins and loses the other
 * host's merit" failure while keeping the on-disk format unchanged.
 */
export class MeritStorage {
    storageFile;
    lockFile;
    days = {};
    _pendingTokens = 0;
    constructor(customPath) {
        this.storageFile = resolveDefaultStorageFile(customPath);
        this.lockFile = `${this.storageFile}.lock`;
        const dir = path.dirname(this.storageFile);
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            }
            catch (err) {
                console.warn('[dsh-plugin-muyu] Failed to create storage directory:', dir, err);
            }
        }
        this.load();
    }
    get todayKey() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    ensureBucket(days, key = this.todayKey) {
        if (!days[key]) {
            days[key] = { merit: 0, tokens: 0 };
        }
        return days[key];
    }
    get todayMerit() {
        return this.getStats().todayMerit;
    }
    get totalMerit() {
        return this.getStats().totalMerit;
    }
    get todayTokens() {
        return this.getStats().todayTokens;
    }
    get totalTokens() {
        return this.getStats().totalTokens;
    }
    get pendingTokens() {
        return this.getStats().pendingTokens;
    }
    setPendingTokens(pending) {
        this.withLock(ledger => {
            ledger.pendingTokens = toSafeNonNegInt(pending);
            return null;
        });
    }
    addMerit(amount = 1, tokens = 0, pendingTokens) {
        const safeMerit = toSafeNonNegInt(amount);
        const safeTokens = toSafeNonNegInt(tokens);
        return this.withLock(ledger => {
            const bucket = this.ensureBucket(ledger.days);
            bucket.merit += safeMerit;
            bucket.tokens += safeTokens;
            if (pendingTokens !== undefined) {
                ledger.pendingTokens = toSafeNonNegInt(pendingTokens);
            }
            this.prune(ledger.days);
            return this.buildStats(ledger.days, ledger.pendingTokens);
        });
    }
    addTokens(tokens, pendingTokens) {
        const safeTokens = toSafeNonNegInt(tokens);
        const stats = this.withLock(ledger => {
            const bucket = this.ensureBucket(ledger.days);
            bucket.tokens += safeTokens;
            if (pendingTokens !== undefined) {
                ledger.pendingTokens = toSafeNonNegInt(pendingTokens);
            }
            this.prune(ledger.days);
            return this.buildStats(ledger.days, ledger.pendingTokens);
        });
        return {
            todayTokens: stats.todayTokens,
            totalTokens: stats.totalTokens,
            pendingTokens: stats.pendingTokens
        };
    }
    /**
     * Atomically add tokens, consume whole steps from the pending pool, and add the resulting
     * merit knocks in the same locked write. A legacy backlog is truncated to below one step so
     * a single bogus feed can never leave a multi-billion pending queue behind.
     */
    consumeTokensAndKnock(tokens, step, maxKnocks) {
        return this.withLock(ledger => {
            const bucket = this.ensureBucket(ledger.days);
            const safeStep = Math.max(1, Math.floor(step));
            const safeMax = Math.max(1, Math.floor(maxKnocks));
            const safeTokens = Math.min(toSafeNonNegInt(tokens), safeMax * safeStep);
            const previousPending = toSafeNonNegInt(ledger.pendingTokens);
            const basePending = Math.min(previousPending, safeStep - 1);
            const totalPool = basePending + safeTokens;
            const knocks = Math.min(safeMax, Math.floor(totalPool / safeStep));
            const nextPending = totalPool - knocks * safeStep;
            bucket.merit += knocks;
            bucket.tokens += safeTokens;
            ledger.pendingTokens = nextPending;
            this.prune(ledger.days);
            return {
                knocks,
                pendingTokens: nextPending,
                trimmedPending: previousPending - basePending,
                stats: this.buildStats(ledger.days, nextPending)
            };
        });
    }
    getStats() {
        this.refresh();
        this.ensureBucket(this.days);
        return this.buildStats(this.days, this._pendingTokens);
    }
    buildStats(days, pendingTokens) {
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const records = Object.keys(days)
            .sort()
            .reverse()
            .map(key => {
            const [y, m, d] = key.split('-').map(Number);
            const date = new Date(y, (m || 1) - 1, d || 1);
            const weekday = weekdays[date.getDay()] || '';
            const bucket = days[key];
            return {
                dateKey: key,
                count: bucket.merit,
                displayDate: `${m}月${d}日 ${weekday}`.trim(),
                tokens: bucket.tokens
            };
        });
        let totalMerit = 0;
        let totalTokens = 0;
        for (const bucket of Object.values(days)) {
            totalMerit += bucket.merit;
            totalTokens += bucket.tokens;
        }
        return {
            todayMerit: days[this.todayKey]?.merit ?? 0,
            totalMerit,
            todayTokens: days[this.todayKey]?.tokens ?? 0,
            totalTokens,
            pendingTokens,
            todayKey: this.todayKey,
            records
        };
    }
    prune(days) {
        const keys = Object.keys(days).sort();
        if (keys.length <= MAX_RETAINED_DAYS)
            return;
        const toRemove = keys.slice(0, keys.length - MAX_RETAINED_DAYS);
        for (const k of toRemove) {
            delete days[k];
        }
    }
    quarantineCorruptFile(reason) {
        try {
            if (fs.existsSync(this.storageFile)) {
                const corruptPath = `${this.storageFile}.corrupt-${Date.now()}`;
                fs.renameSync(this.storageFile, corruptPath);
                console.warn(`[dsh-plugin-muyu] Corrupted merit ledger isolated to ${corruptPath}:`, reason);
            }
        }
        catch (err) {
            console.warn('[dsh-plugin-muyu] Failed to isolate corrupted merit file:', err);
        }
    }
    load() {
        const loaded = this.readLedger();
        this.days = loaded.days;
        this._pendingTokens = loaded.pendingTokens;
        if (loaded.migrated) {
            this.writeLedger(loaded);
        }
        this.ensureBucket(this.days);
    }
    refresh() {
        const loaded = this.readLedger();
        this.days = loaded.days;
        this._pendingTokens = loaded.pendingTokens;
        if (loaded.migrated) {
            this.writeLedger(loaded);
        }
        this.ensureBucket(this.days);
    }
    readLedger() {
        if (!fs.existsSync(this.storageFile)) {
            return { days: {}, pendingTokens: 0, migrated: false };
        }
        let content = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                content = fs.readFileSync(this.storageFile, 'utf-8');
                break;
            }
            catch (error) {
                if (error?.code === 'ENOENT') {
                    return { days: {}, pendingTokens: 0, migrated: false };
                }
                if (attempt === 2) {
                    // A transient sharing/permission error must not quarantine a valid ledger.
                    console.warn('[dsh-plugin-muyu] Failed to read merit ledger; keeping in-memory state:', error);
                    return { days: this.days, pendingTokens: this._pendingTokens, migrated: false };
                }
                this.sleep(10);
            }
        }
        if (content === null) {
            return { days: this.days, pendingTokens: this._pendingTokens, migrated: false };
        }
        try {
            const parsed = JSON.parse(content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Root JSON value must be a plain object');
            }
            if (parsed.version === 1 && parsed.days && typeof parsed.days === 'object' && !Array.isArray(parsed.days)) {
                const days = {};
                for (const [k, v] of Object.entries(parsed.days)) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object') {
                        days[k] = {
                            merit: toSafeNonNegInt(v.merit),
                            tokens: toSafeNonNegInt(v.tokens)
                        };
                    }
                }
                return {
                    days,
                    pendingTokens: toSafeNonNegInt(parsed.pendingTokens),
                    migrated: false
                };
            }
            if ((parsed.merit && typeof parsed.merit === 'object') ||
                (parsed.tokens && typeof parsed.tokens === 'object')) {
                // Intermediate dual-map format { merit: {}, tokens: {} }
                const meritMap = (parsed.merit && typeof parsed.merit === 'object') ? parsed.merit : {};
                const tokenMap = (parsed.tokens && typeof parsed.tokens === 'object') ? parsed.tokens : {};
                const allKeys = new Set([...Object.keys(meritMap), ...Object.keys(tokenMap)]);
                const days = {};
                for (const k of allKeys) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
                        days[k] = {
                            merit: toSafeNonNegInt(meritMap[k]),
                            tokens: toSafeNonNegInt(tokenMap[k])
                        };
                    }
                }
                return {
                    days,
                    pendingTokens: toSafeNonNegInt(parsed.pendingTokens),
                    migrated: true
                };
            }
            // Legacy flat format { "YYYY-MM-DD": number }
            const days = {};
            for (const [k, v] of Object.entries(parsed)) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) {
                    days[k] = {
                        merit: toSafeNonNegInt(v),
                        tokens: 0
                    };
                }
                else {
                    throw new Error('Unrecognized merit_history.json structure');
                }
            }
            return { days, pendingTokens: 0, migrated: true };
        }
        catch (e) {
            this.quarantineCorruptFile(e);
            return { days: {}, pendingTokens: 0, migrated: false };
        }
    }
    writeLedger(ledger) {
        try {
            const dir = path.dirname(this.storageFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const payload = {
                version: 1,
                days: ledger.days,
                pendingTokens: ledger.pendingTokens
            };
            const tmpFile = `${this.storageFile}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
            fs.renameSync(tmpFile, this.storageFile);
        }
        catch (e) {
            console.error('[dsh-plugin-muyu] Failed to save merit records:', e);
        }
    }
    acquireLock() {
        const startedAt = Date.now();
        while (true) {
            try {
                fs.writeFileSync(this.lockFile, `${process.pid} ${Date.now()}`, { flag: 'wx' });
                return true;
            }
            catch (error) {
                if (error?.code !== 'EEXIST') {
                    console.warn('[dsh-plugin-muyu] Failed to create merit lock; writing without lock:', error);
                    return false;
                }
                try {
                    const stat = fs.statSync(this.lockFile);
                    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
                        try {
                            fs.unlinkSync(this.lockFile);
                        }
                        catch { }
                        continue;
                    }
                }
                catch (statError) {
                    if (statError?.code === 'ENOENT')
                        continue;
                }
                if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
                    console.warn('[dsh-plugin-muyu] Merit lock timeout; writing without lock:', this.lockFile);
                    return false;
                }
                this.sleep(LOCK_RETRY_MS);
            }
        }
    }
    sleep(ms) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    }
    withLock(fn) {
        const locked = this.acquireLock();
        try {
            const ledger = this.readLedger();
            const result = fn(ledger);
            this.writeLedger(ledger);
            this.days = ledger.days;
            this._pendingTokens = ledger.pendingTokens;
            return result;
        }
        finally {
            if (locked) {
                try {
                    fs.unlinkSync(this.lockFile);
                }
                catch { }
            }
        }
    }
}
//# sourceMappingURL=merit-storage.js.map