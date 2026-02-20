import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { Card } from '@/components/ui/Card'
import { CardTitle } from '@/components/ui/CardTitle'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-border-base last:border-0">
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs font-mono text-text-primary break-all">{value}</span>
    </div>
  )
}

export const ServerInfoCard = memo(function ServerInfoCard() {
  const serverInfo = useStore((s) => s.serverInfo)
  const { t } = useTranslation()

  return (
    <Card className="flex flex-col">
      <CardTitle>{t('serverInfo.title')}</CardTitle>
      <div className="flex flex-col">
        <InfoRow label={t('serverInfo.hostname')} value={serverInfo?.hostname ?? '—'} />
        <InfoRow
          label={t('serverInfo.os')}
          value={serverInfo ? `${serverInfo.os} / ${serverInfo.arch}` : '—'}
        />
        <InfoRow label={t('serverInfo.uptime')}   value={serverInfo?.uptime    ?? '—'} />
        <InfoRow label={t('serverInfo.publicIp')} value={serverInfo?.public_ip ?? '—'} />
        <InfoRow label={t('serverInfo.localIp')}  value={serverInfo?.local_ip  ?? '—'} />
        <InfoRow
          label={t('serverInfo.dns')}
          value={
            serverInfo?.dns_servers && serverInfo.dns_servers.length > 0
              ? serverInfo.dns_servers.join(', ')
              : '—'
          }
        />
        <InfoRow label={t('serverInfo.version')} value={serverInfo?.version ?? '—'} />
      </div>
    </Card>
  )
})
