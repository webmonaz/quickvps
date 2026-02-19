import { useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppShell } from '@/components/layout/AppShell'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useServerInfo } from '@/hooks/useServerInfo'
import { useNcduScan } from '@/hooks/useNcduScan'
import { useStore } from '@/store'
import DashboardPage from '@/pages/DashboardPage'

function AppRoutes() {
  const { fetchStatus } = useNcduScan()
  const onNcduReady = useCallback(() => { fetchStatus() }, [fetchStatus])
  const theme = useStore((s) => s.theme)
  const language = useStore((s) => s.language)
  const { i18n } = useTranslation()

  // Apply persisted theme class on mount and changes
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  // Sync i18n language with store
  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language, i18n])

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
