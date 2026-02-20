/* @vitest-environment jsdom */
import '@/i18n'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import SettingsPage from '@/pages/SettingsPage'
import { useStore } from '@/store'

function findButton(container: HTMLElement, text: string, index = 0): HTMLButtonElement {
  const matches = Array.from(container.querySelectorAll('button')).filter((btn) => btn.textContent?.trim() === text)
  if (!matches[index]) {
    throw new Error(`button not found: ${text} at index ${index}`)
  }
  return matches[index] as HTMLButtonElement
}

describe('SettingsPage (jsdom)', () => {
  beforeAll(() => {
    const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    actEnv.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('supports rotate/clear secret controls and sends clear flag in payload', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === '/api/alerts/config' && (!init || !init.method || init.method === 'GET')) {
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
          recipient_emails: ['ops@example.com'],
          telegram_chat_ids: ['-100123'],
          retry_delays_sec: [1, 5, 15],
          has_telegram_token: true,
          telegram_token_mask: '****1234',
          has_gmail_password: true,
          gmail_password_mask: '****abcd',
          gmail_address: 'ops@example.com',
          secrets_writable: true,
          read_only: false,
        }), { status: 200 })
      }
      if (url === '/api/alerts/config' && init?.method === 'PUT') {
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
          recipient_emails: ['ops@example.com'],
          telegram_chat_ids: ['-100123'],
          retry_delays_sec: [1, 5, 15],
          has_telegram_token: true,
          telegram_token_mask: '****9999',
          has_gmail_password: true,
          gmail_password_mask: '****abcd',
          gmail_address: 'ops@example.com',
          secrets_writable: true,
          read_only: false,
        }), { status: 200 })
      }
      if (url === '/api/auth/me') {
        return new Response(JSON.stringify({ user: { id: 1, username: 'admin', role: 'admin' } }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    useStore.setState({
      authUser: { id: 1, username: 'admin', role: 'admin' },
      authLoading: false,
      serverInfo: {
        hostname: 'host',
        os: 'linux',
        arch: 'amd64',
        uptime: '1d',
        auth_enabled: true,
        alerts_read_only: false,
      },
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<SettingsPage />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const rotateButtons = Array.from(container.querySelectorAll('button')).filter((btn) => btn.textContent?.trim() === 'Rotate')
    expect(rotateButtons.length).toBeGreaterThan(0)

    await act(async () => {
      (rotateButtons[0] as HTMLButtonElement).click()
    })

    const secretInput = container.querySelector('input[placeholder="Enter new secret"]') as HTMLInputElement | null
    expect(secretInput).not.toBeNull()

    const clearButtons = Array.from(container.querySelectorAll('button')).filter((btn) => btn.textContent?.trim() === 'Clear')
    expect(clearButtons.length).toBeGreaterThan(0)

    await act(async () => {
      (clearButtons[0] as HTMLButtonElement).click()
      await Promise.resolve()
    })

    const saveAlertsBtn = findButton(container, 'Save Alerts')
    await act(async () => {
      saveAlertsBtn.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const putCall = fetchMock.mock.calls.find((call) => String(call[0]) === '/api/alerts/config' && call[1]?.method === 'PUT')
    expect(putCall).toBeTruthy()
    const payload = JSON.parse(String(putCall?.[1]?.body ?? '{}')) as Record<string, unknown>
    expect(payload.clear_telegram_bot_token).toBe(true)

    await act(async () => {
      root.unmount()
    })
  })
})
