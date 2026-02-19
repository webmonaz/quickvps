import { memo, useEffect } from 'react'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const Dialog = memo(function Dialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }

      if (e.key === 'Enter' && !busy) {
        e.preventDefault()
        onConfirm()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel, onConfirm, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-bg-primary opacity-80"
        onClick={onCancel}
      />

      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm bg-bg-card border border-border-base rounded-card p-4">
        <h2 className="text-sm font-semibold font-mono text-text-primary">{title}</h2>
        <p className="mt-2 text-xs text-text-secondary">{description}</p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
})