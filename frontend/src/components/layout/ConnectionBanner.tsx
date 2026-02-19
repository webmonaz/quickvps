import { memo } from 'react'
import { useStore } from '@/store'

export const ConnectionBanner = memo(function ConnectionBanner() {
  const isConnected = useStore((s) => s.isConnected)
  if (isConnected) return null
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-accent-red text-bg-primary text-center text-xs py-2 font-mono font-medium">
      WebSocket disconnected — reconnecting…
    </div>
  )
})
