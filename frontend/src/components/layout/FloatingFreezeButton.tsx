import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'

export const FloatingFreezeButton = memo(function FloatingFreezeButton() {
  const { t } = useTranslation()
  const isFrozen = useStore((s) => s.isFrozen)
  const setFrozen = useStore((s) => s.setFrozen)

  return (
    <button
      onClick={() => setFrozen(!isFrozen)}
      className={`fixed right-5 bottom-5 z-40 px-4 py-2 rounded-base text-xs font-mono font-semibold border transition-colors shadow-md ${
        isFrozen
          ? 'bg-accent-red text-bg-primary border-accent-red hover:opacity-90'
          : 'bg-accent-blue text-bg-primary border-accent-blue hover:opacity-90'
      }`}
      title={isFrozen ? t('settings.resume') : t('settings.freeze')}
    >
      {isFrozen ? `▶ ${t('settings.resume')}` : `❚❚ ${t('settings.freeze')}`}
    </button>
  )
})