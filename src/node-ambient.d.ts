// Minimal ambient declarations for Node built-ins when @types/node is not installed in offline environments.
declare module 'node:fs' {
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined
  export function readFileSync(path: string, encoding: BufferEncoding): string
  export function writeFileSync(path: string, data: string, options?: BufferEncoding | { encoding?: BufferEncoding; flag?: string }): void
  export function renameSync(oldPath: string, newPath: string): void
  export function unlinkSync(path: string): void
  export function statSync(path: string): { mtimeMs: number; size: number }
  const fs: {
    existsSync: typeof existsSync
    mkdirSync: typeof mkdirSync
    readFileSync: typeof readFileSync
    writeFileSync: typeof writeFileSync
    renameSync: typeof renameSync
    unlinkSync: typeof unlinkSync
    statSync: typeof statSync
  }
  export default fs
}

declare module 'node:path' {
  export function join(...paths: string[]): string
  export function resolve(...paths: string[]): string
  export function dirname(p: string): string
  export function relative(from: string, to: string): string
  const path: {
    join: typeof join
    resolve: typeof resolve
    dirname: typeof dirname
    relative: typeof relative
  }
  export default path
}

declare module 'node:os' {
  export function homedir(): string
  export function tmpdir(): string
  const os: {
    homedir: typeof homedir
    tmpdir: typeof tmpdir
  }
  export default os
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}

type BufferEncoding = 'utf-8' | 'utf8' | 'ascii' | 'base64'

declare var process: {
  env: Record<string, string | undefined>
  pid: number
  execPath: string
  cwd(): string
  kill(pid: number, signal?: number | string): boolean
}
