/**
 * DSH Official Client Bundle entry
 * Complies with DSH lazy CJS model: window.__ModuleLoader__.load({ id, factory })
 */
export declare function getLocalDateKey(now?: Date): string;
export declare function getLocalDisplayDate(now?: Date): string;
export declare function computePendingAndKnocks(pendingTokens: number, deltaTokens: number, tokensPerMerit?: number, maxKnocks?: number): {
    knocks: number;
    nextPending: number;
};
export declare const name = "muyu-client";
export declare const inject: string[];
export declare function apply(ctx: any): void;
//# sourceMappingURL=bundle.d.ts.map