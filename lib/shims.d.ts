export interface Context {
    provide(name: string, value: any): void;
    effect(callback: () => void | (() => void)): () => void;
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
    default(val: any): Schema<T>;
    description(desc: string): Schema<T>;
    required(): Schema<T>;
}
export declare const Schema: {
    string(): Schema<string>;
    number(): Schema<number>;
    boolean(): Schema<boolean>;
    object(dict: Record<string, any>): Schema<any>;
    union(values: any[]): Schema<any>;
};
export default Schema;
//# sourceMappingURL=shims.d.ts.map