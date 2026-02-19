import { memo } from 'react'
import { useStore } from '@/store'
import { StatusDot } from '@/components/ui/StatusDot'

export const Header = memo(function Header() {
  const isConnected = useStore((s) => s.isConnected)
  const serverInfo  = useStore((s) => s.serverInfo)

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-bg-card border-b border-border-base">
      <div className="flex items-center gap-4">
        <div className="font-mono font-bold text-lg tracking-tight text-accent-blue">
          Quick<span className="text-accent-green">VPS</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-secondary font-mono">
          <div className="flex items-center gap-1.5">
            <StatusDot connected={isConnected} />
            <span>Live</span>
          </div>
          {serverInfo?.hostname && (
            <div className="flex items-center gap-1">
              <span>🖥</span>
              <span>{serverInfo.hostname}</span>
            </div>
          )}
          {serverInfo?.os && (
            <div className="flex items-center gap-1">
              <span>⚙</span>
              <span>{serverInfo.os}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
})
