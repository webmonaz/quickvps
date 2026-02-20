import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { shallow } from 'zustand/shallow'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'
import { RollingLineChart } from '@/components/charts/RollingLineChart'

export const NetworkSection = memo(function NetworkSection() {
  const [recvHistory, sentHistory] = useStore((s) => s.netHistory, shallow)
  const { t } = useTranslation()

  const datasets = [
    { label: t('network.recv'), color: '#3ddc84', data: recvHistory },
    { label: t('network.sent'), color: '#f87171', data: sentHistory },
  ]

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">{t('network.title')}</CardTitle>
        <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary">
          <span><span className="text-accent-green">—</span> {t('network.recv')}</span>
          <span><span className="text-accent-red">—</span> {t('network.sent')}</span>
        </div>
      </div>
      <div className="h-28">
        <RollingLineChart datasets={datasets} />
      </div>
    </Card>
  )
})
