import { memo } from 'react'
import { useStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useNcduScan } from '@/hooks/useNcduScan'

export const ScanControls = memo(function ScanControls() {
  const scanPath     = useStore((s) => s.scanPath)
  const setScanPath  = useStore((s) => s.setScanPath)
  const scanResult   = useStore((s) => s.scanResult)
  const { startScan, cancelScan, isScanning } = useNcduScan()

  const statusText = (() => {
    if (!scanResult) return ''
    if (scanResult.status === 'done')    return 'Scan complete'
    if (scanResult.status === 'error')   return 'Error: ' + scanResult.error
    if (scanResult.status === 'running') return 'Scanning ' + scanResult.path + '…'
    return ''
  })()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
        {isScanning && <Spinner />}
        {statusText && <span>{statusText}</span>}
      </div>
      <input
        type="text"
        value={scanPath}
        onChange={(e) => setScanPath(e.target.value)}
        placeholder="Path to scan"
        className="bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
      />
      <Button
        variant="primary"
        onClick={startScan}
        disabled={isScanning}
      >
        Scan
      </Button>
      {isScanning && (
        <Button variant="danger" onClick={cancelScan}>
          Cancel
        </Button>
      )}
    </div>
  )
})
