import type { Snapshot } from './metrics'

export interface ServerInfo {
  hostname: string
  os: string
  arch: string
  uptime: string
  interval_ms?: number
  ncdu_cache_ttl_sec?: number
  ncdu_cache_ttl_ms?: number
}

export interface PortListener {
  protocol: string
  address: string
  port: number
  pid: number
  process: string
}

export interface WSMessage {
  type?: string
  snapshot?: Snapshot
  ncdu_ready?: boolean
}
