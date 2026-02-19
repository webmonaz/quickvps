# QuickVPS — Agent Guide

This file is loaded automatically by Claude Code at the start of every session.
It gives AI agents the context needed to work on this codebase without re-reading everything.

## What this project is

A single-binary Go web application that monitors Linux VPS resources (CPU, RAM, Swap, Disk, Network) and includes an `ncdu`-powered Storage Analyzer. All web assets are embedded in the binary via `//go:embed`. Protected by HTTP Basic Auth. No config files, no database, no external runtime dependencies.

## Build & run

```bash
go build -o quickvps .          # build for current OS (uses current web/ build output)
make linux                       # cross-compile → quickvps-linux (amd64)
make linux-arm64                 # cross-compile → quickvps-linux-arm64
make frontend                    # build React frontend → web/
make build-full                  # make frontend + make linux
./quickvps --password=dev        # run locally
```

Always verify `make linux` still compiles after any change — Linux is the primary deployment target.

For UI development, use the Vite dev server (no recompile needed):
```bash
# Terminal 1
./quickvps --password=dev
# Terminal 2
cd frontend && npm run dev       # → http://localhost:5173 with HMR
```

## Project layout (critical files)

```
main.go                                    # entry point, flag parsing, goroutine wiring
internal/metrics/types.go                  # ALL metric structs — edit here to add fields
internal/metrics/collector.go              # ticker loop, delta calculation, fan-out subscriptions
internal/metrics/cpu.go                    # gopsutil cpu collection
internal/metrics/memory.go                 # gopsutil mem/swap collection
internal/metrics/disk.go                   # gopsutil disk partitions + IO counters
internal/metrics/network.go                # gopsutil net IO counters
internal/ncdu/types.go                     # DirEntry, ScanResult, ScanStatus
internal/ncdu/installer.go                 # auto-detect distro (apt/yum/pacman) + install ncdu
internal/ncdu/runner.go                    # background ncdu subprocess, cancel, IsReady()
internal/ncdu/parser.go                    # recursive ncdu JSON → DirEntry tree
internal/ws/hub.go                         # WebSocket hub: register/unregister/broadcast
internal/ws/client.go                      # WebSocket client: read/write pumps, ping-pong
internal/server/server.go                  # HTTP mux, basicAuthMiddleware, loggingMiddleware
internal/server/handlers.go                # all REST + WebSocket handlers
web/                                       # Go embed target — DO NOT edit directly; built by Vite
frontend/src/types/metrics.ts              # TypeScript mirrors of Go metric structs
frontend/src/types/ncdu.ts                 # DirEntry, ScanResult, ScanStatus (TS)
frontend/src/types/api.ts                  # ServerInfo, WSMessage (TS)
frontend/src/store/index.ts                # Zustand store — snapshot, history, ncdu, connection
frontend/src/hooks/useWebSocket.ts         # WS lifecycle + reconnect
frontend/src/hooks/useServerInfo.ts        # GET /api/info on mount
frontend/src/hooks/useNcduScan.ts          # scan/cancel/fetchStatus actions
frontend/src/lib/thresholdColor.ts         # getThresholdColor / getThresholdHex
frontend/src/lib/formatBytes.ts            # formatBytes(n) → "1.2 MB"
frontend/src/components/charts/HalfGauge.tsx        # Chart.js half-ring gauge
frontend/src/components/charts/RollingLineChart.tsx  # 60-point rolling line
frontend/src/components/metrics/CpuSection.tsx       # CPU card
frontend/src/components/metrics/MemorySection.tsx    # Memory card
frontend/src/components/metrics/SwapSection.tsx      # Swap card
frontend/src/components/metrics/NetworkSection.tsx   # Network chart
frontend/src/components/metrics/NetworkTable.tsx     # Interface table
frontend/src/components/metrics/DiskSection.tsx      # Disk cards grid
frontend/src/components/metrics/DiskIOSection.tsx    # Disk I/O chart
frontend/src/components/storage/StorageAnalyzer.tsx  # ncdu UI
frontend/src/pages/DashboardPage.tsx                 # / route — assembles all sections
frontend/src/App.tsx                                 # BrowserRouter + hooks wiring
frontend/tailwind.config.ts                          # design tokens → Tailwind classes
frontend/vite.config.ts                              # outDir: ../web, proxy to :8080
```

## Architecture in one paragraph

`main.go` starts three goroutines: `collector.Run` (ticks every 2s, collects metrics, fans out to subscribers), `hub.Run` (WebSocket hub event loop), and a bridge goroutine that reads from the collector's subscription channel and calls `hub.Broadcast`. The HTTP server (stdlib `net/http`) handles REST endpoints and upgrades `/ws` connections. All web assets live in `web/` and are embedded at compile time. There are no external services, no databases, no configuration files.

## Data flow

```
gopsutil → collector.collect() → Snapshot struct
         → fan-out channel → bridge goroutine → hub.Broadcast(JSON)
                                               → each WebSocket client
         → collector.Latest() ← GET /api/metrics (REST fallback)
```

ncdu flow:
```
POST /api/ncdu/scan → runner.Start(path)
  → exec ncdu -1 -x -o - <path>
  → parser.Parse(stdout) → DirEntry tree
  → runner.result.Status = "done"
  → next WS push: ncdu_ready: true
  → browser calls GET /api/ncdu/status → renders tree
```

## API endpoints

