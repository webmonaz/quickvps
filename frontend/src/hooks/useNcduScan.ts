import { useCallback } from 'react'
import { useStore } from '@/store'
import type { ScanResult } from '@/types/ncdu'

export function useNcduScan() {
  const scanPath     = useStore((s) => s.scanPath)
  const isScanning   = useStore((s) => s.isScanning)
  const setScanResult = useStore((s) => s.setScanResult)
  const setIsScanning = useStore((s) => s.setIsScanning)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/ncdu/status')
      const result = await r.json() as ScanResult
      setScanResult(result)
      if (result.status === 'done' || result.status === 'error') {
        setIsScanning(false)
      }
    } catch (err) {
      console.error('fetchNcdu error:', err)
    }
  }, [setScanResult, setIsScanning])

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
    }
  }, [scanPath, setIsScanning, setScanResult, fetchStatus])

  const cancelScan = useCallback(async () => {
    try {
      await fetch('/api/ncdu/scan', { method: 'DELETE' })
    } catch (err) {
      console.error('Scan cancel error:', err)
    }
    setIsScanning(false)
    setScanResult(null)
  }, [setIsScanning, setScanResult])

  return { startScan, cancelScan, fetchStatus, isScanning, scanPath }
}
