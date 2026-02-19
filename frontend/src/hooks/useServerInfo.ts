import { useEffect } from 'react'
import { useStore } from '@/store'
import type { ServerInfo } from '@/types/api'

export function useServerInfo() {
  const setServerInfo = useStore((s) => s.setServerInfo)
  const setUpdateIntervalMs = useStore((s) => s.setUpdateIntervalMs)
  const setNcduCacheTtlSec = useStore((s) => s.setNcduCacheTtlSec)

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json() as Promise<ServerInfo>)
      .then((info) => {
        setServerInfo(info)
        if (typeof info.interval_ms === 'number' && info.interval_ms > 0) {
          setUpdateIntervalMs(info.interval_ms)
        }
        if (typeof info.ncdu_cache_ttl_sec === 'number' && info.ncdu_cache_ttl_sec > 0) {
          setNcduCacheTtlSec(info.ncdu_cache_ttl_sec)
        } else if (typeof info.ncdu_cache_ttl_ms === 'number' && info.ncdu_cache_ttl_ms > 0) {
          setNcduCacheTtlSec(Math.round(info.ncdu_cache_ttl_ms / 1000))
        }
      })
      .catch((err) => console.error('Failed to load server info:', err))
  }, [setServerInfo, setUpdateIntervalMs, setNcduCacheTtlSec])
}
