import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':     'var(--color-bg-primary)',
        'bg-card':        'var(--color-bg-card)',
        'bg-card-hover':  'var(--color-bg-card-hover)',
        'border-base':    'var(--color-border-base)',
        'text-primary':   'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted':     'var(--color-text-muted)',
        'accent-blue':    'var(--color-accent-blue)',
        'accent-green':   'var(--color-accent-green)',
        'accent-yellow':  'var(--color-accent-yellow)',
        'accent-red':     'var(--color-accent-red)',
        'accent-purple':  'var(--color-accent-purple)',
        'accent-cyan':    'var(--color-accent-cyan)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        base: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config
