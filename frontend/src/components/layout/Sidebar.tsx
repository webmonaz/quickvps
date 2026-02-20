import { memo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { StatusDot } from '@/components/ui/StatusDot'
import { Button } from '@/components/ui/Button'
import type { Language } from '@/store'

function IconDashboard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function IconStorage() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
      <path d="M3 12A9 3 0 0 0 21 12"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function IconPorts() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M7 9h4"/>
      <path d="M7 13h4"/>
      <circle cx="16" cy="11" r="1"/>
      <circle cx="16" cy="15" r="1"/>
    </svg>
  )
}

function IconAdmin() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 6 6 .9-4.5 4.4L17.5 20 12 17l-5.5 3 1-6.7L3 8.9 9 8z"/>
    </svg>
  )
}

function IconAlerts() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 4.3a2.4 2.4 0 0 1 3.4 0l.6.6a2.4 2.4 0 0 0 1.7.7h.8a2.4 2.4 0 0 1 2.4 2.4v.8a2.4 2.4 0 0 0 .7 1.7l.6.6a2.4 2.4 0 0 1 0 3.4l-.6.6a2.4 2.4 0 0 0-.7 1.7v.8a2.4 2.4 0 0 1-2.4 2.4H16a2.4 2.4 0 0 0-1.7.7l-.6.6a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 0-1.7-.7h-.8a2.4 2.4 0 0 1-2.4-2.4v-.8a2.4 2.4 0 0 0-.7-1.7l-.6-.6a2.4 2.4 0 0 1 0-3.4l.6-.6a2.4 2.4 0 0 0 .7-1.7V8a2.4 2.4 0 0 1 2.4-2.4h.8a2.4 2.4 0 0 0 1.7-.7z"/>
      <path d="M12 8v4"/>
      <path d="M12 16h.01"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6z"/>
    </svg>
  )
}

function IconPackage() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-5 9 5-9 5z"/>
      <path d="M3 8v8l9 5 9-5V8"/>
      <path d="M12 13v8"/>
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/',         labelKey: 'nav.dashboard', Icon: IconDashboard, end: true  },
  { to: '/storage',  labelKey: 'nav.storage',   Icon: IconStorage,   end: false },
  { to: '/ports',    labelKey: 'nav.ports',     Icon: IconPorts,     end: false },
  { to: '/alerts',   labelKey: 'nav.alerts',    Icon: IconAlerts,    end: false },
  { to: '/firewall', labelKey: 'nav.firewall',  Icon: IconShield,    end: false },
  { to: '/packages', labelKey: 'nav.packages',  Icon: IconPackage,   end: false },
  { to: '/settings', labelKey: 'nav.settings',  Icon: IconSettings,  end: false },
] as const

export const Sidebar = memo(function Sidebar() {
  const navigate = useNavigate()
  const isConnected = useStore((s) => s.isConnected)
  const isFrozen    = useStore((s) => s.isFrozen)
  const serverInfo  = useStore((s) => s.serverInfo)
  const theme       = useStore((s) => s.theme)
  const language    = useStore((s) => s.language)
  const setTheme    = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const authUser = useStore((s) => s.authUser)
  const setAuthUser = useStore((s) => s.setAuthUser)
  const { t }       = useTranslation()
  const publicMode = authUser?.id === 0

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // no-op
    }
    setAuthUser(null)
    navigate('/login', { replace: true })
  }

  return (
    <aside className="w-52 shrink-0 flex flex-col h-screen sticky top-0 bg-bg-card border-r border-border-base z-30">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border-base">
        <div className="font-mono font-bold text-base tracking-tight">
          <span className="text-accent-blue">Quick</span><span className="text-accent-green">VPS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(({ to, labelKey, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-base text-xs font-mono transition-colors ${
                isActive
                  ? 'bg-accent-blue text-bg-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
              }`
            }
          >
            <Icon />
            {t(labelKey)}
          </NavLink>
        ))}

        {authUser?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-base text-xs font-mono transition-colors ${
                isActive
                  ? 'bg-accent-blue text-bg-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
              }`
            }
          >
            <IconAdmin />
            {t('nav.admin')}
          </NavLink>
        )}
      </nav>

      {/* Server status */}
      <div className="px-4 py-3 border-t border-border-base space-y-1.5 text-xs font-mono text-text-secondary">
        <div className="flex items-center gap-1.5">
          <StatusDot connected={isConnected} />
          <span>{t('header.live')}</span>
          {isFrozen && (
            <span className="px-1.5 py-0.5 rounded bg-accent-yellow text-bg-primary text-[10px] font-semibold">
              {t('header.frozen')}
            </span>
          )}
        </div>
        <div>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${serverInfo?.auth_enabled ? 'bg-accent-blue text-bg-primary' : 'bg-accent-yellow text-bg-primary'}`}>
            {serverInfo?.auth_enabled ? t('mode.authEnabled') : t('mode.public')}
          </span>
        </div>
        {serverInfo?.hostname && (
          <div className="flex items-center gap-1.5 truncate">
            <span>🖥</span>
            <span className="truncate">{serverInfo.hostname}</span>
          </div>
        )}
        {serverInfo?.os && (
          <div className="flex items-center gap-1.5 truncate">
            <span>⚙</span>
            <span className="truncate">{serverInfo.os}</span>
          </div>
        )}
      </div>

      {/* Controls: language + theme */}
      <div className="px-4 py-3 border-t border-border-base flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs font-mono">
          {(['en', 'vi'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-2 py-1 rounded transition-colors ${
                language === lang
                  ? 'bg-accent-blue text-bg-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t(`language.${lang}`)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          className="w-7 h-7 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>

      {!publicMode && (
        <div className="px-4 pb-4">
          <Button variant="ghost" className="w-full justify-center" onClick={handleLogout}>
            {t('auth.logout')}
          </Button>
        </div>
      )}
    </aside>
  )
})
