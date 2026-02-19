export function formatBytes(b: number | null | undefined): string {
  if (b == null) return '—'
  if (b < 1024) return Math.round(b) + ' B'
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB'
  return (b / 1024 ** 3).toFixed(2) + ' GB'
}
