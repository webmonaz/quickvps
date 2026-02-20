import { describe, expect, it } from 'vitest'
import { canManageAlerts, formatAlertStateLabel, normalizeRetryDelays, parseCommaList } from './alerts'

describe('alerts helpers', () => {
  it('canManageAlerts requires admin and non-read-only mode', () => {
    const info = { hostname: 'h', os: 'linux', arch: 'amd64', uptime: '1h', alerts_read_only: false }
    const readOnlyInfo = { ...info, alerts_read_only: true }
    expect(canManageAlerts({ id: 1, username: 'a', role: 'admin' }, info)).toBe(true)
    expect(canManageAlerts({ id: 2, username: 'v', role: 'viewer' }, info)).toBe(false)
    expect(canManageAlerts({ id: 1, username: 'a', role: 'admin' }, readOnlyInfo)).toBe(false)
  })

  it('parseCommaList removes empty and spaces', () => {
    expect(parseCommaList('a@x.com, b@x.com, , c@x.com')).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
  })

  it('normalizeRetryDelays returns defaults when invalid', () => {
    expect(normalizeRetryDelays('x, -1')).toEqual([1, 5, 15])
    expect(normalizeRetryDelays('0, 3, 10')).toEqual([0, 3, 10])
  })

  it('formatAlertStateLabel normalizes labels', () => {
    expect(formatAlertStateLabel('critical')).toBe('CRITICAL')
    expect(formatAlertStateLabel('none')).toBe('NORMAL')
  })
})
