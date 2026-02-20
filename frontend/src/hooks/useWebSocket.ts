import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { WS_RECONNECT_DELAY } from '@/constants/ws'
import { shouldFetchNcduStatus } from '@/lib/ncduReady'
import type { WSMessage } from '@/types/api'

export function useWebSocket(onNcduReady: () => void) {
  const setSnapshot  = useStore((s) => s.setSnapshot)
  const setConnected = useStore((s) => s.setConnected)
  const isFrozen = useStore((s) => s.isFrozen)
  const isScanning = useStore((s) => s.isScanning)
  const updateIntervalMs = useStore((s) => s.updateIntervalMs)
  const wsRef        = useRef<WebSocket | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onNcduRef    = useRef(onNcduReady)
  const frozenRef    = useRef(isFrozen)
  const scanningRef  = useRef(isScanning)
  const prevReadyRef = useRef(false)
  const prevScanningRef = useRef(false)
  const intervalRef  = useRef(updateIntervalMs)
  const lastUpdateRef = useRef(0)
  onNcduRef.current  = onNcduReady

  useEffect(() => {
    frozenRef.current = isFrozen
    if (!isFrozen) {
      lastUpdateRef.current = 0
    }
  }, [isFrozen])

  useEffect(() => {
    intervalRef.current = updateIntervalMs
  }, [updateIntervalMs])

  useEffect(() => {
    scanningRef.current = isScanning
  }, [isScanning])

  const connect = useCallback(() => {
    prevReadyRef.current = false
    prevScanningRef.current = scanningRef.current
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws    = new WebSocket(`${proto}//${location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data) as WSMessage
        if (msg.type === 'metrics' && msg.snapshot) {
          if (frozenRef.current) {
            return
          }
          const now = Date.now()
          if (now-lastUpdateRef.current < intervalRef.current) {
            return
          }
          lastUpdateRef.current = now
          setSnapshot(msg.snapshot)
        }

        const ready = msg.ncdu_ready === true
        if (shouldFetchNcduStatus(prevReadyRef.current, ready, prevScanningRef.current, scanningRef.current)) {
          onNcduRef.current()
        }
        prevReadyRef.current = ready
        prevScanningRef.current = scanningRef.current
      } catch (err) {
        console.error('WS parse error:', err)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      timerRef.current = setTimeout(connect, WS_RECONNECT_DELAY)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [setConnected, setSnapshot])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [connect])
}
