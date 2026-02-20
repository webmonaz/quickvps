/* @vitest-environment jsdom */
import '@/i18n'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import AlertsPage from '@/pages/AlertsPage'
import { useStore } from '@/store'

const baseServerInfo = {
  hostname: 'host',
  os: 'linux',
  arch: 'amd64',
  uptime: '1d',
  auth_enabled: true,
  alerts_read_only: false,
  alerts_history_retention_days: 30,
}

describe('AlertsPage (jsdom)', () => {
  beforeAll(() => {
    const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    actEnv.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads alerts data once on mount (no request storm)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/alerts/config') {
        return new Response(JSON.stringify({
          enabled: true,
          warning_percent: 75,
          warning_for_sec: 300,
          critical_percent: 85,
          critical_for_sec: 600,
          recovery_percent: 70,
          recovery_for_sec: 300,
          cooldown_sec: 1800,
          telegram_enabled: true,
          email_enabled: true,
          recipient_emails: [],
          telegram_chat_ids: [],
          retry_delays_sec: [1, 5, 15],
          has_telegram_token: true,
          telegram_token_mask: '****abcd',
          has_gmail_password: true,
          gmail_password_mask: '****wxyz',
          gmail_address: 'ops@example.com',
          secrets_writable: true,
          read_only: false,
        }), { status: 200 })
      }
      if (url === '/api/alerts/status') {
        return new Response(JSON.stringify({
          current_state: 'none',
          last_cpu_percent: 10,
          silenced: false,
          read_only: false,
        }), { status: 200 })
      }
      if (url.startsWith('/api/alerts/history')) {
        return new Response(JSON.stringify({ events: [] }), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    useStore.setState({
      authUser: { id: 1, username: 'admin', role: 'admin' },
      serverInfo: baseServerInfo,
      authLoading: false,
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<AlertsPage />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(calls.filter((c) => c === '/api/alerts/config')).toHaveLength(1)
    expect(calls.filter((c) => c === '/api/alerts/status')).toHaveLength(1)
    expect(calls.filter((c) => c.startsWith('/api/alerts/history'))).toHaveLength(1)

    await act(async () => {
      root.unmount()
    })
  })
})
