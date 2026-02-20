import { useCallback, useMemo } from 'react'
import { useStore } from '@/store'
import type { ToastVariant } from '@/store'

interface ToastOptions {
  autoCloseMs?: number | null
}

export function useToast() {
  const showToast = useStore((s) => s.showToast)

  const push = useCallback((variant: ToastVariant, message: string, options?: ToastOptions) => {
    const defaultAutoCloseMs = variant === 'error' ? 15000 : 3000
    showToast({
      variant,
      message,
      autoCloseMs: options?.autoCloseMs ?? defaultAutoCloseMs,
    })
  }, [showToast])

  const showInfo = useCallback((message: string, options?: ToastOptions) => push('info', message, options), [push])
  const showSuccess = useCallback((message: string, options?: ToastOptions) => push('success', message, options), [push])
  const showError = useCallback((message: string, options?: ToastOptions) => push('error', message, options), [push])
  const showPersistent = useCallback((variant: ToastVariant, message: string) => push(variant, message, { autoCloseMs: null }), [push])

  return useMemo(() => ({
    showInfo,
    showSuccess,
    showError,
    showPersistent,
  }), [showInfo, showSuccess, showError, showPersistent])
}
