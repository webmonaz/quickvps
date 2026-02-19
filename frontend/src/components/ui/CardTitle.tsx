import { memo } from 'react'

interface CardTitleProps {
  children: React.ReactNode
  className?: string
}

export const CardTitle = memo(function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <div className={`text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 ${className}`}>
      {children}
    </div>
  )
})
