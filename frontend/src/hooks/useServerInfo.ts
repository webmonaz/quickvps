import { useEffect } from 'react'
import { useStore } from '@/store'
import type { ServerInfo } from '@/types/api'

export function useServerInfo() {
  const setServerInfo = useStore((s) => s.setServerInfo)

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json() as Promise<ServerInfo>)
      .then(setServerInfo)
      .catch((err) => console.error('Failed to load server info:', err))
  }, [setServerInfo])
}
