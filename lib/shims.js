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
class SchemaNode {
    type;
    options;
    meta = {};
    constructor(type, options) {
        this.type = type;
        this.options = options;
    }
    default(val) {
        this.meta.default = val;
        return this;
    }
    description(desc) {
        this.meta.description = desc;
        return this;
    }
    min(val) {
        this.meta.min = val;
        return this;
    }
    max(val) {
        this.meta.max = val;
        return this;
    }
    required() {
        this.meta.required = true;
        return this;
    }
    get '~standard'() {
        return {
            version: 1,
            vendor: 'schemastery',
            validate: (value) => {
                let result = value;
                if (result === undefined || result === null) {
                    if (this.meta.default !== undefined) {
                        result = typeof this.meta.default === 'function' ? this.meta.default() : this.meta.default;
                    }
                    else if (this.type === 'object' && this.options) {
                        result = {};
                    }
                    else if (this.meta.required) {
                        return { issues: [{ message: 'Value is required' }] };
                    }
                    else {
                        return { value: result };
                    }
                }
                if (this.type === 'string' && typeof result !== 'string') {
                    return { issues: [{ message: `Expected string, got ${typeof result}` }] };
                }
                if (this.type === 'boolean' && typeof result !== 'boolean') {
                    return { issues: [{ message: `Expected boolean, got ${typeof result}` }] };
                }
                if (this.type === 'number') {
                    if (typeof result !== 'number' || !Number.isFinite(result)) {
                        return { issues: [{ message: 'Expected a finite number' }] };
                    }
                    if (typeof this.meta.min === 'number' && result < this.meta.min) {
                        result = this.meta.min;
                    }
                    if (typeof this.meta.max === 'number' && result > this.meta.max) {
                        result = this.meta.max;
                    }
                }
                if (this.type === 'union' && Array.isArray(this.options)) {
                    const allowed = this.options.map((opt) => opt && typeof opt === 'object' && 'options' in opt ? opt.options : opt);
                    if (!allowed.includes(result)) {
                        if (this.meta.default !== undefined) {
                            result = this.meta.default;
                        }
                        else {
                            return { issues: [{ message: `Value must be one of: ${allowed.join(', ')}` }] };
                        }
                    }
                }
                if (this.type === 'object' && this.options && typeof result === 'object' && result !== null) {
                    const resolved = { ...result };
                    for (const [key, childSchema] of Object.entries(this.options)) {
                        const childNode = childSchema;
                        if (childNode && childNode['~standard']) {
                            const validatedChild = childNode['~standard'].validate(resolved[key]);
                            if ('issues' in validatedChild) {
                                return {
                                    issues: validatedChild.issues.map((issue) => ({
                                        message: issue.message,
                                        path: [key, ...(issue.path || [])]
                                    }))
                                };
                            }
                            resolved[key] = validatedChild.value;
                        }
                    }
                    return { value: resolved };
                }
                return { value: result };
            }
        };
    }
}
export const Schema = {
    string() {
        return new SchemaNode('string');
    },
    number() {
        return new SchemaNode('number');
    },
    boolean() {
        return new SchemaNode('boolean');
    },
    const(val) {
        return new SchemaNode('const', val);
    },
    object(dict) {
        return new SchemaNode('object', dict);
    },
    union(values) {
        return new SchemaNode('union', values);
    }
};
export default Schema;
//# sourceMappingURL=shims.js.map