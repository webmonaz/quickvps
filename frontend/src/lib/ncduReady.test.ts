import { describe, expect, it } from 'vitest'
import { shouldFetchNcduStatus } from '@/lib/ncduReady'

describe('shouldFetchNcduStatus', () => {
  it('fetches when ready transitions from false to true', () => {
    expect(shouldFetchNcduStatus(false, true, false, false)).toBe(true)
  })

  it('does not fetch repeatedly when ready stays true and not scanning', () => {
    expect(shouldFetchNcduStatus(true, true, false, false)).toBe(false)
  })

  it('fetches when scan just started and ready is still true', () => {
    expect(shouldFetchNcduStatus(true, true, false, true)).toBe(true)
  })
})
