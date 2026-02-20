import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useStore } from '@/store'
import { canManageAlerts, formatAlertStateLabel } from '@/lib/alerts'
import type { AlertConfig, AlertHistoryResponse, AlertStatus } from '@/types/alerts'

export default function AlertsPage() {
  const { t } = useTranslation()
  const { showError, showSuccess } = useToast()
  const authUser = useStore((s) => s.authUser)
  const serverInfo = useStore((s) => s.serverInfo)

  const [config, setConfig] = useState<AlertConfig | null>(null)
  const [status, setStatus] = useState<AlertStatus | null>(null)
  const [history, setHistory] = useState<AlertHistoryResponse['events']>([])
  const [loading, setLoading] = useState(true)

  const manageAllowed = canManageAlerts(authUser, serverInfo)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, statusRes, historyRes] = await Promise.all([
        fetch('/api/alerts/config'),
        fetch('/api/alerts/status'),
        fetch('/api/alerts/history?limit=50'),
      ])

      if (!cfgRes.ok || !statusRes.ok || !historyRes.ok) {
        throw new Error('failed to fetch alerts data')
      }

      setConfig(await cfgRes.json() as AlertConfig)
      setStatus(await statusRes.json() as AlertStatus)
      const historyPayload = await historyRes.json() as AlertHistoryResponse
      setHistory(historyPayload.events ?? [])
    } catch (err) {
      console.error('Failed to load alerts page:', err)
      showError('Failed to load alerts data')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    load()
  }, [load])

  async function handleSendTest() {
    try {
      const res = await fetch('/api/alerts/test', { method: 'POST' })
      if (!res.ok) {
        throw new Error('failed to send test alert')
      }
      showSuccess(t('alerts.testSent'))
      await load()
    } catch (err) {
      console.error('Failed to send test alert:', err)
      showError(t('alerts.testFailed'))
    }
  }

  async function handleMute(minutes: number) {
    try {
      const res = await fetch('/api/alerts/silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      })
      if (!res.ok) {
        throw new Error('failed to mute alerts')
      }
      showSuccess(t('alerts.muteSuccess'))
      await load()
    } catch (err) {
      console.error('Failed to mute alerts:', err)
      showError(t('alerts.muteFailed'))
    }
  }

  async function handleClearMute() {
    try {
      const res = await fetch('/api/alerts/silence', { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('failed to clear mute')
      }
      showSuccess(t('alerts.unmuteSuccess'))
      await load()
    } catch (err) {
      console.error('Failed to clear mute:', err)
      showError(t('alerts.unmuteFailed'))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-lg font-semibold font-mono text-text-primary">{t('alerts.title')}</h1>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>{t('alerts.statusTitle')}</CardTitle>
          <Button variant="ghost" onClick={load}>{t('alerts.refresh')}</Button>
        </div>

        {loading ? (
          <p className="text-xs font-mono text-text-secondary mt-3">{t('alerts.loading')}</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-text-secondary">
            <div>
              <p>{t('alerts.currentState')}: <span className="text-text-primary font-semibold">{formatAlertStateLabel(status?.current_state ?? 'none')}</span></p>
              <p>{t('alerts.lastCpu')}: <span className="text-text-primary">{Math.round(status?.last_cpu_percent ?? 0)}%</span></p>
              <p>{t('alerts.enabled')}: <span className="text-text-primary">{config?.enabled ? t('alerts.yes') : t('alerts.no')}</span></p>
            </div>
            <div>
              <p>{t('alerts.silenced')}: <span className="text-text-primary">{status?.silenced ? t('alerts.yes') : t('alerts.no')}</span></p>
              <p>{t('alerts.mutedUntil')}: <span className="text-text-primary">{status?.muted_until ?? '—'}</span></p>
              <p>{t('alerts.retention')}: <span className="text-text-primary">{serverInfo?.alerts_history_retention_days ?? 30}d</span></p>
            </div>
          </div>
        )}

        {manageAllowed && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleSendTest}>{t('alerts.sendTest')}</Button>
            <Button variant="ghost" onClick={() => handleMute(30)}>{t('alerts.mute30m')}</Button>
            <Button variant="ghost" onClick={handleClearMute}>{t('alerts.clearMute')}</Button>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>{t('alerts.historyTitle')}</CardTitle>

        {history.length === 0 ? (
          <p className="text-xs font-mono text-text-secondary mt-3">{t('alerts.noHistory')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="text-text-secondary border-b border-border-base">
                <tr>
                  <th className="text-left py-2 pr-3">ID</th>
                  <th className="text-left py-2 pr-3">{t('alerts.level')}</th>
                  <th className="text-left py-2 pr-3">CPU</th>
                  <th className="text-left py-2 pr-3">{t('alerts.message')}</th>
                  <th className="text-left py-2">{t('alerts.time')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((event) => (
                  <tr key={event.id} className="border-b border-border-base/40 text-text-primary">
                    <td className="py-2 pr-3">{event.id}</td>
                    <td className="py-2 pr-3">{formatAlertStateLabel(event.level)}</td>
                    <td className="py-2 pr-3">{Math.round(event.cpu_percent)}%</td>
                    <td className="py-2 pr-3">{event.message}</td>
                    <td className="py-2">{event.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
