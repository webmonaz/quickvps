import { memo } from 'react'

interface SpinnerProps {
  className?: string
}

export const Spinner = memo(function Spinner({ className = '' }: SpinnerProps) {
  return (
    <span
      className={`inline-block w-3.5 h-3.5 border-2 border-text-muted border-t-accent-blue rounded-full animate-spin ${className}`}
    />
  )
})
