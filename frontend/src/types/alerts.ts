export type AlertLevel = 'none' | 'warning' | 'critical' | 'recovery' | 'test'

export interface ChannelResult {
  channel: 'telegram' | 'email' | string
  success: boolean
  attempts: number
  error_message?: string
}

export interface AlertConfig {
  enabled: boolean
  warning_percent: number
  warning_for_sec: number
  critical_percent: number
  critical_for_sec: number
  recovery_percent: number
  recovery_for_sec: number
  cooldown_sec: number
  telegram_enabled: boolean
  email_enabled: boolean
  recipient_emails: string[]
  telegram_chat_ids: string[]
  retry_delays_sec: number[]
  has_telegram_token: boolean
  telegram_token_mask: string
  has_gmail_password: boolean
  gmail_password_mask: string
  gmail_address: string
  secrets_writable: boolean
  read_only: boolean
}

export interface AlertStatus {
  current_state: AlertLevel
  last_cpu_percent: number
  last_evaluated_at?: string
  muted_until?: string
  silenced: boolean
  last_warning_at?: string
  last_critical_at?: string
  last_recovery_at?: string
  read_only: boolean
}

export interface AlertEvent {
  id: number
  level: AlertLevel
  message: string
  cpu_percent: number
  channels: ChannelResult[]
  created_at: string
}

export interface AlertHistoryResponse {
  events: AlertEvent[]
}
