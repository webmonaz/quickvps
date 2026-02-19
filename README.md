# QuickVPS

A single-binary Go web application that runs on any Linux VPS to monitor system resources in real-time. No dependencies, no Docker, no configuration files — drop the binary, set a password, done.

![Dashboard](docs/screenshot.png)

## Features

- **Live metrics** pushed every 2 seconds over WebSocket — CPU, RAM, Swap, Disk, Network
- **Per-core CPU bars** with usage history charts
- **Disk I/O rates** (read/write bytes per second) per device
- **Network interface rates** (recv/sent) with rolling charts
- **Storage Analyzer** — runs `ncdu` in the background, renders a collapsible directory tree in the browser. Auto-installs `ncdu` if absent (supports apt, yum, pacman)
- **Basic Auth** — one flag sets a password; no config files needed
- **Dark theme** — single dark UI with CSS variables, responsive down to mobile
- **Single binary** — all web assets are embedded via `//go:embed`; just `scp` and run

## Quick Start

### Download a pre-built binary

```bash
# Linux amd64
curl -Lo quickvps https://github.com/webmonaz/quickvps/releases/latest/download/quickvps-linux
chmod +x quickvps
./quickvps --password=secret
```

Open `http://your-server:8080` and log in with `admin` / `secret`.

### Build from source

Requires Go 1.21+.

```bash
git clone https://github.com/webmonaz/quickvps
cd quickvps
make build          # current OS/arch
make linux          # cross-compile → quickvps-linux (amd64)
make linux-arm64    # cross-compile → quickvps-linux-arm64 (e.g. Oracle Cloud free tier)
```

## Usage

```
Usage of ./quickvps:
  -addr string
        Listen address (default ":8080")
  -interval duration
        Metrics push interval (default 2s)
  -password string
        Basic auth password (empty = auth disabled)
  -user string
        Basic auth username (default "admin")
```

Environment variables as fallback (flags take precedence):

| Variable            | Flag         |
|---------------------|--------------|
| `QUICKVPS_USER`     | `--user`     |
| `QUICKVPS_PASSWORD` | `--password` |

If `--password` is empty, authentication is **disabled** and a warning is logged.

## Deploy with systemd

```bash
# On your local machine — cross-compile and copy
make install HOST=root@1.2.3.4

# Or manually on the VPS
scp quickvps-linux root@1.2.3.4:/usr/local/bin/quickvps
scp scripts/quickvps.service root@1.2.3.4:/etc/systemd/system/

# On the VPS
systemctl daemon-reload
systemctl enable --now quickvps
```

Edit `/etc/systemd/system/quickvps.service` to change credentials, then `systemctl restart quickvps`.

Alternatively, run the bundled installer script on the VPS after copying the binary:

```bash
bash scripts/install.sh quickvps-linux
```

## API Reference

All endpoints require Basic Auth when `--password` is set.

| Method   | Path               | Description                              |
|----------|--------------------|------------------------------------------|
| `GET`    | `/`                | Dashboard HTML (embedded)                |
| `GET`    | `/api/info`        | Hostname, OS, arch, uptime               |
| `GET`    | `/api/metrics`     | Current snapshot (one-shot JSON)         |
| `POST`   | `/api/ncdu/scan`   | Start storage scan `{"path":"/"}`        |
| `GET`    | `/api/ncdu/status` | Poll scan status / result                |
| `DELETE` | `/api/ncdu/scan`   | Cancel running scan                      |
| `GET`    | `/ws`              | WebSocket — server pushes snapshot every interval |

WebSocket message shape:

```json
{
  "type": "metrics",
  "snapshot": { ... },
  "ncdu_ready": false
}
```

When `ncdu_ready` is `true`, the UI automatically fetches `/api/ncdu/status`.

## Project Structure

```
quickvps/
├── main.go                    # Entry point, flag parsing, goroutine wiring
├── go.mod
├── Makefile
├── internal/
│   ├── metrics/               # System metrics collection (gopsutil)
│   │   ├── types.go           # Snapshot, CPUMetrics, MemMetrics, …
│   │   ├── collector.go       # Ticker loop, delta I/O & net rates, fan-out
│   │   ├── cpu.go
│   │   ├── memory.go
│   │   ├── disk.go
│   │   └── network.go
│   ├── ncdu/                  # Storage analyzer engine
│   │   ├── types.go           # DirEntry, ScanResult, ScanStatus
│   │   ├── installer.go       # Auto-detect distro + install ncdu
│   │   ├── runner.go          # Background subprocess, cancel, status
│   │   └── parser.go          # Recursive ncdu JSON → DirEntry tree
│   ├── ws/                    # WebSocket hub
│   │   ├── hub.go             # Register / unregister / broadcast
│   │   └── client.go          # Read/write pumps, ping-pong keepalive
│   └── server/                # HTTP layer
│       ├── server.go          # Mux, auth middleware, logging middleware
│       └── handlers.go        # REST + WebSocket handlers
├── web/                       # Embedded assets (//go:embed web)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js             # WS client + dashboard orchestration
│       ├── gauges.js          # Chart.js half-ring gauge helpers
│       ├── charts.js          # 60-point rolling line chart helpers
│       └── ncdu.js            # Collapsible directory tree renderer
├── scripts/
│   ├── quickvps.service       # systemd unit
│   └── install.sh             # Binary copy + systemd enable
└── docs/                      # Extended documentation
    ├── ARCHITECTURE.md
    ├── DESIGN_SYSTEM.md
    └── TESTING.md
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [`github.com/gorilla/websocket`](https://github.com/gorilla/websocket) | WebSocket server |
| [`github.com/shirou/gopsutil/v3`](https://github.com/shirou/gopsutil) | Cross-platform system metrics |

The web UI uses [Chart.js](https://www.chartjs.org/) loaded from CDN — no build step required.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
