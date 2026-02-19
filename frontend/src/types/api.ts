import type { Snapshot } from './metrics'

export interface ServerInfo {
  hostname: string
  os: string
  arch: string
  uptime: string
  interval_ms?: number
  ncdu_cache_ttl_ms?: number
}

export interface WSMessage {
  type?: string
  snapshot?: Snapshot
  ncdu_ready?: boolean
}
