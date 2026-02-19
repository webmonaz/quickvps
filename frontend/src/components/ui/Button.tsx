import { memo } from 'react'

type Variant = 'primary' | 'danger' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent-blue text-bg-primary hover:opacity-90',
  danger:  'bg-accent-red text-bg-primary hover:opacity-90',
  ghost:   'bg-transparent border border-border-base text-text-secondary hover:bg-bg-card-hover',
}

export const Button = memo(function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-base transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})
