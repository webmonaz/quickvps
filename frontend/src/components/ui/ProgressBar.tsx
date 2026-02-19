import { memo } from 'react'
import { getThresholdHex } from '@/lib/thresholdColor'

interface ProgressBarProps {
  percent: number
  className?: string
}

export const ProgressBar = memo(function ProgressBar({ percent, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  const color   = getThresholdHex(clamped)
  return (
    <div className={`w-full h-1.5 bg-border-base rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  )
})
