// Portable ambient types for @deepseek-ai/cordis
export interface Context {
  provide(name: string, value: any): void
  effect(callback: () => void | (() => void)): () => void
  set(key: string, value: any): void
  tools: {
    register(tool: any): () => void
  }
  [key: string]: any
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => { value: Output } | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }
  }
}

export interface Schema<T = any> extends StandardSchemaV1<T, T> {
  type?: string
  meta?: Record<string, any>
  default(val: any): Schema<T>
  description(desc: string): Schema<T>
  required(): Schema<T>
}

class SchemaNode<T = any> implements Schema<T> {
  public meta: Record<string, any> = {}

  constructor(public type: string, public options?: any) {}

  default(val: any): this {
    this.meta.default = val
    return this
  }

  description(desc: string): this {
    this.meta.description = desc
    return this
  }

  required(): this {
    this.meta.required = true
    return this
  }

  get '~standard'() {
    return {
      version: 1 as const,
      vendor: 'schemastery',
      validate: (value: unknown) => {
        let result: any = value
        if (result === undefined || result === null) {
          if (this.meta.default !== undefined) {
            result = typeof this.meta.default === 'function' ? this.meta.default() : this.meta.default
          } else if (this.type === 'object' && this.options) {
            result = {}
          }
        }

        if (this.type === 'object' && this.options && typeof result === 'object' && result !== null) {
          const resolved: Record<string, any> = { ...result }
          for (const [key, childSchema] of Object.entries(this.options)) {
            const childNode = childSchema as SchemaNode
            if (childNode && childNode['~standard']) {
              const validatedChild = childNode['~standard'].validate(resolved[key])
              if ('issues' in validatedChild) {
                return validatedChild
              }
              resolved[key] = validatedChild.value
            }
          }
          return { value: resolved as T }
        }

        return { value: result as T }
      }
    }
  }
}

export const Schema = {
  string(): Schema<string> {
    return new SchemaNode('string')
  },
  number(): Schema<number> {
    return new SchemaNode('number')
  },
  boolean(): Schema<boolean> {
    return new SchemaNode('boolean')
  },
  object(dict: Record<string, any>): Schema<any> {
    return new SchemaNode('object', dict)
  },
  union(values: any[]): Schema<any> {
    return new SchemaNode('union', values)
  }
}

export default Schema
