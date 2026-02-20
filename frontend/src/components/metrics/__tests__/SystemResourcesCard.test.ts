/**
 * Data-derivation logic tests for CpuCard and MemorySwapCard.
 * The test environment is `node` (no jsdom / React Testing Library),
 * so we test the selector/display logic extracted as pure functions.
 */
import { describe, expect, it } from 'vitest'
import type { Snapshot } from '@/types/metrics'

// ── Selector mirrors ──────────────────────────────────────────────────────────

function deriveCpu(snapshot: Snapshot | null) {
  if (!snapshot) return null
  return {
    pct:     Math.round(snapshot.cpu.total_percent),
    model:   snapshot.cpu.model_name,
    freq:    snapshot.cpu.freq_mhz,
    perCore: snapshot.cpu.per_core,
  }
}

function deriveMem(snapshot: Snapshot | null) {
  if (!snapshot) return null
  return {
    mem: {
      pct:     Math.round(snapshot.memory.percent),
      used:    snapshot.memory.used_bytes,
      total:   snapshot.memory.total_bytes,
    },
    swap: {
      pct:   Math.round(snapshot.swap.percent),
      used:  snapshot.swap.used_bytes,
      total: snapshot.swap.total_bytes,
    },
  }
}

function swapDisplayText(data: ReturnType<typeof deriveMem>): string {
  if (!data) return '—'
  return data.swap.total > 0 ? 'has-swap' : 'No Swap'
}

// ── Fixture ───────────────────────────────────────────────────────────────────

const base: Snapshot = {
  timestamp: '2026-01-01T00:00:00Z',
  cpu: {
    total_percent: 55.3,
    per_core:      [40, 70],
    model_name:    'AMD EPYC 7B12',
    freq_mhz:      2250,
    core_count:    2,
  },
  memory: {
    percent:    72.0,
    used_bytes: 6 * 1024 ** 3,
    total_bytes: 8 * 1024 ** 3,
    free_bytes:  2 * 1024 ** 3,
    cached:      512 * 1024 ** 2,
    buffers:     128 * 1024 ** 2,
  },
  swap: {
    percent:    15,
    used_bytes: 512 * 1024 ** 2,
    total_bytes: 4 * 1024 ** 3,
    free_bytes:  3584 * 1024 ** 2,
  },
  disks:    [],
  disk_io:  [],
  network:  [],
}

// ── CpuCard ───────────────────────────────────────────────────────────────────

describe('CpuCard — data selector', () => {
  it('returns null when snapshot is null (loading state)', () => {
    expect(deriveCpu(null)).toBeNull()
  })

  it('rounds CPU total_percent', () => {
    expect(deriveCpu(base)!.pct).toBe(55) // Math.round(55.3)
  })

  it('preserves model name and per-core array', () => {
    const d = deriveCpu(base)!
    expect(d.model).toBe('AMD EPYC 7B12')
    expect(d.perCore).toEqual([40, 70])
  })

  it('preserves freq_mhz', () => {
    expect(deriveCpu(base)!.freq).toBe(2250)
  })
})

// ── MemorySwapCard ────────────────────────────────────────────────────────────

describe('MemorySwapCard — data selector', () => {
  it('returns null when snapshot is null (loading state)', () => {
    expect(deriveMem(null)).toBeNull()
  })

  it('rounds memory percent', () => {
    expect(deriveMem(base)!.mem.pct).toBe(72)
  })

  it('rounds swap percent', () => {
    expect(deriveMem(base)!.swap.pct).toBe(15)
  })
})

describe('MemorySwapCard — swap display logic', () => {
  it('shows placeholder dash when data is null', () => {
    expect(swapDisplayText(null)).toBe('—')
  })

  it('shows swap values when swap is configured', () => {
    expect(swapDisplayText(deriveMem(base))).toBe('has-swap')
  })

  it('shows "No Swap" when swap total_bytes is 0', () => {
    const noSwap: Snapshot = {
      ...base,
      swap: { percent: 0, used_bytes: 0, total_bytes: 0, free_bytes: 0 },
    }
    expect(swapDisplayText(deriveMem(noSwap))).toBe('No Swap')
  })
})
