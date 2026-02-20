import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Snapshot } from '@/types/metrics'
import type { ScanResult } from '@/types/ncdu'
import type { AuthUser, ServerInfo } from '@/types/api'

export type Theme = 'dark' | 'light'
export type Language = 'en' | 'vi'

interface MetricsState {
  snapshot: Snapshot | null
  netHistory: [number[], number[]]
  diskIOHistory: [number[], number[]]
  cpuHistory: number[]
  memHistory: number[]
  swapHistory: number[]
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

interface AuthState {
  authUser: AuthUser | null
  authLoading: boolean
}

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  autoCloseMs: number | null
}

interface ToastState {
  toasts: ToastItem[]
}

interface PreferencesState {
  theme: Theme
  language: Language
  defaultScanPath: string
  fontSize: number
  isFrozen: boolean
  updateIntervalMs: number
  ncduCacheTtlSec: number
}

export interface AppState extends MetricsState, NcduState, ConnectionState, ServerInfoState, PreferencesState, ToastState, AuthState {
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

  // Auth actions
  setAuthUser: (user: AuthUser | null) => void
  setAuthLoading: (loading: boolean) => void

  // Preferences actions
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setDefaultScanPath: (path: string) => void
  setFontSize: (size: number) => void
  setFrozen: (frozen: boolean) => void
  setUpdateIntervalMs: (ms: number) => void
  setNcduCacheTtlSec: (sec: number) => void

  // Toast actions
  showToast: (toast: Omit<ToastItem, 'id'> & { id?: string }) => void
  removeToast: (id: string) => void
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
      cpuHistory: Array(HISTORY_LENGTH).fill(0),
      memHistory: Array(HISTORY_LENGTH).fill(0),
      swapHistory: Array(HISTORY_LENGTH).fill(0),
      scanPath: (localStorage.getItem('defaultScanPath')) ?? '/',
      scanResult: null,
      isScanning: false,
      isConnected: false,
      serverInfo: null,
      authUser: null,
      authLoading: true,
      toasts: [],
      theme: (localStorage.getItem('theme') as Theme) ?? 'dark',
      language: (localStorage.getItem('language') as Language) ?? 'en',
      defaultScanPath: (localStorage.getItem('defaultScanPath')) ?? '/',
      fontSize: Number(localStorage.getItem('fontSize')) || 14,
      isFrozen: localStorage.getItem('isFrozen') === 'true',
      updateIntervalMs: Math.max(250, Number(localStorage.getItem('updateIntervalMs')) || 2000),
      ncduCacheTtlSec: (() => {
        const sec = Number(localStorage.getItem('ncduCacheTtlSec'))
        if (Number.isFinite(sec) && sec > 0) {
          return Math.max(1, Math.round(sec))
        }

        const legacyMs = Number(localStorage.getItem('ncduCacheTtlMs'))
        if (Number.isFinite(legacyMs) && legacyMs > 0) {
          return Math.max(1, Math.round(legacyMs / 1000))
        }

        return 600
      })(),

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

          // Update CPU / memory / swap percent histories
          state.cpuHistory  = pushHistory(state.cpuHistory,  snapshot.cpu?.total_percent ?? 0)
          state.memHistory  = pushHistory(state.memHistory,  snapshot.memory?.percent    ?? 0)
          state.swapHistory = pushHistory(state.swapHistory, snapshot.swap?.percent      ?? 0)
        }),

      setScanPath:   (path)   => set((s) => { s.scanPath = path }),
      setScanResult: (result) => set((s) => { s.scanResult = result }),
      setIsScanning: (v)      => set((s) => { s.isScanning = v }),
      setConnected:  (v)      => set((s) => { s.isConnected = v }),
      setServerInfo: (info)   => set((s) => { s.serverInfo = info }),
      setAuthUser: (user)     => set((s) => { s.authUser = user }),
      setAuthLoading: (loading) => set((s) => { s.authLoading = loading }),

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

      setFontSize: (size) => set((s) => {
        s.fontSize = size
        localStorage.setItem('fontSize', String(size))
        document.documentElement.style.fontSize = size + 'px'
      }),

      setFrozen: (frozen) => set((s) => {
        s.isFrozen = frozen
        localStorage.setItem('isFrozen', String(frozen))
      }),

      setUpdateIntervalMs: (ms) => set((s) => {
        const next = Math.max(250, ms)
        s.updateIntervalMs = next
        localStorage.setItem('updateIntervalMs', String(next))
      }),

      setNcduCacheTtlSec: (sec) => set((s) => {
        const next = Math.max(1, sec)
        s.ncduCacheTtlSec = next
        localStorage.setItem('ncduCacheTtlSec', String(next))
        localStorage.removeItem('ncduCacheTtlMs')
      }),

      showToast: (toast) => set((s) => {
        const id = toast.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        s.toasts.push({
          id,
          message: toast.message,
          variant: toast.variant,
          autoCloseMs: toast.autoCloseMs,
        })
      }),

      removeToast: (id) => set((s) => {
        s.toasts = s.toasts.filter((toast) => toast.id !== id)
      }),
    })),
  ),
)
