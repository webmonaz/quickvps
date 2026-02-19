import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { StatusDot } from '@/components/ui/StatusDot'
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

const NAV_ITEMS = [
  { to: '/',         labelKey: 'nav.dashboard', Icon: IconDashboard, end: true  },
  { to: '/storage',  labelKey: 'nav.storage',   Icon: IconStorage,   end: false },
  { to: '/settings', labelKey: 'nav.settings',  Icon: IconSettings,  end: false },
] as const

export const Sidebar = memo(function Sidebar() {
  const isConnected = useStore((s) => s.isConnected)
  const isFrozen    = useStore((s) => s.isFrozen)
  const serverInfo  = useStore((s) => s.serverInfo)
  const theme       = useStore((s) => s.theme)
  const language    = useStore((s) => s.language)
  const setTheme    = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const { t }       = useTranslation()

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
    </aside>
  )
})
