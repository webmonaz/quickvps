import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { HalfGauge } from '@/components/charts/HalfGauge'
import { getThresholdColor } from '@/lib/thresholdColor'
import { formatBytes } from '@/lib/formatBytes'

export const SwapSection = memo(function SwapSection() {
  const swap = useStore(
    (s) => s.snapshot
      ? {
          pct:   Math.round(s.snapshot.swap.percent),
          used:  s.snapshot.swap.used_bytes,
          total: s.snapshot.swap.total_bytes,
        }
      : null,
    shallow,
  )

  const pct = swap?.pct ?? 0

  return (
    <Card className="flex flex-col">
      <CardTitle>Swap</CardTitle>
      <div className="relative h-28 flex items-end justify-center">
        <HalfGauge percent={pct} />
        <div className="absolute inset-0 flex items-center justify-center mt-8">
          <span className={`text-2xl font-bold font-mono ${getThresholdColor(pct)}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="text-xs text-text-secondary font-mono mt-2">
        {swap
          ? swap.total > 0
            ? `${formatBytes(swap.used)} / ${formatBytes(swap.total)}`
            : 'No swap'
          : '—'}
      </div>
    </Card>
  )
})
