import { useEffect } from 'react'
import { useStore } from '@/store'
import type { AuthMeResponse } from '@/types/api'

export function useAuthSession() {
  const setAuthUser = useStore((s) => s.setAuthUser)
  const setAuthLoading = useStore((s) => s.setAuthLoading)

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) {
          return null
        }
        return res.json() as Promise<AuthMeResponse>
      })
      .then((data) => {
        if (cancelled) return
        if (data?.user) {
          setAuthUser(data.user)
        } else if (data?.auth_disabled) {
          setAuthUser({ id: 0, username: 'public', role: 'viewer' })
        } else {
          setAuthUser(null)
        }
      })
      .catch(() => {
        if (cancelled) return
        setAuthUser(null)
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [setAuthLoading, setAuthUser])
}