| Method   | Path               | Handler              |
|----------|--------------------|----------------------|
| GET      | `/`                | static file server   |
| GET      | `/api/info`        | handleInfo           |
| GET/PUT  | `/api/interval`    | handleInterval       |
| GET      | `/api/metrics`     | handleMetrics        |
| POST     | `/api/ncdu/scan`   | handleNcduScan       |
| DELETE   | `/api/ncdu/scan`   | handleNcduScan       |
| GET/PUT  | `/api/ncdu/cache`  | handleNcduCache      |
| GET      | `/api/ncdu/status` | handleNcduStatus     |
| GET      | `/ws`              | handleWS             |

## Key invariants — do not break these

- **Single binary**: every asset must be embedded; do not read files from disk at runtime.
- **No external services**: the binary is the only process required (besides ncdu which it installs).
- **Thread safety**: `Collector` and `Runner` use `sync.RWMutex`. Any new shared state must be protected.
- **Context cancellation**: all goroutines must respect `ctx.Done()` for clean shutdown.
- **Delta rates**: disk I/O and network bps are *rates* computed from successive counter deltas, not raw cumulative values. The previous counters are stored in `Collector.prevDiskIO` and `Collector.prevNet`.

## How to add a new metric

1. Add field to the right struct in `internal/metrics/types.go`.
2. Populate it in the relevant `collect*()` function.
3. Mirror the field in `frontend/src/types/metrics.ts`.
4. Subscribe to the field in the relevant section component via a narrow Zustand selector.
5. Use Tailwind token classes and `getThresholdHex()` from `docs/DESIGN_SYSTEM.md` — never hardcode hex.

## How to add a new API endpoint

1. Add handler method to `internal/server/handlers.go`.
2. Register route in `internal/server/server.go` `registerRoutes()`.
3. Update the API table in `README.md`.

## Frontend conventions

- All colors via Tailwind token classes (`text-accent-green`, `bg-bg-card`, etc.) defined in `tailwind.config.ts`. Never inline hex in JSX.
- Use `getThresholdHex(pct)` from `src/lib/thresholdColor.ts` when a hex string is required (Chart.js dataset colors).
- Color thresholds: green < 60%, yellow 60–84%, red ≥ 85% (constants in `src/constants/thresholds.ts`).
- Chart.js instances live in `useRef`. Update imperatively with `chart.update('none')` — never put chart data in React state.
- Zustand selectors must be narrow — never `useStore(s => s.snapshot)` directly. See selector patterns in `docs/DESIGN_SYSTEM.md`.
- All components: named export + `React.memo`. UI-only components in `components/ui/` are prop-only. Domain components in `components/metrics/` read from the store.

## Zustand selector patterns (critical — prevents re-render loops)

```typescript
// Primitive — Object.is comparison (safe)
const pct = useStore(s => Math.round(s.snapshot?.cpu.total_percent ?? 0))

// Array/Object — must use shallow
import { shallow } from 'zustand/shallow'
const perCore = useStore(s => s.snapshot?.cpu.per_core ?? [], shallow)

// Multiple fields — shallow on constructed object
const mem = useStore(s => ({
  percent: s.snapshot?.memory.percent ?? 0,
  used:    s.snapshot?.memory.used_bytes ?? 0,
}), shallow)

// NEVER — subscribes to whole snapshot, re-renders every 2s
const snapshot = useStore(s => s.snapshot)
```

## Testing

```bash
go test ./...               # unit tests
go test -race ./...         # with race detector (required before PR)
go vet ./...                # static analysis
make linux                  # cross-compile check

cd frontend
npm run build               # TypeScript check + Vite build (zero TS errors required)
npm run lint                # ESLint (zero errors required)
```

See `docs/TESTING.md` for the full testing guide including frontend manual checklist.

## Dependencies

Go:
- `github.com/gorilla/websocket v1.5.1` — WebSocket
- `github.com/shirou/gopsutil/v3 v3.24.1` — system metrics

Frontend (see `frontend/package.json`):
- `react` + `react-dom` v18, `react-router-dom` v6
- `zustand` v4 + `immer` v10
- `chart.js` v4 + `react-chartjs-2` v5
- `tailwindcss` v3, `vite` v5

Do not add new Go dependencies without strong justification. Binary size should stay under ~15 MB.
Do not add new npm dependencies without updating `README.md` and this file.

## Common mistakes to avoid

- Do not call `cpu.Percent()` with a non-zero interval in the hot path — it blocks. Use `0` (non-blocking) and rely on the collector's interval for timing.
- Do not store `ScanResult.Root` (the full DirEntry tree) in the WS broadcast — it can be megabytes. The WS message only carries `ncdu_ready: true`; the client fetches `/api/ncdu/status` separately.
- Do not register new middleware in `server.go` without updating `CONTRIBUTING.md`.
- `getUptime()` reads `/proc/uptime` — it returns `"unknown"` on macOS/Windows (expected in dev).

## Keeping README.md up-to-date

`README.md` is the public face of this project on GitHub. Keep it in sync with any change that affects:

- **API endpoints** — mirror the table in `CLAUDE.md` → `README.md`
- **Flags / CLI options** — `--addr`, `--user`, `--password`, `--interval`
- **Build targets** — new `make` targets or cross-compile targets
- **Features** — new metrics, new UI sections, new behaviors
- **Dependencies** — added/removed Go modules

When in doubt, update `README.md` in the same commit as the code change. Never let the README describe a state of the project that no longer exists.

## Further reading

- `docs/ARCHITECTURE.md` — detailed component diagram and concurrency model
- `docs/DESIGN_SYSTEM.md` — CSS tokens, color thresholds, component patterns
- `docs/TESTING.md` — unit test patterns and manual test checklist
- `CONTRIBUTING.md` — PR process and code style rules
