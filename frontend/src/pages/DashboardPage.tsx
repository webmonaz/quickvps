import { CpuCard }          from '@/components/metrics/CpuCard'
import { MemorySwapCard }   from '@/components/metrics/MemorySwapCard'
import { ServerInfoCard }   from '@/components/metrics/ServerInfoCard'
import { NetworkSection }   from '@/components/metrics/NetworkSection'
import { DiskIOSection }    from '@/components/metrics/DiskIOSection'
import { NetworkTable }     from '@/components/metrics/NetworkTable'
import { DiskSection }      from '@/components/metrics/DiskSection'

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      {/* Row 1: CPU | Memory & Swap | Server Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CpuCard />
        <MemorySwapCard />
        <ServerInfoCard />
      </div>

      {/* Row 2: Network | Disk I/O | Network Interfaces */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NetworkSection />
        <DiskIOSection />
        <NetworkTable />
      </div>

      {/* Row 3: System Storage */}
      <DiskSection />
    </div>
  )
}
