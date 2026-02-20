export type PackageManager = 'none' | 'apt' | 'dnf' | 'yum' | 'pacman'

export interface PackageItem {
  name: string
  version: string
}

export interface PackageUpdate {
  name: string
  current_version: string
  new_version: string
}

export interface PackageInventoryResponse {
  manager: PackageManager
  total: number
  packages: PackageItem[]
  scanned_at: string
  error?: string
}

export interface PackageUpdatesResponse {
  manager: PackageManager
  total: number
  updates: PackageUpdate[]
  scanned_at: string
  error?: string
}
