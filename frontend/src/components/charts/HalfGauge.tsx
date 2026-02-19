import { memo, useEffect, useRef } from 'react'
import { Chart } from 'chart.js'
import { buildGaugeConfig } from '@/lib/chartConfig'
import { getThresholdHex } from '@/lib/thresholdColor'
import { GAUGE_COLORS } from '@/constants/chart'

interface HalfGaugeProps {
  percent: number
}

function areEqual(prev: HalfGaugeProps, next: HalfGaugeProps) {
  return prev.percent === next.percent
}

export const HalfGauge = memo(function HalfGauge({ percent }: HalfGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef  = useRef<Chart<any> | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartRef.current = new Chart(ctx, buildGaugeConfig(0) as any)
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const clamped = Math.min(100, Math.max(0, percent))
    const color   = getThresholdHex(clamped)
    chart.data.datasets[0].data            = [clamped, 100 - clamped]
    chart.data.datasets[0].backgroundColor = [color, GAUGE_COLORS.track]
    chart.update('none')
  }, [percent])

  return <canvas ref={canvasRef} className="block w-full h-full" />
}, areEqual)
