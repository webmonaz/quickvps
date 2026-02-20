import type { Snapshot } from './metrics'

export type UserRole = 'admin' | 'viewer'

export interface AuthUser {
  id: number
  username: string
  role: UserRole
}

export interface ServerInfo {
  hostname: string
  os: string
  arch: string
  uptime: string
  auth_enabled?: boolean
  interval_ms?: number
  ncdu_cache_ttl_sec?: number
  ncdu_cache_ttl_ms?: number
  local_ip?: string
  public_ip?: string
  dns_servers?: string[]
  version?: string
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

export interface AuthMeResponse {
  user?: AuthUser
  auth_disabled?: boolean
}

export interface UserAuditEntry {
  id: number
  actor_user_id: number
  actor_username: string
  action: string
  target_user_id: number
  target_username: string
  details: string
  created_at: string
}
