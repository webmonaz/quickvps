import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { RollingLineChart } from '@/components/charts/RollingLineChart'

export const DiskIOSection = memo(function DiskIOSection() {
  const [readHistory, writeHistory] = useStore((s) => s.diskIOHistory, shallow)

  const datasets = [
    { label: 'Read',  color: '#4c9ef5', data: readHistory  },
    { label: 'Write', color: '#a78bfa', data: writeHistory },
  ]

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">Disk I/O</CardTitle>
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span><span className="text-accent-blue">—</span> Read</span>
          <span><span className="text-accent-purple">—</span> Write</span>
        </div>
      </div>
      <div className="h-36">
        <RollingLineChart datasets={datasets} />
      </div>
    </Card>
  )
})
