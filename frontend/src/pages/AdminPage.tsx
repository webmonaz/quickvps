import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/hooks/useToast'
import { useStore } from '@/store'
import type { AuthUser, UserAuditEntry, UserRole } from '@/types/api'

type UserEditor = {
  role: UserRole
  password: string
}

export default function AdminPage() {
  const { t } = useTranslation()
  const authUser = useStore((s) => s.authUser)
  const { showError, showSuccess } = useToast()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [audits, setAudits] = useState<UserAuditEntry[]>([])
  const [editors, setEditors] = useState<Record<number, UserEditor>>({})
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('viewer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)

  function setEditor(user: AuthUser) {
    setEditors((prev) => ({
      ...prev,
      [user.id]: prev[user.id] ?? { role: user.role, password: '' },
    }))
  }

  function resetEditors(nextUsers: AuthUser[]) {
    setEditors((prev) => {
      const next: Record<number, UserEditor> = {}
      for (const user of nextUsers) {
        const prior = prev[user.id]
        next[user.id] = {
          role: prior?.role ?? user.role,
          password: '',
        }
      }
      return next
    })
  }

  async function loadUsers() {
    const res = await fetch('/api/users')
    if (!res.ok) {
      throw new Error('failed')
    }
    const data = await res.json() as { users?: AuthUser[] }
    const nextUsers = data.users ?? []
    setUsers(nextUsers)
    resetEditors(nextUsers)
  }

  async function loadAudits() {
    const res = await fetch('/api/audit/users?limit=50')
    if (!res.ok) {
      throw new Error('failed')
    }
    const data = await res.json() as { entries?: UserAuditEntry[] }
    setAudits(data.entries ?? [])
  }

  useEffect(() => {
    if (authUser?.role !== 'admin') return

    Promise.all([loadUsers(), loadAudits()]).catch(() => {
      if (authUser?.role === 'admin') {
        setError(t('admin.loadError'))
      }
    })
  }, [authUser?.role, t])

  async function handleCreateUser() {
    if (busy) return
    setBusy(true)
    setError('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: createUsername,
          password: createPassword,
          role: createRole,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        showError(data.error || t('admin.createError'))
        return
      }

      setCreateUsername('')
      setCreatePassword('')
      setCreateRole('viewer')
      await Promise.all([loadUsers(), loadAudits()])
      showSuccess(t('admin.createSuccess'))
    } catch {
      showError(t('admin.createError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveUser(user: AuthUser) {
    const editor = editors[user.id]
    if (!editor || busy) return
    setBusy(true)
    setError('')

    try {
      const payload: { role?: UserRole; password?: string } = {}
      if (editor.role !== user.role) {
        payload.role = editor.role
      }
      if (editor.password.trim() !== '') {
        payload.password = editor.password
      }

      if (!payload.role && !payload.password) {
        showError(t('admin.noChanges'))
        return
      }

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        showError(data.error || t('admin.updateError'))
        return
      }

      await Promise.all([loadUsers(), loadAudits()])
      showSuccess(t('admin.updateSuccess'))
    } catch {
      showError(t('admin.updateError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteUser(user: AuthUser) {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        showError(data.error || t('admin.deleteError'))
        return
      }

      await Promise.all([loadUsers(), loadAudits()])
      showSuccess(t('admin.deleteSuccess'))
      setDeleteTarget(null)
    } catch {
      showError(t('admin.deleteError'))
    } finally {
      setBusy(false)
    }
  }

  function onRoleChange(user: AuthUser, role: UserRole) {
    setEditor(user)
    setEditors((prev) => ({
      ...prev,
      [user.id]: {
        ...prev[user.id],
        role,
      },
    }))
  }

  function onPasswordChange(user: AuthUser, password: string) {
    setEditor(user)
    setEditors((prev) => ({
      ...prev,
      [user.id]: {
        ...prev[user.id],
        password,
      },
    }))
  }

  if (authUser?.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-lg font-semibold font-mono text-text-primary">{t('admin.title')}</h1>
        <Card>
          <p className="text-sm text-text-secondary">{t('admin.forbidden')}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-lg font-semibold font-mono text-text-primary">{t('admin.title')}</h1>

      <Card>
        <CardTitle>{t('admin.createUser')}</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            placeholder={t('auth.username')}
            className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
          />
          <input
            type="password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            placeholder={t('auth.password')}
            className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
          />
          <select
            value={createRole}
            onChange={(e) => setCreateRole(e.target.value as UserRole)}
            className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
          >
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="mt-3">
          <Button onClick={handleCreateUser} disabled={busy}>{t('admin.createAction')}</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>{t('admin.userList')}</CardTitle>
        {error && <p className="text-xs text-accent-red mb-2">{error}</p>}
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="border-b border-border-base pb-2">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-mono text-text-primary">{user.username}</span>
                <span className="text-xs text-text-secondary uppercase">#{user.id}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={editors[user.id]?.role ?? user.role}
                  onChange={(e) => onRoleChange(user, e.target.value as UserRole)}
                  className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
                >
                  <option value="viewer">viewer</option>
                  <option value="admin">admin</option>
                </select>
                <input
                  type="password"
                  value={editors[user.id]?.password ?? ''}
                  onChange={(e) => onPasswordChange(user, e.target.value)}
                  placeholder={t('admin.newPasswordOptional')}
                  className="w-full bg-bg-primary border border-border-base rounded-base px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-blue"
                />
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveUser(user)} disabled={busy}>{t('admin.saveAction')}</Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeleteTarget(user)}
                    disabled={busy || authUser?.id === user.id}
                  >
                    {t('admin.deleteAction')}
                  </Button>
                </div>
              </div>
              {authUser?.id === user.id && (
                <p className="text-[10px] text-text-muted font-mono mt-1">{t('admin.currentUserHint')}</p>
              )}
            </div>
          ))}
          {users.length === 0 && !error && (
            <p className="text-sm text-text-secondary">{t('admin.noUsers')}</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('admin.auditTitle')}</CardTitle>
        <div className="space-y-2 max-h-64 overflow-auto pr-2">
          {audits.map((entry) => (
            <div key={entry.id} className="border-b border-border-base pb-2 text-xs font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-primary">
                  {entry.actor_username} → {entry.target_username}
                </span>
                <span className="text-text-secondary uppercase">{entry.action}</span>
              </div>
              <div className="text-text-muted mt-1 break-all">{entry.details}</div>
              <div className="text-text-muted mt-1">{new Date(entry.created_at).toLocaleString()}</div>
            </div>
          ))}
          {audits.length === 0 && (
            <p className="text-sm text-text-secondary">{t('admin.noAudit')}</p>
          )}
        </div>
      </Card>

      <Dialog
        open={!!deleteTarget}
        title={t('admin.deleteTitle')}
        description={t('admin.deleteConfirm', { username: deleteTarget?.username ?? '' })}
        confirmLabel={t('admin.deleteAction')}
        cancelLabel={t('admin.cancelAction')}
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDeleteUser(deleteTarget)
          }
        }}
      />
    </div>
  )
}
