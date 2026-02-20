export type FirewallBackend = 'none' | 'ufw' | 'nftables' | 'iptables'

export interface FirewallStatus {
  backend: FirewallBackend
  enabled: boolean
  default_policy: string
  scanned_at: string
  error?: string
}

export interface FirewallRule {
  backend: FirewallBackend
  action: string
  direction: string
  protocol: string
  port: number
  source: string
  raw: string
}

export interface FirewallExposure {
  port: number
  protocol: string
  address: string
  pid: number
  process: string
  risk: string
  reason: string
}
