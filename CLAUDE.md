# QuickVPS — Agent Guide

This file is loaded automatically by Claude Code at the start of every session.
It gives AI agents the context needed to work on this codebase without re-reading everything.

## What this project is

A single-binary Go web application that monitors Linux VPS resources (CPU, RAM, Swap, Disk, Network) and includes an `ncdu`-powered Storage Analyzer. All web assets are embedded in the binary via `//go:embed`. Protected by HTTP Basic Auth. No config files, no database, no external runtime dependencies.

## Build & run

```bash
go build -o quickvps .          # build for current OS
make linux                       # cross-compile → quickvps-linux (amd64)
make linux-arm64                 # cross-compile → quickvps-linux-arm64
./quickvps --password=dev        # run locally
```

Always verify `make linux` still compiles after any change — Linux is the primary deployment target.

## Project layout (critical files)

```
main.go                          # entry point, flag parsing, goroutine wiring
internal/metrics/types.go        # ALL metric structs — edit here to add fields
internal/metrics/collector.go    # ticker loop, delta calculation, fan-out subscriptions
internal/metrics/cpu.go          # gopsutil cpu collection
internal/metrics/memory.go       # gopsutil mem/swap collection
internal/metrics/disk.go         # gopsutil disk partitions + IO counters
internal/metrics/network.go      # gopsutil net IO counters
internal/ncdu/types.go           # DirEntry, ScanResult, ScanStatus
internal/ncdu/installer.go       # auto-detect distro (apt/yum/pacman) + install ncdu
internal/ncdu/runner.go          # background ncdu subprocess, cancel, IsReady()
internal/ncdu/parser.go          # recursive ncdu JSON → DirEntry tree
internal/ws/hub.go               # WebSocket hub: register/unregister/broadcast
internal/ws/client.go            # WebSocket client: read/write pumps, ping-pong
internal/server/server.go        # HTTP mux, basicAuthMiddleware, loggingMiddleware
internal/server/handlers.go      # all REST + WebSocket handlers
web/index.html                   # single-page dashboard
web/css/style.css                # all styles; CSS variables defined in :root
web/js/app.js                    # WS client, snapshot rendering, ncdu orchestration
web/js/gauges.js                 # Chart.js half-ring gauge helpers → window.GaugeHelper
web/js/charts.js                 # 60-point rolling line chart helpers → window.ChartHelper
web/js/ncdu.js                   # collapsible tree renderer → window.NcduRenderer
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
| GET      | `/api/metrics`     | handleMetrics        |
| POST     | `/api/ncdu/scan`   | handleNcduScan       |
| DELETE   | `/api/ncdu/scan`   | handleNcduScan       |
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
3. Render it in `web/js/app.js` `renderSnapshot()` and add HTML to `web/index.html`.
4. Use design tokens from `docs/DESIGN_SYSTEM.md` — never hardcode hex colors in JS or HTML.

## How to add a new API endpoint

1. Add handler method to `internal/server/handlers.go`.
2. Register route in `internal/server/server.go` `registerRoutes()`.
3. Update the API table in `README.md`.

## CSS/JS conventions

- All colors via `var(--token)` from `:root` in `style.css`. Never inline hex.
- Color thresholds: green < 60%, yellow 60–84%, red ≥ 85%.
- Each JS file exposes exactly one `window.*` namespace. No cross-file direct function calls.
- No `npm`, no build step, no transpiler. Chart.js from CDN only.

## Testing

```bash
go test ./...               # unit tests
go test -race ./...         # with race detector (required before PR)
go vet ./...                # static analysis
make linux                  # cross-compile check
```

See `docs/TESTING.md` for manual integration test checklist.

## Dependencies

- `github.com/gorilla/websocket v1.5.1` — WebSocket
- `github.com/shirou/gopsutil/v3 v3.24.1` — system metrics

Do not add new Go dependencies without strong justification. The binary size should stay under ~15 MB.

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
