import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import type { Theme, Language } from '@/store'

const FONT_SIZES = [
  { label: 'XS', value: 12 },
  { label: 'S',  value: 13 },
  { label: 'M',  value: 14 },
  { label: 'L',  value: 15 },
  { label: 'XL', value: 16 },
  { label: 'XXL', value: 18 },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()

  const theme           = useStore((s) => s.theme)
  const language        = useStore((s) => s.language)
  const defaultScanPath = useStore((s) => s.defaultScanPath)
  const fontSize        = useStore((s) => s.fontSize)
  const setTheme        = useStore((s) => s.setTheme)
  const setLanguage     = useStore((s) => s.setLanguage)
  const setDefaultScanPath = useStore((s) => s.setDefaultScanPath)
  const setFontSize     = useStore((s) => s.setFontSize)
  const isFrozen        = useStore((s) => s.isFrozen)
  const updateIntervalMs = useStore((s) => s.updateIntervalMs)
  const ncduCacheTtlSec = useStore((s) => s.ncduCacheTtlSec)
  const setFrozen       = useStore((s) => s.setFrozen)
  const setUpdateIntervalMs = useStore((s) => s.setUpdateIntervalMs)
  const setNcduCacheTtlSec = useStore((s) => s.setNcduCacheTtlSec)

  const [pathInput, setPathInput] = useState(defaultScanPath)
  const [saved, setSaved]         = useState(false)
  const [intervalInput, setIntervalInput] = useState(String(updateIntervalMs))
  const [intervalState, setIntervalState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [cacheTtlInput, setCacheTtlInput] = useState(String(ncduCacheTtlSec))
  const [cacheTtlState, setCacheTtlState] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    setIntervalInput(String(updateIntervalMs))
  }, [updateIntervalMs])

  useEffect(() => {
    setCacheTtlInput(String(ncduCacheTtlSec))
  }, [ncduCacheTtlSec])

  function handleSavePath() {
    setDefaultScanPath(pathInput.trim() || '/')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleSaveInterval() {
    const parsed = Number(intervalInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setIntervalState('error')
      return
    }

    const next = Math.max(250, Math.min(60000, Math.round(parsed)))
    const prev = updateIntervalMs
    setUpdateIntervalMs(next)
    setIntervalInput(String(next))

    try {
      const res = await fetch('/api/interval', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval_ms: next }),
      })
      if (!res.ok) throw new Error('failed to save interval')
      setIntervalState('saved')
      setTimeout(() => setIntervalState('idle'), 1500)
    } catch (err) {
      console.error('Failed to update interval:', err)
      setUpdateIntervalMs(prev)
      setIntervalInput(String(prev))
      setIntervalState('error')
    }
  }

  async function handleSaveCacheTtl() {
    const parsed = Number(cacheTtlInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCacheTtlState('error')
      return
    }

    const next = Math.max(1, Math.min(3600, Math.round(parsed)))
    const prev = ncduCacheTtlSec
    setNcduCacheTtlSec(next)
    setCacheTtlInput(String(next))

    try {
      const res = await fetch('/api/ncdu/cache', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cache_ttl_sec: next }),
      })
      if (!res.ok) throw new Error('failed to save ncdu cache ttl')
      setCacheTtlState('saved')
      setTimeout(() => setCacheTtlState('idle'), 1500)
    } catch (err) {
      console.error('Failed to update ncdu cache ttl:', err)
      setNcduCacheTtlSec(prev)
      setCacheTtlInput(String(prev))
      setCacheTtlState('error')
    }
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

        {/* Font size */}
        <div className="flex items-center justify-between py-3 border-t border-border-base">
          <div>
            <p className="text-sm font-medium text-text-primary">{t('settings.fontSize')}</p>
            <p className="text-xs text-text-secondary mt-0.5">{t('settings.fontSizeHint')}</p>
          </div>
          <div className="flex items-center gap-1">
            {FONT_SIZES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setFontSize(value)}
                className={`px-2.5 py-1.5 text-xs font-mono rounded-base transition-colors ${
                  fontSize === value
                    ? 'bg-accent-blue text-bg-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border border-border-base'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Data updates */}
      <Card>
        <CardTitle>{t('settings.dataUpdates')}</CardTitle>

        <div className="flex items-center justify-between py-3 border-b border-border-base">
          <div>
            <p className="text-sm font-medium text-text-primary">{t('settings.freeze')}</p>
            <p className="text-xs text-text-secondary mt-0.5">{t('settings.freezeHint')}</p>
          </div>
          <Button variant={isFrozen ? 'danger' : 'ghost'} onClick={() => setFrozen(!isFrozen)}>
            {isFrozen ? t('settings.resume') : t('settings.freeze')}
          </Button>
        </div>

        <div className="py-3">
          <label className="block text-sm font-medium text-text-primary mb-1">
            {t('settings.updateIntervalMs')}
          </label>
          <p className="text-xs text-text-secondary mb-3">{t('settings.updateIntervalHint')}</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={250}
              max={60000}
              step={250}
              value={intervalInput}
              onChange={(e) => { setIntervalInput(e.target.value); setIntervalState('idle') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveInterval()}
              className="w-40 bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
            <Button variant="primary" onClick={handleSaveInterval}>
              {intervalState === 'saved' ? t('settings.saved') : t('settings.apply')}
            </Button>
            {intervalState === 'error' && (
              <span className="text-xs text-accent-red">{t('settings.invalidInterval')}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Storage Analyzer */}
      <Card>
        <CardTitle>{t('settings.storageAnalyzer')}</CardTitle>

        <div className="py-3 border-b border-border-base">
          <label className="block text-sm font-medium text-text-primary mb-1">
            {t('settings.ncduCacheTtlSec')}
          </label>
          <p className="text-xs text-text-secondary mb-3">{t('settings.ncduCacheTtlHint')}</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={3600}
              step={1}
              value={cacheTtlInput}
              onChange={(e) => { setCacheTtlInput(e.target.value); setCacheTtlState('idle') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCacheTtl()}
              className="w-40 bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
            <Button variant="primary" onClick={handleSaveCacheTtl}>
              {cacheTtlState === 'saved' ? t('settings.saved') : t('settings.apply')}
            </Button>
            {cacheTtlState === 'error' && (
              <span className="text-xs text-accent-red">{t('settings.invalidCacheTtl')}</span>
            )}
          </div>
        </div>

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
