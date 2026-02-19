import { memo, useEffect } from 'react'
import { useStore } from '@/store'
import type { ToastItem, ToastVariant } from '@/store'

interface ToastProps {
  item: ToastItem
  onClose: (id: string) => void
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: 'bg-bg-card border-border-base text-text-primary',
  success: 'bg-accent-green text-bg-primary border-accent-green',
  error: 'bg-accent-red text-bg-primary border-accent-red',
}

export const Toast = memo(function Toast({ item, onClose }: ToastProps) {
  useEffect(() => {
    if (item.autoCloseMs === null) {
      return
    }

    const timer = window.setTimeout(() => onClose(item.id), item.autoCloseMs)
    return () => window.clearTimeout(timer)
  }, [item.id, item.autoCloseMs, onClose])

  return (
    <div className={`w-80 max-w-[90vw] border rounded-base px-3 py-2 text-xs font-mono shadow-md ${VARIANT_CLASS[item.variant]}`}>
      <div className="flex items-start justify-between gap-2">
        <span>{item.message}</span>
        <button
          className="text-inherit opacity-80 hover:opacity-100 transition-opacity"
          onClick={() => onClose(item.id)}
          aria-label="Close toast"
        >
          ×
        </button>
      </div>
    </div>
  )
})

export const ToastHost = memo(function ToastHost() {
  const toasts = useStore((s) => s.toasts)
  const removeToast = useStore((s) => s.removeToast)

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast item={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  )
})