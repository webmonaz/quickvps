import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useStore } from '@/store'
import type { AuthUser } from '@/types/api'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const authUser = useStore((s) => s.authUser)
  const authLoading = useStore((s) => s.authLoading)
  const setAuthUser = useStore((s) => s.setAuthUser)

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!authLoading && authUser) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json().catch(() => ({})) as { user?: AuthUser; error?: string }
      if (!res.ok || !data.user) {
        setError(data.error || t('auth.invalidCredentials'))
        return
      }

      setAuthUser(data.user)
      navigate('/', { replace: true })
    } catch {
      setError(t('auth.loginFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-lg font-semibold font-mono text-text-primary">{t('auth.signIn')}</h1>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-mono text-text-secondary mb-1">{t('auth.username')}</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-text-secondary mb-1">{t('auth.password')}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
            />
          </div>

          {error && <p className="text-xs text-accent-red">{error}</p>}

          <Button type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting && <Spinner />}
            {t('auth.signIn')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
