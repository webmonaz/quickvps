import { memo } from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card = memo(function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-bg-card border border-border-base rounded-card p-4 ${className}`}>
      {children}
    </div>
  )
})
