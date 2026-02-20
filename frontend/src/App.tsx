import { useCallback, useEffect } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppShell } from '@/components/layout/AppShell'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useServerInfo } from '@/hooks/useServerInfo'
import { useNcduScan } from '@/hooks/useNcduScan'
import { useAuthSession } from '@/hooks/useAuthSession'
import { useStore } from '@/store'
import { Spinner } from '@/components/ui/Spinner'
import DashboardPage from '@/pages/DashboardPage'
import StoragePage from '@/pages/StoragePage'
import SettingsPage from '@/pages/SettingsPage'
import PortsPage from '@/pages/PortsPage'
import AlertsPage from '@/pages/AlertsPage'
import FirewallPage from '@/pages/FirewallPage'
import PackagesPage from '@/pages/PackagesPage'
import LoginPage from '@/pages/LoginPage'
import AdminPage from '@/pages/AdminPage'

function AuthenticatedRoutes() {
  const { fetchStatus } = useNcduScan()
  const onNcduReady = useCallback(() => { fetchStatus() }, [fetchStatus])

  useWebSocket(onNcduReady)
  useServerInfo()

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/ports" element={<PortsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/firewall" element={<FirewallPage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  )
}

function AppRoutes() {
  const theme = useStore((s) => s.theme)
  const language = useStore((s) => s.language)
  const fontSize = useStore((s) => s.fontSize)
  const authUser = useStore((s) => s.authUser)
  const authLoading = useStore((s) => s.authLoading)
  const { i18n } = useTranslation()

  useAuthSession()

  // Apply persisted theme class on mount and changes
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  // Apply persisted font size on mount and changes
  useEffect(() => {
    document.documentElement.style.fontSize = fontSize + 'px'
  }, [fontSize])

  // Sync i18n language with store
  useEffect(() => {
    i18n.changeLanguage(language)
  }, [language, i18n])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  if (!authUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return <AuthenticatedRoutes />
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
