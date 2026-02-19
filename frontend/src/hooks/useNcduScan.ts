import { useCallback, useRef } from 'react'
import { useStore } from '@/store'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/useToast'
import type { ScanResult } from '@/types/ncdu'

export function useNcduScan() {
  const { t } = useTranslation()
  const { showError, showInfo } = useToast()
  const scanPath     = useStore((s) => s.scanPath)
  const isScanning   = useStore((s) => s.isScanning)
  const setScanResult = useStore((s) => s.setScanResult)
  const setIsScanning = useStore((s) => s.setIsScanning)
  const statusErrorNotifiedRef = useRef(false)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/ncdu/status')
      const result = await r.json() as ScanResult
      setScanResult(result)
      statusErrorNotifiedRef.current = false
      if (result.status === 'done' || result.status === 'error') {
        setIsScanning(false)
      }
    } catch (err) {
      console.error('fetchNcdu error:', err)
      if (!statusErrorNotifiedRef.current) {
        showError(t('storage.fetchStatusError'))
        statusErrorNotifiedRef.current = true
      }
    }
  }, [setScanResult, setIsScanning, showError, t])

  const startScan = useCallback(async () => {
    setIsScanning(true)
    setScanResult(null)
    try {
      const r = await fetch('/api/ncdu/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: scanPath }),
      })
      if (!r.ok) {
        throw new Error('failed to start scan')
      }
      const payload = await r.json() as { status?: string }
      if (payload.status === 'cached' || payload.status === 'running') {
        await fetchStatus()
      }
    } catch (err) {
      console.error('Scan start error:', err)
      setIsScanning(false)
      showError(t('storage.scanStartError'))
    }
  }, [scanPath, setIsScanning, setScanResult, fetchStatus, showError, t])

  const cancelScan = useCallback(async () => {
    try {
      await fetch('/api/ncdu/scan', { method: 'DELETE' })
    } catch (err) {
      console.error('Scan cancel error:', err)
      showError(t('storage.scanCancelError'))
    }
    setIsScanning(false)
    setScanResult(null)
    showInfo(t('storage.scanCancelled'))
  }, [setIsScanning, setScanResult, showError, showInfo, t])

  return { startScan, cancelScan, fetchStatus, isScanning, scanPath }
}
