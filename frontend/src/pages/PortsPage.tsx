import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import type { PortListener } from '@/types/api'

interface PortsResponse {
  listeners?: PortListener[]
}

export default function PortsPage() {
  const { t } = useTranslation()
  const [listeners, setListeners] = useState<PortListener[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [killingPort, setKillingPort] = useState<number | null>(null)

  const fetchPorts = useCallback(async () => {
    try {
      setError('')
      const res = await fetch('/api/ports')
      if (!res.ok) {
        throw new Error('failed to fetch ports')
      }
      const payload = await res.json() as PortsResponse
      setListeners(payload.listeners ?? [])
    } catch (err) {
      console.error('Failed to fetch ports:', err)
      setError(t('ports.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchPorts()
    const timer = window.setInterval(fetchPorts, 5000)
    return () => window.clearInterval(timer)
  }, [fetchPorts])

  const groupedByPort = useMemo(() => {
    const map = new Map<number, PortListener[]>()
    for (const item of listeners) {
      const current = map.get(item.port) ?? []
      current.push(item)
      map.set(item.port, current)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [listeners])

  async function handleKillPort(port: number) {
    const targets = listeners.filter((item) => item.port === port)
    const processSummary = [...new Set(targets.map((item) => item.process).filter(Boolean))].join(', ')
    const confirmed = window.confirm(
      t('ports.killConfirm', {
        port,
        processes: processSummary || t('ports.unknownProcess'),
      }),
    )
    if (!confirmed) {
      return
    }

    setKillingPort(port)
    setError('')
    try {
      const res = await fetch(`/api/ports/${port}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'failed to kill process')
      }
      await fetchPorts()
    } catch (err) {
      console.error('Failed to kill port:', err)
      setError(t('ports.killError'))
    } finally {
      setKillingPort(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{t('ports.title')}</CardTitle>
            <p className="mt-1 text-xs text-text-secondary">{t('ports.hint')}</p>
          </div>
          <Button variant="ghost" onClick={fetchPorts}>{t('ports.refresh')}</Button>
        </div>
      </Card>

      <Card>
        {error && (
          <div className="mb-3 text-xs text-accent-red">{error}</div>
        )}

        {loading ? (
          <p className="text-xs font-mono text-text-secondary">{t('ports.loading')}</p>
        ) : groupedByPort.length === 0 ? (
          <p className="text-xs font-mono text-text-secondary">{t('ports.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border-base">
                  <th className="py-2 pr-3">{t('ports.port')}</th>
                  <th className="py-2 pr-3">{t('ports.protocol')}</th>
                  <th className="py-2 pr-3">{t('ports.address')}</th>
                  <th className="py-2 pr-3">{t('ports.pid')}</th>
                  <th className="py-2 pr-3">{t('ports.process')}</th>
                  <th className="py-2 text-right">{t('ports.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {groupedByPort.map(([port, rows]) => (
                  rows.map((row, idx) => (
                    <tr key={`${row.protocol}-${row.address}-${row.pid}-${port}`} className="border-b border-border-base last:border-0">
                      <td className="py-2 pr-3 text-text-primary">{idx === 0 ? port : ''}</td>
                      <td className="py-2 pr-3 text-text-secondary">{row.protocol}</td>
                      <td className="py-2 pr-3 text-text-secondary">{row.address}</td>
                      <td className="py-2 pr-3 text-text-secondary">{row.pid}</td>
                      <td className="py-2 pr-3 text-text-primary">{row.process}</td>
                      <td className="py-2 text-right">
                        {idx === 0 && (
                          <Button
                            variant="danger"
                            onClick={() => handleKillPort(port)}
                            disabled={killingPort === port}
                          >
                            {killingPort === port ? t('ports.killing') : t('ports.kill')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}