# Architecture

## Overview

QuickVPS is structured as a single Go process with three concurrent subsystems wired together in `main.go`. There are no databases, no message queues, and no external services.

```
┌─────────────────────────────────────────────────────────────────┐
│                          main.go                                 │
│                                                                  │
│   ┌──────────────┐    fan-out    ┌──────────────────────────┐   │
│   │  Collector   │ ─────chan──▶  │  Bridge goroutine         │   │
│   │  (ticker)    │               │  snap → JSON → Broadcast  │   │
│   └──────┬───────┘               └───────────┬──────────────┘   │
│          │ Latest()                          │ Broadcast()       │
│          ▼                                   ▼                   │
│   ┌──────────────────────────────────────────────────────┐      │
│   │                    HTTP Server                        │      │
│   │                                                       │      │
│   │  GET /api/metrics ──▶ collector.Latest()             │      │
│   │  GET /api/info    ──▶ os/runtime                     │      │
│   │  POST /api/ncdu/* ──▶ Runner                         │      │
│   │  GET  /ws         ──▶ ws.Client ◀──── hub.Broadcast  │      │
│   │  GET  /           ──▶ embedded web/                  │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                  │
│   ┌──────────────┐                                               │
│   │    Runner    │  exec ncdu → parser.Parse → DirEntry tree    │
│   └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### `internal/metrics` — System Metrics

**Responsibility:** Collect raw system data from the OS and compute derived rates.

#### `Collector`

The central component. It owns:
- A ticker that fires every `interval` (default 2 s)
- The previous disk I/O counters (`prevDiskIO map[string]diskIOCounter`)
- The previous network counters (`prevNet map[string]netCounter`)
- The latest `*Snapshot` (guarded by `sync.RWMutex`)
- A slice of subscriber channels (`subs []chan *Snapshot`)

On each tick, `collect()` calls the four sub-collectors, computes delta rates, builds a `Snapshot`, stores it as `latest`, and fans it out to all subscribers.

**Delta rate calculation:**

Both disk I/O and network metrics are cumulative counters from the OS. QuickVPS converts them to per-second rates:

```
rate = (current_counter - previous_counter) / elapsed_seconds
```

`elapsed` is computed from `time.Now()` vs the stored `prevTime`, so the rate is accurate even if the ticker fires slightly late.

**Warm-up:** `NewCollector` calls `cpu.Percent(200ms, false)` synchronously before starting the ticker. Without this, the first CPU reading is always 0% because gopsutil requires two samples to compute a percentage.

#### CPU (`cpu.go`)

Calls `cpu.Percent(0, false)` (non-blocking, returns delta from last call) and `cpu.Percent(0, true)` for per-core percentages. Also reads `cpu.Info()` for model name and frequency. The `0` duration means "use the elapsed time since the last call" — do not pass a non-zero duration here or it will block the ticker.

#### Memory (`memory.go`)

Reads `mem.VirtualMemory()` and `mem.SwapMemory()` from gopsutil. Maps to `MemMetrics` and `SwapMetrics`. The `Cached` and `Buffers` fields are Linux-specific; they will be zero on macOS.

#### Disk (`disk.go`)

Enumerates partitions with `disk.Partitions(false)` (physical only). Deduplicates by device path to avoid double-counting bind mounts. Reads usage per mountpoint. Also reads `disk.IOCounters()` for the delta calculation.

#### Network (`network.go`)

Reads `net.IOCounters(true)` (per-interface). Computes recv/sent bps from successive counter deltas.

---

### `internal/ncdu` — Storage Analyzer

**Responsibility:** Run `ncdu` as a subprocess, parse its output, expose the result.

#### `Runner`

Holds a single `ScanResult` and a `context.CancelFunc`. Only one scan can run at a time; starting a new scan cancels the previous one.

State machine:
```
idle ──▶ running ──▶ done
                └──▶ error
           ▲
      (cancel → idle)
```

#### `parser.go` — ncdu JSON format

ncdu's `-o -` flag emits a JSON array:

```json
[1, 0, {"progname":"ncdu",...}, [rootDir, [child1, child2, ...]]]
```

Each entry is either:
- A **file**: `{"name":"x","asize":N,"dsize":N}` (JSON object)
- A **directory**: `[{meta}, child, child, ...]` (JSON array, first element is metadata)

The parser recursively unmarshals into `[]json.RawMessage`, inspects whether element 0 is an object or array to distinguish file vs directory, then recurses. Children are sorted largest-first by `dsize`.

#### `installer.go` — Auto-install

Reads `/etc/os-release` and matches `ID` or `ID_LIKE` to choose the package manager. Falls back to `apt-get` on unknown distros.

---

### `internal/ws` — WebSocket Hub

**Responsibility:** Manage connected browser clients and broadcast messages to all of them.

#### `Hub`

A goroutine (started in `main.go` via `hub.Run(ctx)`) that serializes all client registration/unregistration events. The `Broadcast` method sends to the internal channel without blocking the caller — it drops the message if the channel is full (back-pressure protection).

#### `Client`

Each `/ws` connection spawns two goroutines: `readPump` and `writePump`. The read pump exists only to handle pong responses (for keepalive) and detect disconnection. The write pump sends queued messages and sends pings on a timer (`pingPeriod = 54s`).

A client's `send` channel has a buffer of 64 messages. If the client is slow and the buffer fills, the hub drops subsequent messages (non-blocking send). The client is not kicked — it will catch up or disconnect naturally when the ping times out.

---

### `internal/server` — HTTP Layer

**Responsibility:** Route requests, enforce authentication, wire handlers to subsystems.

#### Middleware chain (outermost → innermost)

```
basicAuthMiddleware → loggingMiddleware → mux
```

Auth middleware is only applied when `--password` is non-empty. If disabled, a warning is logged at startup. The middleware uses stdlib `r.BasicAuth()` — credentials are validated with a simple string comparison (no constant-time comparison, since this is a single-user tool on a trusted network).

#### Static files

`web/` is embedded via `//go:embed web` in `main.go` and passed to `server.New()` as `embed.FS`. The server creates a sub-filesystem rooted at `web/` using `fs.Sub`, so requests for `/css/style.css` map to `web/css/style.css` inside the embedded FS.

