import { memo, useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { CHART_POINTS } from '@/constants/chart'

interface Dataset {
  label: string
  color: string
  data: number[]
}

interface RollingLineChartProps {
  datasets: Dataset[]
  yFormat?: 'bytes/s' | 'percent'
}

function areEqual(prev: RollingLineChartProps, next: RollingLineChartProps): boolean {
  if (prev.yFormat !== next.yFormat) return false
  if (prev.datasets.length !== next.datasets.length) return false
  return prev.datasets.every((d, i) => d.data === next.datasets[i].data)
}

const EMPTY_LABELS = Array(CHART_POINTS).fill('')

export const RollingLineChart = memo(function RollingLineChart({ datasets, yFormat = 'bytes/s' }: RollingLineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: EMPTY_LABELS,
        datasets: datasets.map((d) => ({
          label:           d.label,
          data:            [...d.data],
          borderColor:     d.color,
          backgroundColor: d.color + '1a',
          borderWidth:     1.5,
          pointRadius:     0,
          tension:         0.3,
          fill:            true,
        })),
      },
      options: {
        animation:          false,
        responsive:         true,
        maintainAspectRatio: false,
        scales: {
          x: { display: false },
          y: {
            display: true,
            min: yFormat === 'percent' ? 0   : undefined,
            max: yFormat === 'percent' ? 100 : undefined,
            grid:    { color: '#2a2d3e' },
            ticks: {
              color:         '#8892a4',
              font:          { size: 10, family: 'JetBrains Mono, monospace' },
              maxTicksLimit: 4,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (val: any) => {
                const n = typeof val === 'number' ? val : parseFloat(val)
                return yFormat === 'percent' ? n.toFixed(0) + '%' : fmtBytes(n) + '/s'
              },
            },
          },
        },
        plugins: {
          legend:  { display: false },
          tooltip: { enabled: false },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    datasets.forEach((d, i) => {
      if (chart.data.datasets[i]) {
        chart.data.datasets[i].data = [...d.data]
      }
    })
    chart.update('none')
  }, [datasets])

  return <canvas ref={canvasRef} className="block w-full h-full" />
}, areEqual)

function fmtBytes(b: number): string {
  if (b < 1024) return b.toFixed(0) + ' B'
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' K'
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' M'
  return (b / 1024 ** 3).toFixed(1) + ' G'
}
