import { THRESHOLD_WARN, THRESHOLD_DANGER } from '@/constants/thresholds'

/** Returns a Tailwind text-color class based on percentage */
export function getThresholdColor(pct: number): string {
  if (pct >= THRESHOLD_DANGER) return 'text-accent-red'
  if (pct >= THRESHOLD_WARN)   return 'text-accent-yellow'
  return 'text-accent-green'
}

/** Returns a hex color string based on percentage */
export function getThresholdHex(pct: number): string {
  if (pct >= THRESHOLD_DANGER) return '#f87171'
  if (pct >= THRESHOLD_WARN)   return '#fbbf24'
  return '#3ddc84'
}

/** Returns a Tailwind bg-color class for progress bars */
export function getThresholdBgColor(pct: number): string {
  if (pct >= THRESHOLD_DANGER) return 'bg-accent-red'
  if (pct >= THRESHOLD_WARN)   return 'bg-accent-yellow'
  return 'bg-accent-green'
}
