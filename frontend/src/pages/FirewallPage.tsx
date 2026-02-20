import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import type { FirewallExposure, FirewallRule, FirewallStatus } from '@/types/firewall'

export default function FirewallPage() {
  const { showError } = useToast()
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [exposures, setExposures] = useState<FirewallExposure[]>([])
  const [unsupportedMessage, setUnsupportedMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, r, e] = await Promise.all([
        fetch('/api/firewall/status'),
        fetch('/api/firewall/rules'),
        fetch('/api/firewall/exposures'),
      ])
      if (s.status === 501 || r.status === 501 || e.status === 501) {
        const payload = await s.json().catch(() => ({ error: 'Firewall audit is supported on Linux only' })) as { error?: string }
        setUnsupportedMessage(payload.error || 'Firewall audit is supported on Linux only')
        setStatus(null)
        setRules([])
        setExposures([])
        return
      }
      if (!s.ok || !r.ok || !e.ok) throw new Error('failed to fetch firewall audit')

      setUnsupportedMessage('')
      setStatus(await s.json() as FirewallStatus)
      setRules(((await r.json()) as { rules: FirewallRule[] }).rules ?? [])
      setExposures(((await e.json()) as { exposures: FirewallExposure[] }).exposures ?? [])
    } catch (err) {
      console.error('Failed to load firewall audit:', err)
      showError('Failed to load firewall audit')
    }
  }, [showError])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {unsupportedMessage ? (
        <Card>
          <CardTitle>Firewall Audit</CardTitle>
          <p className="mt-3 text-xs font-mono text-accent-yellow">{unsupportedMessage}</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Firewall Audit</CardTitle>
              <Button variant="ghost" onClick={load}>Refresh</Button>
            </div>
            <div className="mt-3 text-xs font-mono text-text-secondary space-y-1">
              <p>Backend: <span className="text-text-primary">{status?.backend ?? 'unknown'}</span></p>
              <p>Enabled: <span className="text-text-primary">{status?.enabled ? 'yes' : 'no'}</span></p>
              <p>Default Policy: <span className="text-text-primary">{status?.default_policy ?? 'unknown'}</span></p>
              {status?.error && <p className="text-accent-red">Error: {status.error}</p>}
            </div>
          </Card>

          <Card>
            <CardTitle>Inbound Rules</CardTitle>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="text-text-secondary border-b border-border-base">
                  <tr>
                    <th className="text-left py-2 pr-3">Action</th>
                    <th className="text-left py-2 pr-3">Proto</th>
                    <th className="text-left py-2 pr-3">Port</th>
                    <th className="text-left py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, idx) => (
                    <tr key={`${rule.protocol}-${rule.port}-${idx}`} className="border-b border-border-base/40 text-text-primary">
                      <td className="py-2 pr-3">{rule.action}</td>
                      <td className="py-2 pr-3">{rule.protocol}</td>
                      <td className="py-2 pr-3">{rule.port}</td>
                      <td className="py-2">{rule.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardTitle>Exposures</CardTitle>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="text-text-secondary border-b border-border-base">
                  <tr>
                    <th className="text-left py-2 pr-3">Port</th>
                    <th className="text-left py-2 pr-3">Process</th>
                    <th className="text-left py-2 pr-3">Risk</th>
                    <th className="text-left py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {exposures.map((exp, idx) => (
                    <tr key={`${exp.protocol}-${exp.port}-${idx}`} className="border-b border-border-base/40 text-text-primary">
                      <td className="py-2 pr-3">{exp.port}/{exp.protocol.toLowerCase()}</td>
                      <td className="py-2 pr-3">{exp.process || 'unknown'} ({exp.pid})</td>
                      <td className="py-2 pr-3">{exp.risk}</td>
                      <td className="py-2">{exp.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
