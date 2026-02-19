import { memo, useState } from 'react'
import type { DirEntry } from '@/types/ncdu'
import { formatBytes } from '@/lib/formatBytes'

interface NcduTreeNodeProps {
  entry:      DirEntry
  parentSize: number
  depth:      number
}

function getBarColor(pct: number): string {
  if (pct > 50) return '#f87171'
  if (pct > 20) return '#fbbf24'
  return '#4c9ef5'
}

export const NcduTreeNode = memo(function NcduTreeNode({
  entry, parentSize, depth,
}: NcduTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const [hasRendered, setHasRendered] = useState(depth < 2)

  const pct      = parentSize > 0 ? (entry.dsize / parentSize * 100) : 100
  const pctStr   = pct.toFixed(1) + '%'
  const barColor = getBarColor(pct)
  const hasChildren = entry.is_dir && entry.children && entry.children.length > 0

  const handleToggle = () => {
    if (!hasChildren) return
    const next = !isExpanded
    setIsExpanded(next)
    if (next && !hasRendered) setHasRendered(true)
  }

  return (
    <li className="list-none">
      <div
        className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-bg-card-hover cursor-pointer group"
        onClick={handleToggle}
      >
        <span className="w-3 text-text-muted text-[10px] select-none">
          {hasChildren ? (isExpanded ? '▾' : '▸') : ' '}
        </span>
        <span className="text-sm">{entry.is_dir ? '📁' : '📄'}</span>
        <span className="text-xs text-text-primary font-mono truncate flex-1 min-w-0" title={entry.name}>
          {entry.name}
        </span>
        <div className="w-20 h-1.5 bg-border-base rounded-full overflow-hidden shrink-0">
          <div
            className="h-full rounded-full"
            style={{ width: Math.min(100, pct) + '%', background: barColor }}
          />
        </div>
        <span className="text-[10px] font-mono w-10 text-right shrink-0" style={{ color: barColor }}>
          {pctStr}
        </span>
        <span className="text-[10px] font-mono text-text-secondary w-16 text-right shrink-0">
          {formatBytes(entry.dsize)}
        </span>
      </div>
      {hasChildren && hasRendered && (
        <ul className={`ml-5 border-l border-border-base pl-2 ${isExpanded ? '' : 'hidden'}`}>
          {entry.children!.map((child, i) => (
            <NcduTreeNode
              key={i}
              entry={child}
              parentSize={entry.dsize}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
})
