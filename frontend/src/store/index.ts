import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Snapshot } from '@/types/metrics'
import type { ScanResult } from '@/types/ncdu'
import type { ServerInfo } from '@/types/api'

export type Theme = 'dark' | 'light'
export type Language = 'en' | 'vi'

interface MetricsState {
  snapshot: Snapshot | null
  netHistory: [number[], number[]]
  diskIOHistory: [number[], number[]]
}

interface NcduState {
  scanPath: string
  scanResult: ScanResult | null
  isScanning: boolean
}

interface ConnectionState {
  isConnected: boolean
}

interface ServerInfoState {
  serverInfo: ServerInfo | null
}

interface PreferencesState {
  theme: Theme
  language: Language
  defaultScanPath: string
}

export interface AppState extends MetricsState, NcduState, ConnectionState, ServerInfoState, PreferencesState {
  // Metrics actions
  setSnapshot: (snapshot: Snapshot) => void

  // Ncdu actions
  setScanPath: (path: string) => void
  setScanResult: (result: ScanResult | null) => void
  setIsScanning: (v: boolean) => void

  // Connection actions
  setConnected: (v: boolean) => void

  // Server info actions
  setServerInfo: (info: ServerInfo) => void

  // Preferences actions
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setDefaultScanPath: (path: string) => void
}

const HISTORY_LENGTH = 60

function pushHistory(arr: number[], val: number): number[] {
  const next = [...arr, val]
  if (next.length > HISTORY_LENGTH) next.shift()
  return next
}

export const useStore = create<AppState>()(
  subscribeWithSelector(
    immer((set) => ({
      // Initial state
      snapshot: null,
      netHistory: [Array(HISTORY_LENGTH).fill(0), Array(HISTORY_LENGTH).fill(0)],
      diskIOHistory: [Array(HISTORY_LENGTH).fill(0), Array(HISTORY_LENGTH).fill(0)],
      scanPath: (localStorage.getItem('defaultScanPath')) ?? '/',
      scanResult: null,
      isScanning: false,
      isConnected: false,
      serverInfo: null,
      theme: (localStorage.getItem('theme') as Theme) ?? 'dark',
      language: (localStorage.getItem('language') as Language) ?? 'en',
      defaultScanPath: (localStorage.getItem('defaultScanPath')) ?? '/',

      // Actions
      setSnapshot: (snapshot) =>
        set((state) => {
          state.snapshot = snapshot

          // Update net history
          const totalRecv = snapshot.network?.reduce((s, n) => s + n.recv_bps, 0) ?? 0
          const totalSent = snapshot.network?.reduce((s, n) => s + n.sent_bps, 0) ?? 0
          state.netHistory = [
            pushHistory(state.netHistory[0], totalRecv),
            pushHistory(state.netHistory[1], totalSent),
          ]

          // Update disk IO history
          const totalRead  = snapshot.disk_io?.reduce((s, x) => s + x.read_bps, 0) ?? 0
          const totalWrite = snapshot.disk_io?.reduce((s, x) => s + x.write_bps, 0) ?? 0
          state.diskIOHistory = [
            pushHistory(state.diskIOHistory[0], totalRead),
            pushHistory(state.diskIOHistory[1], totalWrite),
          ]
        }),

      setScanPath:   (path)   => set((s) => { s.scanPath = path }),
      setScanResult: (result) => set((s) => { s.scanResult = result }),
      setIsScanning: (v)      => set((s) => { s.isScanning = v }),
      setConnected:  (v)      => set((s) => { s.isConnected = v }),
      setServerInfo: (info)   => set((s) => { s.serverInfo = info }),

      setTheme: (theme) => set((s) => {
        s.theme = theme
        localStorage.setItem('theme', theme)
        if (theme === 'light') {
          document.documentElement.classList.add('light')
        } else {
          document.documentElement.classList.remove('light')
        }
      }),

      setLanguage: (language) => set((s) => {
        s.language = language
        localStorage.setItem('language', language)
      }),

      setDefaultScanPath: (path) => set((s) => {
        s.defaultScanPath = path
        localStorage.setItem('defaultScanPath', path)
      }),
    })),
  ),
)
