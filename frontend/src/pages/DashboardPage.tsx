import { CpuSection }      from '@/components/metrics/CpuSection'
import { MemorySection }   from '@/components/metrics/MemorySection'
import { SwapSection }     from '@/components/metrics/SwapSection'
import { NetworkSection }  from '@/components/metrics/NetworkSection'
import { DiskIOSection }   from '@/components/metrics/DiskIOSection'
import { NetworkTable }    from '@/components/metrics/NetworkTable'
import { DiskSection }     from '@/components/metrics/DiskSection'
import { StorageAnalyzer } from '@/components/storage/StorageAnalyzer'

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      {/* Row 1: CPU + Memory + Swap gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CpuSection />
        <MemorySection />
        <SwapSection />
      </div>

      {/* Row 2: Network + Disk I/O charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NetworkSection />
        <DiskIOSection />
      </div>

      {/* Row 3: Network interfaces table */}
      <NetworkTable />

      {/* Row 4: Disk cards */}
      <DiskSection />

      {/* Row 5: Storage Analyzer */}
      <StorageAnalyzer />
    </div>
  )
}
