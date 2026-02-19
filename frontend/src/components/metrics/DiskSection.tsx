import { memo } from 'react'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { DiskCard } from './DiskCard'
import type { DiskMetrics, DiskIOMetrics } from '@/types/metrics'

export const DiskSection = memo(function DiskSection() {
  const disks  = useStore((s) => s.snapshot?.disks  ?? [], shallow)
  const diskIO = useStore((s) => s.snapshot?.disk_io ?? [], shallow)

  function findIO(disk: DiskMetrics): DiskIOMetrics | undefined {
    const shortDev = disk.device.split('/').pop() ?? ''
    return diskIO.find(
      (x) => x.device === shortDev || disk.device.includes(x.device),
    )
  }

  if (disks.length === 0) return (
    <div>
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Storage
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-bg-card border border-border-base rounded-card" />
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Storage
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {disks.map((disk) => (
          <DiskCard key={disk.mountpoint} disk={disk} io={findIO(disk)} />
        ))}
      </div>
    </div>
  )
})
