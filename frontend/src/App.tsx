import { useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useServerInfo } from '@/hooks/useServerInfo'
import { useNcduScan } from '@/hooks/useNcduScan'
import DashboardPage from '@/pages/DashboardPage'

function AppRoutes() {
  const { fetchStatus } = useNcduScan()
  const onNcduReady = useCallback(() => { fetchStatus() }, [fetchStatus])

  useWebSocket(onNcduReady)
  useServerInfo()

  return (
    <AppShell>
      <Routes>
        <Route path="/*" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