---

### `frontend/` — React UI Source

React 18 + TypeScript + TailwindCSS single-page application built with Vite. Source lives in `frontend/src/`; Vite emits production assets directly into `web/` (the Go embed target). There is **no runtime dependency on Node.js** — the Go binary embeds the compiled output.

Key layers:

- **`src/store/index.ts`** — Zustand store (Immer + subscribeWithSelector). Holds the latest `Snapshot`, 60-point rolling history arrays for network and disk I/O, ncdu scan state, and connection status.
- **`src/hooks/useWebSocket.ts`** — opens the WS connection, dispatches `setSnapshot` on every message, calls `onNcduReady` callback when `ncdu_ready: true` arrives, auto-reconnects after 3 s.
- **`src/hooks/useServerInfo.ts`** — fetches `/api/info` once on mount.
- **`src/components/charts/`** — `HalfGauge` and `RollingLineChart` hold Chart.js instances in `useRef`. Updates are imperative mutations (`chart.data.datasets[0].data = [...]; chart.update('none')`); the canvas DOM node never re-renders.
- **`src/components/metrics/`** — each section selects only the fields it needs from the store via narrow Zustand selectors to prevent unnecessary re-renders on each 2 s push.

All dashboard updates are driven by WS messages; the REST endpoints are only used for initial page load (`/api/info`) and ncdu result fetch (`/api/ncdu/status`).

**Dev workflow:**
```
Terminal 1: ./quickvps --password=dev        # Go backend on :8080
Terminal 2: cd frontend && npm run dev       # Vite HMR on :5173
```
Vite proxies `/api` and `/ws` to `:8080`, so the dev server is a full live preview.

**Production build:**
```bash
cd frontend && npm run build   # or: make frontend
```
Emits hashed bundles to `web/assets/` and `web/index.html`, then `make linux` embeds them into the binary.

---

## Concurrency Model

```
goroutine 1: collector.Run(ctx)       — ticker, collects, fans out
goroutine 2: hub.Run(ctx)             — serializes WS client registration
goroutine 3: bridge                   — collector.Subscribe() → hub.Broadcast()
goroutine 4: httpServer               — stdlib HTTP (internally spawns per-request goroutines)
goroutine N: ws.Client.readPump()     — one per connected browser
goroutine N: ws.Client.writePump()    — one per connected browser
goroutine M: ncdu.Runner.run()        — one at a time, when a scan is running
```

All goroutines are started in `main.go` and receive the root `context.Context`. Cancelling this context (via `Ctrl-C` or `SIGTERM`) causes all goroutines to return cleanly within the 5-second shutdown timeout.

**Shared state and its guards:**

| State | Owner | Guard |
|-------|-------|-------|
| `Collector.latest` | Collector | `sync.RWMutex` |
| `Collector.prevDiskIO` / `prevNet` | Collector | same mutex (written inside `collect()`, only called from the ticker goroutine) |
| `Collector.subs` | Collector | `subsMu sync.Mutex` |
| `Hub.clients` | Hub | `sync.RWMutex` |
| `Runner.result` | Runner | `sync.RWMutex` |

---

## Embedding Web Assets

```go
//go:embed web
var webFS embed.FS
```

This directive in `main.go` embeds the entire `web/` directory tree into the binary at compile time. The server receives this as `embed.FS` and creates a sub-filesystem:

```go
webSub, _ := fs.Sub(s.webFS, "web")
fileServer := http.FileServer(http.FS(webSub))
```

The result is that browser requests for `/css/style.css` serve `web/css/style.css` from the embedded FS, with no disk I/O at runtime.

**Consequence for Go:** every change to `web/` (the Vite build output) requires a recompile. For UI development use `npm run dev` inside `frontend/` — the Vite dev server proxies the Go API and serves the app with HMR. Run `make frontend && make build` to cut a new binary with updated assets.

---

## Startup Sequence

```
1. Parse flags / env vars
2. Log warnings (no password, etc.)
3. metrics.NewCollector(interval)
     └── cpu.Percent(200ms)   ← blocking warm-up
     └── collectDiskIO()      ← capture initial counters
     └── collectNet()         ← capture initial counters
4. ws.NewHub()
5. ncdu.NewRunner()
6. go collector.Run(ctx)
7. go hub.Run(ctx)
8. go bridge goroutine
9. server.New(...)            ← register routes
10. go httpServer.ListenAndServe()
11. block on ctx.Done()
12. graceful HTTP shutdown (5s timeout)
```

---

## Error Handling Philosophy

- Metric collection errors are silently swallowed and result in zero/empty values in the snapshot. A failed `disk.Partitions()` call means the `disks` array is empty — no crash, no alert.
- The ncdu runner propagates errors into `ScanResult.Error` and sets `Status = "error"`. The browser shows the error message.
- HTTP handler errors return JSON `{"error": "..."}` with an appropriate status code.
- Fatal errors (e.g., failure to bind the listen address) call `log.Fatalf` and exit.
