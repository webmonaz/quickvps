import { memo } from 'react'

interface StatusDotProps {
  connected: boolean
}

export const StatusDot = memo(function StatusDot({ connected }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full transition-colors ${
        connected ? 'bg-accent-green shadow-[0_0_6px_#3ddc84]' : 'bg-accent-red'
      }`}
    />
  )
})
