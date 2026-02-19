import { useCallback } from 'react'
import { formatBytes } from '@/lib/formatBytes'
import { formatBps } from '@/lib/formatBps'

export function useFormatBytes() {
  const fmt    = useCallback((b: number | null | undefined) => formatBytes(b), [])
  const fmtBps = useCallback((b: number | null | undefined) => formatBps(b), [])
  return { formatBytes: fmt, formatBps: fmtBps }
}
