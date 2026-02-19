import { formatBytes } from './formatBytes'

export function formatBps(bps: number | null | undefined): string {
  if (bps == null) return '—'
  return formatBytes(bps) + '/s'
}
