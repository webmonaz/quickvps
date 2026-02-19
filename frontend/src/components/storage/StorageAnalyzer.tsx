import { memo } from 'react'
import { useStore } from '@/store'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { ScanControls } from './ScanControls'
import { NcduTree } from './NcduTree'

export const StorageAnalyzer = memo(function StorageAnalyzer() {
  const scanResult = useStore((s) => s.scanResult)

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <CardTitle className="mb-0">Storage Analyzer (ncdu)</CardTitle>
        <ScanControls />
      </div>
      {scanResult?.status === 'done' && scanResult.root && (
        <NcduTree result={scanResult} />
      )}
    </Card>
  )
})
