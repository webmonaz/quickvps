import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useNcduScan } from '@/hooks/useNcduScan'

export const ScanControls = memo(function ScanControls() {
  const scanPath     = useStore((s) => s.scanPath)
  const setScanPath  = useStore((s) => s.setScanPath)
  const scanResult   = useStore((s) => s.scanResult)
  const { startScan, cancelScan, isScanning } = useNcduScan()
  const { t } = useTranslation()

  const statusText = (() => {
    if (!scanResult) return ''
    if (scanResult.status === 'done')    return t('storage.scanComplete')
    if (scanResult.status === 'error')   return `${t('storage.error')}: ` + scanResult.error
    if (scanResult.status === 'running') return `${t('storage.scanning')} ${scanResult.path}…`
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
        placeholder={t('storage.pathPlaceholder')}
        className="bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
      />
      <Button
        variant="primary"
        onClick={startScan}
        disabled={isScanning}
      >
        {t('storage.scan')}
      </Button>
      {isScanning && (
        <Button variant="danger" onClick={cancelScan}>
          {t('storage.cancel')}
        </Button>
      )}
    </div>
  )
})
