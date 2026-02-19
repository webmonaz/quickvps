import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'
import { formatBps } from './formatBps'

describe('formatBytes', () => {
  it('returns em dash for nullish values', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })

  it('formats bytes, KB, MB, and GB ranges', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2.5 * 1024 ** 2)).toBe('2.5 MB')
    expect(formatBytes(3.25 * 1024 ** 3)).toBe('3.25 GB')
  })
})

describe('formatBps', () => {
  it('returns em dash for nullish values', () => {
    expect(formatBps(null)).toBe('—')
    expect(formatBps(undefined)).toBe('—')
  })

  it('appends per-second suffix to formatted bytes', () => {
    expect(formatBps(1024)).toBe('1.0 KB/s')
  })
})
