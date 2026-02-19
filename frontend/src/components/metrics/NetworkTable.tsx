import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { formatBps } from '@/lib/formatBps'
import { formatBytes } from '@/lib/formatBytes'

export const NetworkTable = memo(function NetworkTable() {
  const nets = useStore((s) => s.snapshot?.network ?? [], shallow)

  return (
    <Card>
      <CardTitle>Network Interfaces</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-text-muted border-b border-border-base">
              <th className="text-left pb-2 pr-4">Interface</th>
              <th className="text-right pb-2 pr-4">↓ Recv/s</th>
              <th className="text-right pb-2 pr-4">↑ Sent/s</th>
              <th className="text-right pb-2 pr-4">Total Recv</th>
              <th className="text-right pb-2">Total Sent</th>
            </tr>
          </thead>
          <tbody>
            {nets.map((n) => (
              <tr key={n.interface} className="border-b border-border-base last:border-0">
                <td className="py-1.5 pr-4 text-accent-blue">{n.interface}</td>
                <td className="py-1.5 pr-4 text-right text-accent-green">{formatBps(n.recv_bps)}</td>
                <td className="py-1.5 pr-4 text-right text-accent-red">{formatBps(n.sent_bps)}</td>
                <td className="py-1.5 pr-4 text-right text-text-secondary">{formatBytes(n.total_recv)}</td>
                <td className="py-1.5 text-right text-text-secondary">{formatBytes(n.total_sent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
})
