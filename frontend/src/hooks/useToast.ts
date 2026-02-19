import { useStore } from '@/store'
import type { ToastVariant } from '@/store'

interface ToastOptions {
  autoCloseMs?: number | null
}

export function useToast() {
  const showToast = useStore((s) => s.showToast)

  function push(variant: ToastVariant, message: string, options?: ToastOptions) {
    const defaultAutoCloseMs = variant === 'error' ? 15000 : 3000
    showToast({
      variant,
      message,
      autoCloseMs: options?.autoCloseMs ?? defaultAutoCloseMs,
    })
  }

  return {
    showInfo: (message: string, options?: ToastOptions) => push('info', message, options),
    showSuccess: (message: string, options?: ToastOptions) => push('success', message, options),
    showError: (message: string, options?: ToastOptions) => push('error', message, options),
    showPersistent: (variant: ToastVariant, message: string) => push(variant, message, { autoCloseMs: null }),
  }
}