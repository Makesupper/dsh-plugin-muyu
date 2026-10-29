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
  provide(name: string, value: any): void
  effect(callback: () => void | (() => void)): () => void
  on(event: string, listener: (...args: any[]) => any): () => void
  inject(names: string[], callback: (ctx: Context) => void): () => void
  get(name: string, strict?: boolean): any
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
    readonly validate: (value: unknown) =>
      | { value: Output }
      | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }
  }
}

export interface Schema<T = any> extends StandardSchemaV1<T, T> {
  type?: string
  meta?: Record<string, any>
  default(val: T): Schema<T>
  description(desc: string): Schema<T>
  min(val: number): Schema<T>
  max(val: number): Schema<T>
  required(): Schema<T>
}

class SchemaNode<T = any> implements Schema<T> {
  public meta: Record<string, any> = {}

  constructor(public type: string, public options?: any) {}

  default(val: T): this {
    this.meta.default = val
    return this
  }

  description(desc: string): this {
    this.meta.description = desc
    return this
  }

  min(val: number): this {
    this.meta.min = val
    return this
  }

  max(val: number): this {
    this.meta.max = val
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
      validate: (value: unknown): { value: T } | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> } => {
        let result: any = value
        if (result === undefined || result === null) {
          if (this.meta.default !== undefined) {
            result = typeof this.meta.default === 'function' ? this.meta.default() : this.meta.default
          } else if (this.type === 'object' && this.options) {
            result = {}
          } else if (this.meta.required) {
            return { issues: [{ message: 'Value is required' }] }
          } else {
            return { value: result as T }
          }
        }

        if (this.type === 'string' && typeof result !== 'string') {
          return { issues: [{ message: `Expected string, got ${typeof result}` }] }
        }

        if (this.type === 'boolean' && typeof result !== 'boolean') {
          return { issues: [{ message: `Expected boolean, got ${typeof result}` }] }
        }

        if (this.type === 'number') {
          if (typeof result !== 'number' || !Number.isFinite(result)) {
            return { issues: [{ message: 'Expected a finite number' }] }
          }
          if (typeof this.meta.min === 'number' && result < this.meta.min) {
            result = this.meta.min
          }
          if (typeof this.meta.max === 'number' && result > this.meta.max) {
            result = this.meta.max
          }
        }

        if (this.type === 'union' && Array.isArray(this.options)) {
          const allowed = this.options.map((opt: any) =>
            opt && typeof opt === 'object' && 'options' in opt ? opt.options : opt
          )
          if (!allowed.includes(result)) {
            if (this.meta.default !== undefined) {
              result = this.meta.default
            } else {
              return { issues: [{ message: `Value must be one of: ${allowed.join(', ')}` }] }
            }
          }
        }

        if (this.type === 'object' && this.options && typeof result === 'object' && result !== null) {
          const resolved: Record<string, any> = { ...result }
          for (const [key, childSchema] of Object.entries(this.options)) {
            const childNode = childSchema as SchemaNode
            if (childNode && childNode['~standard']) {
              const validatedChild: { value: any } | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> } = childNode['~standard'].validate(resolved[key])
              if ('issues' in validatedChild) {
                return {
                  issues: validatedChild.issues.map((issue: { message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }) => ({
                    message: issue.message,
                    path: [key, ...(issue.path || [])]
                  }))
                }
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
  const<V>(val: V): Schema<V> {
    return new SchemaNode('const', val)
  },
  object(dict: Record<string, any>): Schema<any> {
    return new SchemaNode('object', dict)
  },
  union(values: any[]): Schema<any> {
    return new SchemaNode('union', values)
  }
}

export default Schema
