import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CpuSection }      from '@/components/metrics/CpuSection'
import { MemorySection }   from '@/components/metrics/MemorySection'
import { SwapSection }     from '@/components/metrics/SwapSection'
import { NetworkSection }  from '@/components/metrics/NetworkSection'
import { DiskIOSection }   from '@/components/metrics/DiskIOSection'
import { NetworkTable }    from '@/components/metrics/NetworkTable'
import { DiskSection }     from '@/components/metrics/DiskSection'

export default function DashboardPage() {
  const { t } = useTranslation()
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

      {/* Row 5: Link to Storage Analyzer */}
      <Link
        to="/storage"
        className="flex items-center justify-between w-full bg-bg-card border border-border-base rounded-card p-4 text-sm font-mono text-text-secondary hover:text-text-primary hover:border-accent-blue transition-colors group"
      >
        <span className="font-semibold text-text-primary">{t('storage.title')}</span>
        <span className="text-accent-blue group-hover:translate-x-0.5 transition-transform">{t('nav.storage')} →</span>
      </Link>
    </div>
  )
}
