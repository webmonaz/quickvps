import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import type { PackageInventoryResponse, PackageUpdatesResponse } from '@/types/packages'

export default function PackagesPage() {
  const { showError } = useToast()
  const [inventory, setInventory] = useState<PackageInventoryResponse | null>(null)
  const [updates, setUpdates] = useState<PackageUpdatesResponse | null>(null)
  const [unsupportedMessage, setUnsupportedMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const [invRes, updRes] = await Promise.all([
        fetch('/api/packages/inventory?limit=100'),
        fetch('/api/packages/updates'),
      ])
      if (invRes.status === 501 || updRes.status === 501) {
        const payload = await invRes.json().catch(() => ({ error: 'Package audit is supported on Linux only' })) as { error?: string }
        setUnsupportedMessage(payload.error || 'Package audit is supported on Linux only')
        setInventory(null)
        setUpdates(null)
        return
      }
      if (!invRes.ok || !updRes.ok) throw new Error('failed to fetch package audit')
      setUnsupportedMessage('')
      setInventory(await invRes.json() as PackageInventoryResponse)
      setUpdates(await updRes.json() as PackageUpdatesResponse)
    } catch (err) {
      console.error('Failed to load package audit:', err)
      showError('Failed to load package audit')
    }
  }, [showError])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {unsupportedMessage ? (
        <Card>
          <CardTitle>Package Audit</CardTitle>
          <p className="mt-3 text-xs font-mono text-accent-yellow">{unsupportedMessage}</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Package Audit</CardTitle>
              <Button variant="ghost" onClick={load}>Refresh</Button>
            </div>
            <div className="mt-3 text-xs font-mono text-text-secondary space-y-1">
              <p>Manager: <span className="text-text-primary">{inventory?.manager ?? 'unknown'}</span></p>
              <p>Total packages: <span className="text-text-primary">{inventory?.total ?? 0}</span></p>
              <p>Updates available: <span className="text-text-primary">{updates?.total ?? 0}</span></p>
              {inventory?.error && <p className="text-accent-red">Error: {inventory.error}</p>}
              {updates?.error && <p className="text-accent-red">Error: {updates.error}</p>}
            </div>
          </Card>

          <Card>
            <CardTitle>Pending Updates</CardTitle>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="text-text-secondary border-b border-border-base">
                  <tr>
                    <th className="text-left py-2 pr-3">Package</th>
                    <th className="text-left py-2 pr-3">Current</th>
                    <th className="text-left py-2">New</th>
                  </tr>
                </thead>
                <tbody>
                  {(updates?.updates ?? []).map((row) => (
                    <tr key={`${row.name}-${row.new_version}`} className="border-b border-border-base/40 text-text-primary">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3">{row.current_version || '—'}</td>
                      <td className="py-2">{row.new_version}</td>
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
