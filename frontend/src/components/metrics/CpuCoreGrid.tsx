import { memo } from 'react'
import { getThresholdHex } from '@/lib/thresholdColor'

interface CpuCoreGridProps {
  perCore: number[]
}

export const CpuCoreGrid = memo(function CpuCoreGrid({ perCore }: CpuCoreGridProps) {
  return (
    <div className="flex gap-1 mt-3 flex-wrap">
      {perCore.map((pct, i) => {
        const h     = Math.min(100, Math.round(pct))
        const color = getThresholdHex(h)
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className="w-3 h-12 bg-border-base rounded-sm overflow-hidden flex flex-col justify-end">
              <div
                className="w-full rounded-sm transition-[height] duration-300"
                style={{ height: `${h}%`, background: color }}
              />
            </div>
            <span className="text-[9px] text-text-muted font-mono">C{i}</span>
          </div>
        )
      })}
    </div>
  )
}, (prev, next) => prev.perCore === next.perCore)
