import { memo } from 'react'
import type { DiskMetrics, DiskIOMetrics } from '@/types/metrics'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { getThresholdColor } from '@/lib/thresholdColor'
import { formatBytes } from '@/lib/formatBytes'
import { formatBps } from '@/lib/formatBps'

interface DiskCardProps {
  disk: DiskMetrics
  io:   DiskIOMetrics | undefined
}

function areEqual(prev: DiskCardProps, next: DiskCardProps): boolean {
  return (
    prev.disk.percent    === next.disk.percent    &&
    prev.disk.used_bytes === next.disk.used_bytes &&
    prev.io?.read_bps    === next.io?.read_bps    &&
    prev.io?.write_bps   === next.io?.write_bps
  )
}

export const DiskCard = memo(function DiskCard({ disk, io }: DiskCardProps) {
  const pct = Math.round(disk.percent)

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{disk.mountpoint}</div>
          <div className="text-[10px] text-text-muted font-mono mt-0.5">{disk.device} · {disk.fstype}</div>
        </div>
        <span className={`text-sm font-bold font-mono ml-2 shrink-0 ${getThresholdColor(pct)}`}>
          {pct}%
        </span>
      </div>
      <ProgressBar percent={pct} className="my-2" />
      <div className="flex justify-between text-[10px] font-mono text-text-secondary mt-1">
        <span>Used: {formatBytes(disk.used_bytes)}</span>
        <span>Free: {formatBytes(disk.free_bytes)}</span>
        <span>Total: {formatBytes(disk.total_bytes)}</span>
      </div>
      {io && (
        <div className="flex justify-between text-[10px] font-mono mt-1.5">
          <span>R: <span className="text-accent-blue">{formatBps(io.read_bps)}</span></span>
          <span>W: <span className="text-accent-purple">{formatBps(io.write_bps)}</span></span>
        </div>
      )}
    </Card>
  )
}, areEqual)
