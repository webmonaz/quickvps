import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { HalfGauge } from '@/components/charts/HalfGauge'
import { CpuCoreGrid } from './CpuCoreGrid'
import { getThresholdColor } from '@/lib/thresholdColor'

export const CpuSection = memo(function CpuSection() {
  const cpu = useStore(
    (s) => s.snapshot
      ? {
          pct:       Math.round(s.snapshot.cpu.total_percent),
          model:     s.snapshot.cpu.model_name,
          freq:      s.snapshot.cpu.freq_mhz,
          perCore:   s.snapshot.cpu.per_core,
        }
      : null,
    shallow,
  )

  const pct = cpu?.pct ?? 0

  return (
    <Card className="flex flex-col">
      <CardTitle>CPU</CardTitle>
      <div className="relative h-28 flex items-end justify-center">
        <HalfGauge percent={pct} />
        <div className="absolute inset-0 flex items-center justify-center mt-8">
          <span className={`text-2xl font-bold font-mono ${getThresholdColor(pct)}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="text-xs text-text-secondary font-mono mt-2 truncate" title={cpu?.model}>
        {cpu?.model || '—'}
      </div>
      <div className="text-xs text-text-muted font-mono">
        {cpu?.freq ? cpu.freq.toFixed(0) + ' MHz' : '—'}
      </div>
      {cpu?.perCore && cpu.perCore.length > 0 && (
        <CpuCoreGrid perCore={cpu.perCore} />
      )}
    </Card>
  )
})
