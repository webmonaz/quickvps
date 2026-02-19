# Testing Guide

QuickVPS has two layers of testing: automated unit tests and a manual integration checklist. Both are required before merging a PR.

---

## Automated Tests

### Running tests

```bash
# All packages
go test ./...

# With race detector (required before every PR)
go test -race ./...

# Verbose output
go test -v ./...

# Single package
go test ./internal/ncdu/...
go test ./internal/metrics/...

# With coverage report
go test -cover ./...
go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out
```

### What to test

#### `internal/ncdu` — highest priority

The ncdu parser is pure logic with no OS dependencies — it must have unit tests covering all format variations.

**`internal/ncdu/parser_test.go`** should cover:

```go
// Minimal valid ncdu output
func TestParse_BasicTree(t *testing.T) { ... }

// Single file at root (no children)
func TestParse_SingleFile(t *testing.T) { ... }

// Deeply nested directories
func TestParse_DeepNesting(t *testing.T) { ... }

// Children are sorted largest dsize first
func TestParse_SortOrder(t *testing.T) { ... }

// Malformed JSON returns an error, not a panic
func TestParse_MalformedInput(t *testing.T) { ... }

// Empty array at top level
func TestParse_EmptyInput(t *testing.T) { ... }

// Mixed files and directories at same level
func TestParse_MixedChildren(t *testing.T) { ... }
```

Test helper — minimal valid ncdu output string:

```go
const minimalNcdu = `[1,0,{"progname":"ncdu","progver":"2.2","timestamp":1700000000},
[{"name":"/","asize":1024,"dsize":2048},
  {"name":"file.txt","asize":512,"dsize":512}
]]`
```

**`internal/ncdu/installer_test.go`** should cover `DetectDistro`:

```go
func TestDetectDistro_Ubuntu(t *testing.T) {
    // Write a temp /etc/os-release with ID=ubuntu, verify DistroApt returned
}
func TestDetectDistro_RHEL(t *testing.T) { ... }
func TestDetectDistro_Unknown(t *testing.T) { ... }
```

Since `DetectDistro` reads `/etc/os-release` directly, use a file indirection or accept that it returns the host's actual distro in CI.

#### `internal/metrics` — delta calculation

The delta rate calculation is testable without OS calls.

**`internal/metrics/disk_test.go`**:

```go
func TestCalcDiskIO_Rate(t *testing.T) {
    prev := map[string]diskIOCounter{
        "sda": {readBytes: 1000, writeBytes: 2000},
    }
    curr := map[string]diskIOCounter{
        "sda": {readBytes: 3000, writeBytes: 4000},
    }
    result := calcDiskIO(prev, curr, 2.0) // 2 seconds elapsed
    // expect ReadBps = 1000, WriteBps = 1000
}

func TestCalcDiskIO_ZeroElapsed(t *testing.T) {
    // elapsed=0 should return nil, not divide by zero
}

func TestCalcDiskIO_NewDevice(t *testing.T) {
    // device in curr but not in prev should be skipped
}
```

**`internal/metrics/network_test.go`**: same pattern for `calcNet`.

#### `internal/ws` — hub behavior

```go
func TestHub_BroadcastToClients(t *testing.T) {
    // Create hub, register two mock clients, broadcast, assert both received
}

func TestHub_UnregisterClosesChannel(t *testing.T) {
    // Register client, unregister, verify send channel is closed
}

func TestHub_SlowClientDropsMessage(t *testing.T) {
    // Fill a client's send buffer, broadcast, verify no deadlock
}
```

#### `internal/server` — handler responses

Use `net/http/httptest` for handler tests. Do not start a real server.

```go
func TestHandleMetrics_NoData(t *testing.T) {
    // collector.Latest() returns nil → expect 503
}

func TestHandleMetrics_WithData(t *testing.T) {
    // collector.Latest() returns a Snapshot → expect 200 + valid JSON
}

func TestHandleNcduScan_POST(t *testing.T) {
    // POST with {"path":"/"} → expect 202
}

func TestHandleNcduScan_InvalidMethod(t *testing.T) {
    // PUT → expect 405
}

func TestBasicAuth_MissingCredentials(t *testing.T) {
    // No Authorization header → expect 401 with WWW-Authenticate header
}

func TestBasicAuth_WrongPassword(t *testing.T) {
    // Wrong password → expect 401
}

func TestBasicAuth_Correct(t *testing.T) {
    // Correct credentials → expect handler to run
}
```

### Test conventions

- Test files use `package X_test` (black-box testing) unless testing unexported functions.
- Use `t.Helper()` in assertion helpers.
- Use table-driven tests (`[]struct{ name, input, want }`) for parsers and calculators.
- Never sleep in tests. Use channels or mocks for timing-dependent code.
- Mock external dependencies by passing interfaces or function values, not by monkey-patching.

Example table-driven test:

```go
func TestCalcDiskIO(t *testing.T) {
    tests := []struct {
        name    string
        prev    map[string]diskIOCounter
        curr    map[string]diskIOCounter
        elapsed float64
        want    []DiskIOMetrics
    }{
        {
            name:    "basic rate",
            prev:    map[string]diskIOCounter{"sda": {readBytes: 0}},
            curr:    map[string]diskIOCounter{"sda": {readBytes: 2000}},
            elapsed: 2.0,
            want:    []DiskIOMetrics{{Device: "sda", ReadBps: 1000}},
        },
        {
            name:    "zero elapsed returns nil",
            elapsed: 0,
            want:    nil,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := calcDiskIO(tt.prev, tt.curr, tt.elapsed)
            // assert
        })
    }
}
```

