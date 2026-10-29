/**
 * Compact Token display used by both the Host tool output and the browser widget.
 * >= 1M is shown in M, otherwise >= 1k in k; small values stay exact.
 */
export function formatTokenCount(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return '0'
  const n = Math.round(num)
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m.toFixed(1)}M`.replace(/\.0M$/, 'M')
  }
  if (n >= 1_000) {
    const k = n / 1_000
    const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10
    if (rounded >= 1000) return '1M'
    return `${rounded}k`
  }
  return String(n)
}
