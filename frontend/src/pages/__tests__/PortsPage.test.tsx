/* @vitest-environment jsdom */
import '@/i18n'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import PortsPage from '@/pages/PortsPage'
import { useStore } from '@/store'

describe('PortsPage (jsdom)', () => {
  beforeAll(() => {
    const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    actEnv.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useStore.setState({ toasts: [] })
  })

  it('shows backend error detail when ports loading fails', async () => {
    const fetchMock = vi.fn(async () => (
      new Response(JSON.stringify({ error: 'lsof command not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    ))
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<PortsPage />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const messages = useStore.getState().toasts.map((item) => item.message)
    expect(messages).toContain('lsof command not found')

    await act(async () => {
      root.unmount()
    })
  })
})
