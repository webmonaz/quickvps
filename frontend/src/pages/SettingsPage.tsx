import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { canManageAlerts, normalizeRetryDelays, parseCommaList } from '@/lib/alerts'
import type { Theme, Language } from '@/store'
import type { AlertConfig } from '@/types/alerts'

const FONT_SIZES = [
  { label: 'XS', value: 12 },
  { label: 'S', value: 13 },
  { label: 'M', value: 14 },
  { label: 'L', value: 15 },
  { label: 'XL', value: 16 },
  { label: 'XXL', value: 18 },
] as const

export default function SettingsPage() {
  const { t } = useTranslation()
  const { showSuccess, showError } = useToast()

  const theme = useStore((s) => s.theme)
  const language = useStore((s) => s.language)
  const defaultScanPath = useStore((s) => s.defaultScanPath)
  const fontSize = useStore((s) => s.fontSize)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const setDefaultScanPath = useStore((s) => s.setDefaultScanPath)
  const setFontSize = useStore((s) => s.setFontSize)
  const serverInfo = useStore((s) => s.serverInfo)
  const authUser = useStore((s) => s.authUser)
  const isFrozen = useStore((s) => s.isFrozen)
  const updateIntervalMs = useStore((s) => s.updateIntervalMs)
  const ncduCacheTtlSec = useStore((s) => s.ncduCacheTtlSec)
  const setFrozen = useStore((s) => s.setFrozen)
  const setUpdateIntervalMs = useStore((s) => s.setUpdateIntervalMs)
  const setNcduCacheTtlSec = useStore((s) => s.setNcduCacheTtlSec)

  const [pathInput, setPathInput] = useState(defaultScanPath)
  const [saved, setSaved] = useState(false)
  const [intervalInput, setIntervalInput] = useState(String(updateIntervalMs))
  const [intervalState, setIntervalState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [cacheTtlInput, setCacheTtlInput] = useState(String(ncduCacheTtlSec))
  const [cacheTtlState, setCacheTtlState] = useState<'idle' | 'saved' | 'error'>('idle')

  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null)
  const [alertLoading, setAlertLoading] = useState(true)
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [warningPct, setWarningPct] = useState('75')
  const [warningForSec, setWarningForSec] = useState('300')
  const [criticalPct, setCriticalPct] = useState('85')
  const [criticalForSec, setCriticalForSec] = useState('600')
  const [recoveryPct, setRecoveryPct] = useState('70')
  const [recoveryForSec, setRecoveryForSec] = useState('300')
  const [cooldownSec, setCooldownSec] = useState('1800')
  const [telegramEnabled, setTelegramEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [emailsInput, setEmailsInput] = useState('')
  const [chatIDsInput, setChatIDsInput] = useState('')
  const [retryDelaysInput, setRetryDelaysInput] = useState('1,5,15')
  const [telegramTokenInput, setTelegramTokenInput] = useState('')
  const [gmailAddressInput, setGmailAddressInput] = useState('')
  const [gmailPasswordInput, setGmailPasswordInput] = useState('')
  const [rotateTelegramSecret, setRotateTelegramSecret] = useState(false)
  const [rotateGmailSecret, setRotateGmailSecret] = useState(false)
  const [clearTelegramSecret, setClearTelegramSecret] = useState(false)
  const [clearGmailSecret, setClearGmailSecret] = useState(false)
  const [silenceMinutes, setSilenceMinutes] = useState('30')

  const manageAlerts = useMemo(() => canManageAlerts(authUser, serverInfo), [authUser, serverInfo])

  useEffect(() => {
    setIntervalInput(String(updateIntervalMs))
  }, [updateIntervalMs])

  useEffect(() => {
    setCacheTtlInput(String(ncduCacheTtlSec))
  }, [ncduCacheTtlSec])

  const loadAlertConfig = useCallback(() => {
    let cancelled = false
    setAlertLoading(true)

    fetch('/api/alerts/config')
      .then(async (res) => {
        if (!res.ok) throw new Error('failed to load alerts config')
        return res.json() as Promise<AlertConfig>
      })
      .then((cfg) => {
        if (cancelled) return
        setAlertConfig(cfg)
        setAlertEnabled(cfg.enabled)
        setWarningPct(String(cfg.warning_percent))
        setWarningForSec(String(cfg.warning_for_sec))
        setCriticalPct(String(cfg.critical_percent))
        setCriticalForSec(String(cfg.critical_for_sec))
        setRecoveryPct(String(cfg.recovery_percent))
        setRecoveryForSec(String(cfg.recovery_for_sec))
        setCooldownSec(String(cfg.cooldown_sec))
        setTelegramEnabled(cfg.telegram_enabled)
        setEmailEnabled(cfg.email_enabled)
        setEmailsInput(cfg.recipient_emails.join(', '))
        setChatIDsInput(cfg.telegram_chat_ids.join(', '))
        setRetryDelaysInput(cfg.retry_delays_sec.join(','))
        setGmailAddressInput(cfg.gmail_address ?? '')
        setRotateTelegramSecret(false)
        setRotateGmailSecret(false)
        setClearTelegramSecret(false)
        setClearGmailSecret(false)
        setTelegramTokenInput('')
        setGmailPasswordInput('')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load alerts config:', err)
        showError('Failed to load alerts config')
      })
      .finally(() => {
        if (!cancelled) {
          setAlertLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [showError])

  useEffect(() => {
    const cleanup = loadAlertConfig()
    return cleanup
  }, [loadAlertConfig])

  function handleSavePath() {
    setDefaultScanPath(pathInput.trim() || '/')
    setSaved(true)
    showSuccess(t('settings.defaultScanPathSaved'))
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleSaveInterval() {
    const parsed = Number(intervalInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showError(t('settings.invalidInterval'))
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
      showSuccess(t('settings.updateIntervalSaved'))
      setTimeout(() => setIntervalState('idle'), 1500)
    } catch (err) {
      console.error('Failed to update interval:', err)
      setUpdateIntervalMs(prev)
      setIntervalInput(String(prev))
      setIntervalState('error')
      showError(t('settings.updateIntervalFailed'))
    }
  }

  async function handleSaveCacheTtl() {
    const parsed = Number(cacheTtlInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showError(t('settings.invalidCacheTtl'))
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
      showSuccess(t('settings.ncduCacheTtlSaved'))
      setTimeout(() => setCacheTtlState('idle'), 1500)
    } catch (err) {
      console.error('Failed to update ncdu cache ttl:', err)
      setNcduCacheTtlSec(prev)
      setCacheTtlInput(String(prev))
      setCacheTtlState('error')
      showError(t('settings.ncduCacheTtlFailed'))
    }
  }

  async function handleSaveAlerts() {
    if (!manageAlerts) {
      showError(t('settings.alertsReadOnly'))
      return
    }

    const payload = {
      enabled: alertEnabled,
      warning_percent: Number(warningPct),
      warning_for_sec: Number(warningForSec),
      critical_percent: Number(criticalPct),
      critical_for_sec: Number(criticalForSec),
      recovery_percent: Number(recoveryPct),
      recovery_for_sec: Number(recoveryForSec),
      cooldown_sec: Number(cooldownSec),
      telegram_enabled: telegramEnabled,
      email_enabled: emailEnabled,
      recipient_emails: parseCommaList(emailsInput),
      telegram_chat_ids: parseCommaList(chatIDsInput),
      retry_delays_sec: normalizeRetryDelays(retryDelaysInput),
      telegram_bot_token: rotateTelegramSecret ? telegramTokenInput.trim() : '',
      clear_telegram_bot_token: clearTelegramSecret,
      gmail_address: gmailAddressInput.trim(),
      gmail_app_password: rotateGmailSecret ? gmailPasswordInput.trim() : '',
      clear_gmail_app_password: clearGmailSecret,
    }

    setAlertSaving(true)
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(body.error || 'failed to save alerts config')
      }

      const cfg = await res.json() as AlertConfig
      setAlertConfig(cfg)
      setRotateTelegramSecret(false)
      setRotateGmailSecret(false)
      setClearTelegramSecret(false)
      setClearGmailSecret(false)
      setTelegramTokenInput('')
      setGmailPasswordInput('')
      showSuccess(t('settings.alertsSaved'))
    } catch (err) {
      console.error('Failed to save alerts config:', err)
      showError(t('settings.alertsSaveFailed'))
    } finally {
      setAlertSaving(false)
    }
  }

  async function handleSendTest() {
    if (!manageAlerts) {
      showError(t('settings.alertsReadOnly'))
      return
    }

    try {
      const res = await fetch('/api/alerts/test', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(body.error || 'failed to send test alert')
      }
      showSuccess(t('settings.alertsTestSent'))
    } catch (err) {
      console.error('Failed to send test alert:', err)
      showError(t('settings.alertsTestFailed'))
    }
  }

  async function handleMuteAlerts() {
    if (!manageAlerts) {
      showError(t('settings.alertsReadOnly'))
      return
    }

    const minutes = Number(silenceMinutes)
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      showError(t('settings.alertsInvalidMute'))
      return
    }

    try {
      const res = await fetch('/api/alerts/silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: Math.round(minutes) }),
      })
      if (!res.ok) throw new Error('failed to mute alerts')
      showSuccess(t('settings.alertsMuted'))
    } catch (err) {
      console.error('Failed to mute alerts:', err)
      showError(t('settings.alertsMuteFailed'))
    }
  }

  async function handleClearMuteAlerts() {
    if (!manageAlerts) {
      showError(t('settings.alertsReadOnly'))
      return
    }

    try {
      const res = await fetch('/api/alerts/silence', { method: 'DELETE' })
      if (!res.ok) throw new Error('failed to clear mute')
      showSuccess(t('settings.alertsUnmuted'))
    } catch (err) {
      console.error('Failed to clear mute:', err)
      showError(t('settings.alertsMuteFailed'))
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-lg font-semibold font-mono text-text-primary">{t('settings.title')}</h1>

      <Card>
        <CardTitle>{t('settings.appearance')}</CardTitle>

        <div className="flex items-center justify-between py-3 border-b border-border-base">
          <div>
            <p className="text-sm font-medium text-text-primary">{t('settings.accessMode')}</p>
          </div>
          <span className={`px-2 py-1 rounded text-[10px] font-semibold font-mono ${serverInfo?.auth_enabled ? 'bg-accent-blue text-bg-primary' : 'bg-accent-yellow text-bg-primary'}`}>
            {serverInfo?.auth_enabled ? t('mode.authEnabled') : t('mode.public')}
          </span>
        </div>

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
              onChange={(e) => {
                setIntervalInput(e.target.value)
                setIntervalState('idle')
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveInterval()}
              className="w-40 bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
            <Button variant="primary" onClick={handleSaveInterval}>
              {intervalState === 'saved' ? t('settings.saved') : t('settings.apply')}
            </Button>
          </div>
        </div>
      </Card>

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
              onChange={(e) => {
                setCacheTtlInput(e.target.value)
                setCacheTtlState('idle')
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCacheTtl()}
              className="w-40 bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
            <Button variant="primary" onClick={handleSaveCacheTtl}>
              {cacheTtlState === 'saved' ? t('settings.saved') : t('settings.apply')}
            </Button>
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
              onChange={(e) => {
                setPathInput(e.target.value)
                setSaved(false)
              }}
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

      <Card>
        <CardTitle>{t('settings.healthAlerts')}</CardTitle>

        {alertLoading ? (
          <p className="text-xs font-mono text-text-secondary mt-3">{t('settings.alertsLoading')}</p>
        ) : (
          <div className="space-y-4 py-3">
            {!manageAlerts && (
              <p className="text-xs font-mono text-accent-yellow">{t('settings.alertsReadOnly')}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-mono text-text-secondary">
                {t('settings.alertsEnabled')}
                <select
                  className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary"
                  value={alertEnabled ? '1' : '0'}
                  onChange={(e) => setAlertEnabled(e.target.value === '1')}
                  disabled={!manageAlerts}
                >
                  <option value="1">{t('settings.enabled')}</option>
                  <option value="0">{t('settings.disabled')}</option>
                </select>
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.cooldownSec')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={cooldownSec} onChange={(e) => setCooldownSec(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.warningPercent')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={warningPct} onChange={(e) => setWarningPct(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.warningForSec')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={warningForSec} onChange={(e) => setWarningForSec(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.criticalPercent')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={criticalPct} onChange={(e) => setCriticalPct(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.criticalForSec')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={criticalForSec} onChange={(e) => setCriticalForSec(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.recoveryPercent')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={recoveryPct} onChange={(e) => setRecoveryPct(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary">
                {t('settings.recoveryForSec')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={recoveryForSec} onChange={(e) => setRecoveryForSec(e.target.value)} disabled={!manageAlerts} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-mono text-text-secondary">
                Telegram
                <select
                  className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary"
                  value={telegramEnabled ? '1' : '0'}
                  onChange={(e) => setTelegramEnabled(e.target.value === '1')}
                  disabled={!manageAlerts}
                >
                  <option value="1">{t('settings.enabled')}</option>
                  <option value="0">{t('settings.disabled')}</option>
                </select>
              </label>

              <label className="text-xs font-mono text-text-secondary">
                Email
                <select
                  className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary"
                  value={emailEnabled ? '1' : '0'}
                  onChange={(e) => setEmailEnabled(e.target.value === '1')}
                  disabled={!manageAlerts}
                >
                  <option value="1">{t('settings.enabled')}</option>
                  <option value="0">{t('settings.disabled')}</option>
                </select>
              </label>

              <label className="text-xs font-mono text-text-secondary sm:col-span-2">
                {t('settings.recipientEmails')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={emailsInput} onChange={(e) => setEmailsInput(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary sm:col-span-2">
                {t('settings.telegramChatIds')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={chatIDsInput} onChange={(e) => setChatIDsInput(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary sm:col-span-2">
                {t('settings.retryDelaysSec')}
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={retryDelaysInput} onChange={(e) => setRetryDelaysInput(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary sm:col-span-2">
                Telegram Bot Token
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-text-primary">{alertConfig?.telegram_token_mask || '(empty)'}</span>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setRotateTelegramSecret((v) => !v)
                      setClearTelegramSecret(false)
                    }}
                    disabled={!manageAlerts || !alertConfig?.secrets_writable}
                  >
                    {rotateTelegramSecret ? t('settings.cancelRotate') : t('settings.rotateSecret')}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setClearTelegramSecret(true)
                      setRotateTelegramSecret(false)
                      setTelegramTokenInput('')
                    }}
                    disabled={!manageAlerts || !alertConfig?.has_telegram_token}
                  >
                    {t('settings.clearSecret')}
                  </Button>
                </div>
                {rotateTelegramSecret && (
                  <input
                    className="mt-2 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary"
                    type="password"
                    value={telegramTokenInput}
                    placeholder={t('settings.enterNewSecret')}
                    onChange={(e) => setTelegramTokenInput(e.target.value)}
                    disabled={!manageAlerts || !alertConfig?.secrets_writable}
                  />
                )}
                {clearTelegramSecret && (
                  <p className="mt-1 text-accent-yellow">{t('settings.secretWillBeCleared')}</p>
                )}
              </label>

              <label className="text-xs font-mono text-text-secondary sm:col-span-2">
                Gmail Address
                <input className="mt-1 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary" value={gmailAddressInput} onChange={(e) => setGmailAddressInput(e.target.value)} disabled={!manageAlerts} />
              </label>

              <label className="text-xs font-mono text-text-secondary sm:col-span-2">
                Gmail App Password
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-text-primary">{alertConfig?.gmail_password_mask || '(empty)'}</span>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setRotateGmailSecret((v) => !v)
                      setClearGmailSecret(false)
                    }}
                    disabled={!manageAlerts || !alertConfig?.secrets_writable}
                  >
                    {rotateGmailSecret ? t('settings.cancelRotate') : t('settings.rotateSecret')}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setClearGmailSecret(true)
                      setRotateGmailSecret(false)
                      setGmailPasswordInput('')
                    }}
                    disabled={!manageAlerts || !alertConfig?.has_gmail_password}
                  >
                    {t('settings.clearSecret')}
                  </Button>
                </div>
                {rotateGmailSecret && (
                  <input
                    className="mt-2 w-full bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-text-primary"
                    type="password"
                    value={gmailPasswordInput}
                    placeholder={t('settings.enterNewSecret')}
                    onChange={(e) => setGmailPasswordInput(e.target.value)}
                    disabled={!manageAlerts || !alertConfig?.secrets_writable}
                  />
                )}
                {clearGmailSecret && (
                  <p className="mt-1 text-accent-yellow">{t('settings.secretWillBeCleared')}</p>
                )}
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleSaveAlerts} disabled={!manageAlerts || alertSaving}>{t('settings.saveAlerts')}</Button>
              <Button variant="ghost" onClick={handleSendTest} disabled={!manageAlerts}>{t('settings.sendTestAlert')}</Button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="w-28 bg-bg-primary border border-border-base rounded-base px-2 py-1.5 text-xs font-mono text-text-primary"
                value={silenceMinutes}
                onChange={(e) => setSilenceMinutes(e.target.value)}
                disabled={!manageAlerts}
              />
              <Button variant="ghost" onClick={handleMuteAlerts} disabled={!manageAlerts}>{t('settings.muteAlerts')}</Button>
              <Button variant="ghost" onClick={handleClearMuteAlerts} disabled={!manageAlerts}>{t('settings.clearMute')}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