---

## Manual Integration Checklist

Run this checklist on a real Linux host (or VM) before merging any change to `internal/ncdu/`, `internal/metrics/`, or `web/`.

### Setup

```bash
# Cross-compile
make linux

# Copy to test server
scp quickvps-linux user@test-vps:/tmp/quickvps-test
ssh user@test-vps "chmod +x /tmp/quickvps-test && /tmp/quickvps-test --password=test &"
```

### Startup

- [ ] Binary starts without errors
- [ ] `WARNING: No password set` is printed when `--password` is omitted
- [ ] Browser shows the login dialog when `--password` is set
- [ ] Wrong password returns HTTP 401
- [ ] `/api/info` returns `{"hostname":..., "os":"linux", "arch":..., "uptime":"..."}` with a real uptime string (not "unknown")

### Dashboard — Metrics

- [ ] CPU gauge updates every ~2 seconds
- [ ] CPU percentage roughly matches `top` or `htop`
- [ ] Per-core bars are visible and move
- [ ] Memory gauge shows correct used % vs `free -h`
- [ ] Memory bar breakdown shows used/cache/buffer segments
- [ ] Swap gauge is correct (or shows 0% if no swap configured)
- [ ] Network chart shows recv/sent activity when downloading something (e.g. `curl http://speedtest...`)
- [ ] Disk I/O chart shows read/write activity during disk access (e.g. `dd if=/dev/zero of=/tmp/test bs=1M count=100`)
- [ ] Disk cards show correct mountpoints, filesystem types, and usage percentages vs `df -h`
- [ ] All disk cards update when usage changes

### WebSocket

- [ ] Open browser DevTools → Network → WS → confirm frames arrive every ~2 seconds
- [ ] Frame payload is valid JSON with `{"type":"metrics","snapshot":{...},"ncdu_ready":false}`
- [ ] Disconnect network → red banner appears ("WebSocket disconnected")
- [ ] Reconnect network → banner disappears, metrics resume within 3 seconds

### Storage Analyzer

- [ ] Scan button triggers POST `/api/ncdu/scan`
- [ ] Spinner appears while scanning
- [ ] If `ncdu` is not installed, it gets installed automatically (test on a fresh distro)
- [ ] Scan completes and directory tree renders
- [ ] Top-level directories are expanded; deeper levels are collapsed
- [ ] Clicking a collapsed directory expands it and shows children
- [ ] Clicking an expanded directory collapses it
- [ ] Size and percentage values are correct (compare root's total size with `du -sh /`)
- [ ] Cancel button stops an in-progress scan
- [ ] Starting a second scan while one is running cancels the first

### Deployment

- [ ] `bash scripts/install.sh quickvps-linux` installs binary and starts systemd service
- [ ] `systemctl status quickvps` shows `active (running)`
- [ ] `journalctl -u quickvps` shows startup log lines
- [ ] `systemctl restart quickvps` restarts cleanly
- [ ] After reboot, service starts automatically (`systemctl is-enabled quickvps` → `enabled`)

### Cross-compile check

```bash
make linux        # GOOS=linux GOARCH=amd64
make linux-arm64  # GOOS=linux GOARCH=arm64
```

Both must complete without errors. Always run this before opening a PR, even for UI-only changes.

---

## Frontend Tests

The React frontend (`frontend/`) uses **Vite + TypeScript** — type checking is the first gate.

### Type check + build

```bash
cd frontend
npm run build    # tsc -b && vite build — zero tolerance for TS errors
npm run lint     # ESLint with react-hooks/exhaustive-deps: error
```

Both must pass before opening a PR that touches `frontend/`.

### Unit tests (Phase 5 — planned)

When Vitest is added, cover:

- `src/lib/formatBytes.ts` — boundary values (0, 1023, 1024, 1024³)
- `src/lib/thresholdColor.ts` — boundary values (59, 60, 84, 85)
- `src/store/index.ts` — `setSnapshot` correctly pushes to history arrays

### Component tests (Phase 5 — planned)

React Testing Library will cover:

- `ProgressBar` — renders correct width and color class for each threshold zone
- `HalfGauge` — canvas is mounted; Chart.js `update` is called with new data on re-render
- `NcduTreeNode` — lazy render: children absent until first click; collapse/expand toggle

### Manual UI checklist

Before merging any `frontend/` change, verify in the browser (use `npm run dev` against a running Go backend):

- [ ] All three gauges (CPU, Memory, Swap) render and animate on each tick
- [ ] Per-core CPU bars update
- [ ] Network and Disk I/O rolling charts scroll continuously
- [ ] Network interfaces table populates
- [ ] Disk cards show correct usage and I/O rates
- [ ] Storage Analyzer: scan triggers spinner → tree renders on completion → cancel works
- [ ] NcduTree: top 2 levels pre-expanded; deeper levels expand on click (lazy render)
- [ ] WebSocket disconnect → red banner appears within 3 s
- [ ] WebSocket reconnect → banner disappears, metrics resume
- [ ] Header shows hostname and OS from `/api/info`

---

## CI (future)

When a CI pipeline is added (Phase 5), the minimum required checks are:

```yaml
- go vet ./...
- go test -race ./...
- cd frontend && npm ci && npm run build && npm run lint
- GOOS=linux GOARCH=amd64 go build -o /dev/null .
- GOOS=linux GOARCH=arm64 go build -o /dev/null .
```

The integration checklist cannot be automated without a Linux VM runner — it remains a manual step.
