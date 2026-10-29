import type { MuyuService } from './muyu-service.js';
import type { AutoKnockStatus, DailyMeritRecord, SutraSentence } from '../types.js';
/**
 * Browser-facing JSON API for the floating widget.
 *
 * The host ledger is the single source of truth: the widget reads this state
 * and posts knocks/auto/sutra changes back here. There is deliberately no
 * second (localStorage) merit ledger on the client.
 */
export declare const MUYU_API_PREFIX = "/dsh-muyu";
export interface MuyuClientState {
    todayMerit: number;
    totalMerit: number;
    todayTokens: number;
    totalTokens: number;
    pendingTokens: number;
    tokensPerMerit: number;
    todayKey: string;
    bookId: string;
    bookTitle: string;
    currentSentence: SutraSentence;
    lastSentence: SutraSentence | null;
    chantSeq: number;
    auto: AutoKnockStatus;
    records?: DailyMeritRecord[];
}
type JsonRequest = {
    method?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
    on(event: string, listener: (...args: any[]) => void): unknown;
};
type JsonResponse = {
    statusCode?: number;
    headersSent?: boolean;
    writeHead(status: number, headers: Record<string, string>): unknown;
    end(body?: string): unknown;
};
export declare function buildMuyuState(muyu: MuyuService, includeHistory?: boolean): MuyuClientState;
export declare function createMuyuRouteHandlers(muyu: MuyuService, webServer?: any): {
    state: (req: JsonRequest, res: JsonResponse) => void;
    knock: (req: JsonRequest, res: JsonResponse) => void;
    auto: (req: JsonRequest, res: JsonResponse) => void;
    sutra: (req: JsonRequest, res: JsonResponse) => void;
};
/**
 * Register the widget API on the host web server. Returns a disposer that
 * removes every route (used by the plugin's Cordis effect).
 */
export declare function registerMuyuClientApi(webServer: any, muyu: MuyuService): () => void;
export {};
//# sourceMappingURL=client-api.d.ts.map