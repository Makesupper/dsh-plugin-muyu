/**
 * Compact Token display used by both the Host tool output and the browser widget.
 * >= 108M is shown as a "圆满" cycle, >= 1M in M, otherwise >= 1k in k.
 * Small values stay exact.
 */
const TOKENS_PER_COMPLETION = 108_000_000

export function formatTokenCount(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return '0'
  const n = Math.round(num)
  if (n >= TOKENS_PER_COMPLETION) {
    const cycles = n / TOKENS_PER_COMPLETION
    const text = cycles >= 10 ? cycles.toFixed(0) : cycles.toFixed(1)
    return `${text}圆满`.replace('.0圆满', '圆满')
  }
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m.toFixed(1)}M`.replace(/\.0M$/, 'M')
  }
  if (n >= 1_000) {
    const k = n / 1_000
    const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10
    if (rounded >= 1000) return `${(rounded / 1000).toFixed(1)}M`.replace(/\.0M$/, 'M')
    return `${rounded}k`
  }
  return String(n)
}

/** Unit-bearing token label; "圆满" already reads as a unit, so it gets no "Tokens" suffix. */
export function formatTokenLabel(value: unknown): string {
  const text = formatTokenCount(value)
  return text.endsWith('圆满') ? text : `${text} Tokens`
}

/** Merit counts use thousands separators, including negative deduction-mode values. */
export function formatMeritCount(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return Math.trunc(num).toLocaleString('en-US')
}
