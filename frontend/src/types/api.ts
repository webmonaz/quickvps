import type { Snapshot } from './metrics'

export interface ServerInfo {
  hostname: string
  os: string
  arch: string
  uptime: string
}

export interface WSMessage {
  type?: string
  snapshot?: Snapshot
  ncdu_ready?: boolean
}
