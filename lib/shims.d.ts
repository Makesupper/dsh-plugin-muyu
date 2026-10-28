/**
 * Portable ambient types and lightweight Schema validation for @deepseek-ai/cordis.
 *
 * Design rationale:
 * When installed as a linked local plugin (e.g. `link:` in ~/.dsh/profiles/desktop),
 * Node module resolution from the plugin directory does not traverse into the host's
 * bundled @deepseek-ai/cordis or @deepseek-ai/schemastery packages. Providing a
 * self-contained StandardSchemaV1-compatible validator keeps the plugin zero-dependency
 * and portable across both linked dev checkouts and packaged releases.
 */
export interface Context {
    provide(name: string, value: any): void;
    effect(callback: () => void | (() => void)): () => void;
    on(event: string, listener: (...args: any[]) => any): () => void;
    set(key: string, value: any): void;
    tools: {
        register(tool: any): () => void;
    };
    [key: string]: any;
}
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => {
            value: Output;
        } | {
            issues: ReadonlyArray<{
                message: string;
                path?: ReadonlyArray<PropertyKey | {
                    key: PropertyKey;
                }>;
            }>;
        };
    };
}
export interface Schema<T = any> extends StandardSchemaV1<T, T> {
    type?: string;
    meta?: Record<string, any>;
    default(val: T): Schema<T>;
    description(desc: string): Schema<T>;
    min(val: number): Schema<T>;
    max(val: number): Schema<T>;
    required(): Schema<T>;
}
export declare const Schema: {
    string(): Schema<string>;
    number(): Schema<number>;
    boolean(): Schema<boolean>;
    const<V>(val: V): Schema<V>;
    object(dict: Record<string, any>): Schema<any>;
    union(values: any[]): Schema<any>;
};
export default Schema;
//# sourceMappingURL=shims.d.ts.map