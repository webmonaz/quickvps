import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { HalfGauge } from '@/components/charts/HalfGauge'
import { RollingLineChart } from '@/components/charts/RollingLineChart'
import { MemoryBreakdownBar } from './MemoryBreakdownBar'
import { getThresholdColor } from '@/lib/thresholdColor'
import { formatBytes } from '@/lib/formatBytes'

export const MemorySwapCard = memo(function MemorySwapCard() {
  const data = useStore(
    (s) =>
      s.snapshot
        ? {
            mem: {
              pct:     Math.round(s.snapshot.memory.percent),
              used:    s.snapshot.memory.used_bytes,
              total:   s.snapshot.memory.total_bytes,
              cached:  s.snapshot.memory.cached,
              buffers: s.snapshot.memory.buffers,
            },
            swap: {
              pct:   Math.round(s.snapshot.swap.percent),
              used:  s.snapshot.swap.used_bytes,
              total: s.snapshot.swap.total_bytes,
            },
          }
        : null,
    shallow,
  )
  const memHistory  = useStore((s) => s.memHistory,  shallow)
  const swapHistory = useStore((s) => s.swapHistory, shallow)
  const { t } = useTranslation()

  const memPct  = data?.mem.pct  ?? 0
  const swapPct = data?.swap.pct ?? 0

  const datasets = [
    { label: t('memory.title'), color: '#4c9ef5', data: memHistory  },
    { label: t('swap.title'),   color: '#a78bfa', data: swapHistory },
  ]

  return (
    <Card className="flex flex-col">
      <CardTitle>{t('memory.title')} &amp; {t('swap.title')}</CardTitle>

      <div className="grid grid-cols-2 gap-3 divide-x divide-border-base">

        {/* Memory column */}
        <div className="flex flex-col">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
            {t('memory.title')}
          </div>
          <div className="relative h-20 flex items-end justify-center">
            <HalfGauge percent={memPct} />
            <div className="absolute inset-0 flex items-center justify-center mt-5">
              <span className={`text-lg font-bold font-mono ${getThresholdColor(memPct)}`}>
                {memPct}%
              </span>
            </div>
          </div>
          <div className="text-xs text-text-secondary font-mono mt-1">
            {data
              ? `${formatBytes(data.mem.used)} / ${formatBytes(data.mem.total)}`
              : '—'}
          </div>
          {data && (
            <MemoryBreakdownBar
              total={data.mem.total}
              used={data.mem.used}
              cached={data.mem.cached}
              buffers={data.mem.buffers}
            />
          )}
        </div>

        {/* Swap column */}
        <div className="flex flex-col pl-3">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
            {t('swap.title')}
          </div>
          <div className="relative h-20 flex items-end justify-center">
            <HalfGauge percent={swapPct} />
            <div className="absolute inset-0 flex items-center justify-center mt-5">
              <span className={`text-lg font-bold font-mono ${getThresholdColor(swapPct)}`}>
                {swapPct}%
              </span>
            </div>
          </div>
          <div className="text-xs text-text-secondary font-mono mt-1">
            {data
              ? data.swap.total > 0
                ? `${formatBytes(data.swap.used)} / ${formatBytes(data.swap.total)}`
                : t('swap.noSwap')
              : '—'}
          </div>
        </div>

      </div>

      {/* Combined history chart */}
      <div className="flex items-center gap-3 mt-3 mb-1 text-[10px] font-mono text-text-secondary">
        <span><span className="text-accent-blue">—</span> {t('memory.title')}</span>
        <span><span className="text-accent-purple">—</span> {t('swap.title')}</span>
      </div>
      <div className="h-24">
        <RollingLineChart datasets={datasets} yFormat="percent" />
      </div>
    </Card>
  )
})
