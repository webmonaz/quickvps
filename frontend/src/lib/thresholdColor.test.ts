import { describe, expect, it } from 'vitest'
import { THRESHOLD_DANGER, THRESHOLD_WARN } from '@/constants/thresholds'
import { getThresholdBgColor, getThresholdColor, getThresholdHex } from './thresholdColor'

describe('thresholdColor helpers', () => {
  it('returns green variants below warn threshold', () => {
    const pct = THRESHOLD_WARN - 1
    expect(getThresholdColor(pct)).toBe('text-accent-green')
    expect(getThresholdBgColor(pct)).toBe('bg-accent-green')
    expect(getThresholdHex(pct)).toBe('#3ddc84')
  })

  it('returns yellow variants between warn and danger thresholds', () => {
    expect(getThresholdColor(THRESHOLD_WARN)).toBe('text-accent-yellow')
    expect(getThresholdBgColor(THRESHOLD_WARN)).toBe('bg-accent-yellow')
    expect(getThresholdHex(THRESHOLD_WARN)).toBe('#fbbf24')
  })

  it('returns red variants at and above danger threshold', () => {
    expect(getThresholdColor(THRESHOLD_DANGER)).toBe('text-accent-red')
    expect(getThresholdBgColor(THRESHOLD_DANGER)).toBe('bg-accent-red')
    expect(getThresholdHex(THRESHOLD_DANGER)).toBe('#f87171')
  })
})
