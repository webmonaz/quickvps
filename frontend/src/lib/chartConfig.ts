import {
  Chart,
  DoughnutController,
  LineController,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { GAUGE_COLORS } from '@/constants/chart'
import { getThresholdHex } from './thresholdColor'

Chart.register(
  DoughnutController,
  LineController,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
)

export function buildGaugeConfig(percent: number) {
  const color = getThresholdHex(percent)
  return {
    type: 'doughnut' as const,
    data: {
      datasets: [{
        data: [percent, 100 - percent],
        backgroundColor: [color, GAUGE_COLORS.track],
        borderWidth: 0,
        borderRadius: 4,
      }],
    },
    options: {
      circumference: 180,
      rotation: -90,
      cutout: '75%',
      animation: { duration: 400, easing: 'easeOutQuart' as const },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  }
}

export function buildLineConfig(
  labels: string[],
  datasets: Array<{
    label: string
    color: string
    data: number[]
    fill?: boolean
  }>,
) {
  return {
    type: 'line' as const,
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label,
        data: d.data,
        borderColor: d.color,
        backgroundColor: d.fill ? d.color + '1a' : 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: d.fill ?? true,
      })),
    },
    options: {
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: {
          display: true,
          grid: { color: '#2a2d3e' },
          ticks: {
            color: '#8892a4',
            font: { size: 10, family: 'JetBrains Mono, monospace' },
            maxTicksLimit: 4,
            callback: (val: number | string) => {
              const n = typeof val === 'number' ? val : parseFloat(val)
              return formatBytes(n) + '/s'
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return b + ' B'
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB'
  return (b / 1024 ** 3).toFixed(2) + ' GB'
}
