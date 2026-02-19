import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':     '#0f1117',
        'bg-card':        '#1a1d27',
        'bg-card-hover':  '#1e2130',
        'border-base':    '#2a2d3e',
        'text-primary':   '#e2e8f0',
        'text-secondary': '#8892a4',
        'text-muted':     '#4a5568',
        'accent-blue':    '#4c9ef5',
        'accent-green':   '#3ddc84',
        'accent-yellow':  '#fbbf24',
        'accent-red':     '#f87171',
        'accent-purple':  '#a78bfa',
        'accent-cyan':    '#22d3ee',
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
