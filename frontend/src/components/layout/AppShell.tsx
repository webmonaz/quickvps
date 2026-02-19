import { memo } from 'react'
import { Header } from './Header'
import { ConnectionBanner } from './ConnectionBanner'

interface AppShellProps {
  children: React.ReactNode
}

export const AppShell = memo(function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-bg-primary text-text-primary">
      <Header />
      <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full">
        {children}
      </main>
      <ConnectionBanner />
    </div>
  )
})
