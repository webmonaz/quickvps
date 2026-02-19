export interface CPUMetrics {
  total_percent: number
  freq_mhz: number
  per_core: number[]
  core_count: number
  model_name: string
}

export interface MemMetrics {
  total_bytes: number
  used_bytes: number
  free_bytes: number
  cached: number
  buffers: number
  percent: number
}

export interface SwapMetrics {
  total_bytes: number
  used_bytes: number
  free_bytes: number
  percent: number
}

export interface DiskMetrics {
  mountpoint: string
  device: string
  fstype: string
  total_bytes: number
  used_bytes: number
  free_bytes: number
  percent: number
}

export interface DiskIOMetrics {
  device: string
  read_bps: number
  write_bps: number
  read_ops: number
  write_ops: number
}

export interface NetMetrics {
  interface: string
  recv_bps: number
  sent_bps: number
  total_recv: number
  total_sent: number
}

export interface Snapshot {
  timestamp: string
  cpu: CPUMetrics
  memory: MemMetrics
  swap: SwapMetrics
  disks: DiskMetrics[]
  disk_io: DiskIOMetrics[]
  network: NetMetrics[]
}
