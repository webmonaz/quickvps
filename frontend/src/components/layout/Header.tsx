import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { StatusDot } from '@/components/ui/StatusDot'
import type { Language } from '@/store'

export const Header = memo(function Header() {
  const isConnected = useStore((s) => s.isConnected)
  const serverInfo  = useStore((s) => s.serverInfo)
  const theme       = useStore((s) => s.theme)
  const language    = useStore((s) => s.language)
  const setTheme    = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const { t }       = useTranslation()

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  function switchLanguage(lang: Language) {
    setLanguage(lang)
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-bg-card border-b border-border-base">
      <div className="flex items-center gap-4">
        <div className="font-mono font-bold text-lg tracking-tight text-accent-blue">
          Quick<span className="text-accent-green">VPS</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-secondary font-mono">
          <div className="flex items-center gap-1.5">
            <StatusDot connected={isConnected} />
            <span>{t('header.live')}</span>
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

      {/* Controls: language switcher + theme toggle */}
      <div className="flex items-center gap-3">
        {/* Language switcher */}
        <div className="flex items-center gap-1 text-xs font-mono">
          {(['en', 'vi'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => switchLanguage(lang)}
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

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
        >
          {theme === 'dark' ? (
            /* Sun icon */
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
            /* Moon icon */
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>
    </header>
  )
})
