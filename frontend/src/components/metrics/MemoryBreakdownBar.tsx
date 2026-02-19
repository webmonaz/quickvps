import { memo } from 'react'
import { formatBytes } from '@/lib/formatBytes'

interface MemoryBreakdownBarProps {
  total:   number
  used:    number
  cached:  number
  buffers: number
}

export const MemoryBreakdownBar = memo(function MemoryBreakdownBar({
  total, used, cached, buffers,
}: MemoryBreakdownBarProps) {
  if (total === 0) return null
  const usedW    = (used    / total * 100).toFixed(1)
  const cachedW  = (cached  / total * 100).toFixed(1)
  const buffersW = (buffers / total * 100).toFixed(1)

  return (
    <div className="mt-3">
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-border-base">
        <div className="h-full bg-accent-blue"   style={{ width: usedW    + '%' }} />
        <div className="h-full bg-accent-purple" style={{ width: cachedW  + '%' }} />
        <div className="h-full bg-accent-cyan"   style={{ width: buffersW + '%' }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] font-mono text-text-secondary">
        <span><span className="text-accent-blue">■</span> Used: {formatBytes(used)}</span>
        <span><span className="text-accent-purple">■</span> Cache: {formatBytes(cached)}</span>
        <span><span className="text-accent-cyan">■</span> Buf: {formatBytes(buffers)}</span>
      </div>
    </div>
  )
})
