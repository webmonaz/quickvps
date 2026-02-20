import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { RollingLineChart } from '@/components/charts/RollingLineChart'

export const DiskIOSection = memo(function DiskIOSection() {
  const [readHistory, writeHistory] = useStore((s) => s.diskIOHistory, shallow)
  const { t } = useTranslation()

  const datasets = [
    { label: t('diskIO.read'),  color: '#4c9ef5', data: readHistory  },
    { label: t('diskIO.write'), color: '#a78bfa', data: writeHistory },
  ]

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">{t('diskIO.title')}</CardTitle>
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span><span className="text-accent-blue">—</span> {t('diskIO.read')}</span>
          <span><span className="text-accent-purple">—</span> {t('diskIO.write')}</span>
        </div>
      </div>
      <div className="h-28">
        <RollingLineChart datasets={datasets} />
      </div>
    </Card>
  )
})
