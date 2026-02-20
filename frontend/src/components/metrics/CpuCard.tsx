import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { HalfGauge } from '@/components/charts/HalfGauge'
import { RollingLineChart } from '@/components/charts/RollingLineChart'
import { getThresholdColor, getThresholdHex } from '@/lib/thresholdColor'

export const CpuCard = memo(function CpuCard() {
  const cpu = useStore(
    (s) =>
      s.snapshot
        ? {
            pct:     Math.round(s.snapshot.cpu.total_percent),
            model:   s.snapshot.cpu.model_name,
            freq:    s.snapshot.cpu.freq_mhz,
            perCore: s.snapshot.cpu.per_core,
          }
        : null,
    shallow,
  )
  const cpuHistory = useStore((s) => s.cpuHistory, shallow)
  const { t } = useTranslation()

  const pct = cpu?.pct ?? 0

  const datasets = [
    { label: t('cpu.title'), color: '#4c9ef5', data: cpuHistory },
  ]

  return (
    <Card className="flex flex-col">
      <CardTitle>{t('cpu.title')}</CardTitle>

      <div className="relative h-20 flex items-end justify-center">
        <HalfGauge percent={pct} />
        <div className="absolute inset-0 flex items-center justify-center mt-5">
          <span className={`text-lg font-bold font-mono ${getThresholdColor(pct)}`}>
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
        <div className="flex gap-0.5 mt-2 flex-wrap">
          {cpu.perCore.map((corePct, i) => {
            const h     = Math.min(100, Math.round(corePct))
            const color = getThresholdHex(h)
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className="w-2 h-8 bg-border-base rounded-sm overflow-hidden flex flex-col justify-end">
                  <div
                    className="w-full rounded-sm transition-[height] duration-300"
                    style={{ height: `${h}%`, background: color }}
                  />
                </div>
                <span className="text-[8px] text-text-muted font-mono">C{i}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="h-24 mt-3">
        <RollingLineChart datasets={datasets} yFormat="percent" />
      </div>
    </Card>
  )
})
