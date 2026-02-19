import { memo } from 'react'
import type { ScanResult } from '@/types/ncdu'
import { NcduTreeNode } from './NcduTreeNode'
import { formatBytes } from '@/lib/formatBytes'

interface NcduTreeProps {
  result: ScanResult
}

export const NcduTree = memo(function NcduTree({ result }: NcduTreeProps) {
  if (!result.root) {
    return (
      <p className="text-text-secondary text-sm py-4">No scan data available.</p>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3 text-xs font-mono text-text-secondary">
        <span>
          Path: <strong className="text-accent-blue">{result.path}</strong>
        </span>
        <span>
          Total: <strong className="text-text-primary">{formatBytes(result.total_size)}</strong>
        </span>
        <span>Scanned: {new Date(result.scanned_at).toLocaleString()}</span>
      </div>
      <ul className="space-y-0.5">
        <NcduTreeNode
          entry={result.root}
          parentSize={result.total_size}
          depth={0}
        />
      </ul>
    </div>
  )
})
