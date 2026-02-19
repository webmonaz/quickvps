import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { HalfGauge } from '@/components/charts/HalfGauge'
import { MemoryBreakdownBar } from './MemoryBreakdownBar'
import { getThresholdColor } from '@/lib/thresholdColor'
import { formatBytes } from '@/lib/formatBytes'

export const MemorySection = memo(function MemorySection() {
  const mem = useStore(
    (s) => s.snapshot
      ? {
          pct:     Math.round(s.snapshot.memory.percent),
          used:    s.snapshot.memory.used_bytes,
          total:   s.snapshot.memory.total_bytes,
          cached:  s.snapshot.memory.cached,
          buffers: s.snapshot.memory.buffers,
        }
      : null,
    shallow,
  )

  const pct = mem?.pct ?? 0

  return (
    <Card className="flex flex-col">
      <CardTitle>Memory</CardTitle>
      <div className="relative h-28 flex items-end justify-center">
        <HalfGauge percent={pct} />
        <div className="absolute inset-0 flex items-center justify-center mt-8">
          <span className={`text-2xl font-bold font-mono ${getThresholdColor(pct)}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="text-xs text-text-secondary font-mono mt-2">
        {mem ? `${formatBytes(mem.used)} / ${formatBytes(mem.total)}` : '—'}
      </div>
      {mem && (
        <MemoryBreakdownBar
          total={mem.total}
          used={mem.used}
          cached={mem.cached}
          buffers={mem.buffers}
        />
      )}
    </Card>
  )
})
