export type ScanStatus = 'idle' | 'running' | 'done' | 'error'

export interface DirEntry {
  name: string
  asize: number
  dsize: number
  is_dir: boolean
  children?: DirEntry[]
}

export interface ScanResult {
  path: string
  scanned_at: string
  total_size: number
  root: DirEntry | null
  status: ScanStatus
  error?: string
}
