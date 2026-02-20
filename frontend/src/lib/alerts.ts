import type { AuthUser, ServerInfo } from '@/types/api'

export function canManageAlerts(authUser: AuthUser | null, serverInfo: ServerInfo | null): boolean {
  if (!authUser || authUser.role !== 'admin') return false
  if (serverInfo?.alerts_read_only) return false
  return true
}

export function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function normalizeRetryDelays(raw: string): number[] {
  const delays = raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .map((n) => Math.round(n))

  if (delays.length === 0) return [1, 5, 15]
  return delays
}

export function formatAlertStateLabel(state: string): string {
  const normalized = state.toLowerCase()
  if (normalized === 'critical') return 'CRITICAL'
  if (normalized === 'warning') return 'WARNING'
  if (normalized === 'recovery') return 'RECOVERY'
  if (normalized === 'test') return 'TEST'
  return 'NORMAL'
}
