import { describe, expect, it } from 'vitest'
import { CHART_POINTS, GAUGE_COLORS } from './chart'

describe('chart constants', () => {
  it('keeps rolling window point count at 60', () => {
    expect(CHART_POINTS).toBe(60)
  })

  it('exposes required gauge color tokens', () => {
    expect(GAUGE_COLORS.green).toBeTruthy()
    expect(GAUGE_COLORS.yellow).toBeTruthy()
    expect(GAUGE_COLORS.red).toBeTruthy()
    expect(GAUGE_COLORS.track).toBeTruthy()
  })
})
