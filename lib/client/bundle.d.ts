/**
 * DSH Official Client Bundle entry
 * Complies with DSH lazy CJS model: window.__ModuleLoader__.load({ id, factory })
 *
 * Single-ledger design: the Host's merit_history.json is the only ledger.
 * This bundle never computes tokens or merit locally; it reads /dsh-muyu/state
 * and posts knocks/auto/sutra changes back to the Host. Token consumption on
 * the Host therefore drives the widget animation through the polled state diff.
 */
export declare const name = "muyu-client";
export declare const inject: string[];
export declare function apply(ctx: any): void;
//# sourceMappingURL=bundle.d.ts.map