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
                }
                if (this.type === 'object' && this.options && typeof result === 'object' && result !== null) {
                    const resolved = { ...result };
                    for (const [key, childSchema] of Object.entries(this.options)) {
                        const childNode = childSchema;
                        if (childNode && childNode['~standard']) {
                            const validatedChild = childNode['~standard'].validate(resolved[key]);
                            if ('issues' in validatedChild) {
                                return validatedChild;
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
    object(dict) {
        return new SchemaNode('object', dict);
    },
    union(values) {
        return new SchemaNode('union', values);
    }
};
export default Schema;
//# sourceMappingURL=shims.js.map