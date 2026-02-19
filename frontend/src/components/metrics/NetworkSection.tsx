import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { RollingLineChart } from '@/components/charts/RollingLineChart'

export const NetworkSection = memo(function NetworkSection() {
  const [recvHistory, sentHistory] = useStore((s) => s.netHistory, shallow)

  const datasets = [
    { label: 'Recv', color: '#3ddc84', data: recvHistory },
    { label: 'Sent', color: '#f87171', data: sentHistory },
  ]

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">Network</CardTitle>
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span><span className="text-accent-green">—</span> Recv</span>
          <span><span className="text-accent-red">—</span> Sent</span>
        </div>
      </div>
      <div className="h-36">
        <RollingLineChart datasets={datasets} />
      </div>
    </Card>
  )
})
