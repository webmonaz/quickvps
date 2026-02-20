import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { shallow } from 'zustand/shallow'
import { useStore } from '@/store'

const EMPTY_REQUIRED_PACKAGES: { name: string; installed: boolean; required_for: string }[] = []
const EMPTY_MISSING_PACKAGES: string[] = []

export const RequiredPackagesBanner = memo(function RequiredPackagesBanner() {
  const { t } = useTranslation()
  const { requiredPackages, missingRequiredPackages, installCommand } = useStore((s) => ({
    requiredPackages: s.serverInfo?.required_packages ?? EMPTY_REQUIRED_PACKAGES,
    missingRequiredPackages: s.serverInfo?.missing_required_packages ?? EMPTY_MISSING_PACKAGES,
    installCommand: s.serverInfo?.required_packages_install_cmd ?? '',
  }), shallow)

  const missingDetails = useMemo(() => {
    if (missingRequiredPackages.length === 0) {
      return []
    }

    return missingRequiredPackages.map((name) => {
      const matched = requiredPackages.find((pkg) => pkg.name === name)
      return {
        name,
        requiredFor: matched?.required_for ?? 'unknown',
      }
    })
  }, [missingRequiredPackages, requiredPackages])

  if (missingDetails.length === 0) {
    return null
  }

  return (
    <div className="mx-4 mt-4 rounded-base border border-accent-yellow/60 bg-accent-yellow/10 px-4 py-3 text-xs font-mono text-text-primary">
      <p className="font-semibold text-accent-yellow">{t('requiredPackages.title')}</p>
      <p className="mt-1 text-text-secondary">{t('requiredPackages.description')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {missingDetails.map((item) => (
          <span
            key={item.name}
            className="rounded bg-bg-card px-2 py-1 text-text-primary border border-border-base"
          >
            {item.name} ({t(`requiredPackages.feature.${item.requiredFor}`)})
          </span>
        ))}
      </div>
      {installCommand && (
        <p className="mt-2 text-text-secondary">
          {t('requiredPackages.installCommand')}: <span className="text-text-primary">{installCommand}</span>
        </p>
      )}
    </div>
  )
})
