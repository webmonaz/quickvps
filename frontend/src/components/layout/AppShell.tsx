import { memo } from 'react'
import { Sidebar } from './Sidebar'
import { ConnectionBanner } from './ConnectionBanner'
import { FloatingFreezeButton } from './FloatingFreezeButton'

interface AppShellProps {
  children: React.ReactNode
}

export const AppShell = memo(function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex bg-bg-primary text-text-primary">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 min-h-screen">
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
      <FloatingFreezeButton />
      <ConnectionBanner />
    </div>
  )
})
