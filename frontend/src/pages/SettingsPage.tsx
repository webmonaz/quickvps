import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import type { Theme, Language } from '@/store'

export default function SettingsPage() {
  const { t } = useTranslation()

  const theme           = useStore((s) => s.theme)
  const language        = useStore((s) => s.language)
  const defaultScanPath = useStore((s) => s.defaultScanPath)
  const setTheme        = useStore((s) => s.setTheme)
  const setLanguage     = useStore((s) => s.setLanguage)
  const setDefaultScanPath = useStore((s) => s.setDefaultScanPath)

  const [pathInput, setPathInput] = useState(defaultScanPath)
  const [saved, setSaved]         = useState(false)

  function handleSavePath() {
    setDefaultScanPath(pathInput.trim() || '/')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-lg font-semibold font-mono text-text-primary">{t('settings.title')}</h1>

      {/* Appearance */}
      <Card>
        <CardTitle>{t('settings.appearance')}</CardTitle>

        {/* Theme */}
        <div className="flex items-center justify-between py-3 border-b border-border-base">
          <div>
            <p className="text-sm font-medium text-text-primary">{t('settings.theme')}</p>
          </div>
          <div className="flex items-center gap-1">
            {(['dark', 'light'] as Theme[]).map((t_) => (
              <button
                key={t_}
                onClick={() => setTheme(t_)}
                className={`px-3 py-1.5 text-xs font-mono rounded-base transition-colors ${
                  theme === t_
                    ? 'bg-accent-blue text-bg-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border border-border-base'
                }`}
              >
                {t(`theme.${t_}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-text-primary">{t('settings.language')}</p>
          </div>
          <div className="flex items-center gap-1">
            {(['en', 'vi'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 text-xs font-mono rounded-base transition-colors ${
                  language === lang
                    ? 'bg-accent-blue text-bg-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border border-border-base'
                }`}
              >
                {t(`language.${lang}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Storage Analyzer */}
      <Card>
        <CardTitle>{t('settings.storageAnalyzer')}</CardTitle>

        <div className="py-3">
          <label className="block text-sm font-medium text-text-primary mb-1">
            {t('settings.defaultScanPath')}
          </label>
          <p className="text-xs text-text-secondary mb-3">{t('settings.defaultScanPathHint')}</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => { setPathInput(e.target.value); setSaved(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePath()}
              placeholder="/"
              className="flex-1 bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
            <Button variant="primary" onClick={handleSavePath}>
              {saved ? t('settings.saved') : t('settings.save')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
