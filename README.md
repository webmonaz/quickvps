# QuickVPS

A single-binary Go web application that runs on any Linux VPS to monitor system resources in real-time. No dependencies, no Docker, no configuration files — drop the binary, set a password, done.

![Dashboard](docs/screenshot.png)

## Features

- **Live metrics** pushed every 2 seconds over WebSocket — CPU, RAM, Swap, Disk, Network
- **Per-core CPU bars** with usage history charts
- **Disk I/O rates** (read/write bytes per second) per device
- **Network interface rates** (recv/sent) with rolling charts
- **Freeze + custom update interval** — pause live updates and adjust refresh interval from Settings
- **Storage Analyzer** — runs `ncdu` in the background, renders a collapsible directory tree in the browser. Reuses recent same-path scan results (TTL configurable in Settings in seconds, default 600 seconds) to reduce server load. Auto-installs `ncdu` if absent (supports apt, yum, pacman)
- **Port Scanning + kill by port** — inspect listening TCP/UDP ports and terminate processes bound to a selected port
- **CPU Health Alerts** — long-running overload detection with warning/critical/recovery transitions, cooldown, mute window, and 30-day history
- **Telegram + Gmail notifications** — send alerts to Telegram Bot chat IDs and Gmail recipients with retry backoff
- **Firewall Audit (read-only)** — auto-detects UFW/nftables/iptables, lists inbound rules, and highlights exposed listeners
- **Package Audit (read-only)** — inventory + available updates across APT, DNF/YUM, Pacman
- **Session Auth + SQLite users** — bootstrap admin from flags, then sign in via UI session cookie
- **Server info card** — hostname, OS/arch, uptime, local/public IP, DNS resolvers, app version
- **Dark theme** — single dark UI with CSS variables, responsive down to mobile
- **Single binary** — all web assets are embedded via `//go:embed`; just `scp` and run

## Quick Start

### Download a pre-built binary

```bash
# Linux amd64
curl -Lo quickvps https://github.com/webmonaz/quickvps/releases/latest/download/quickvps-linux
chmod +x quickvps
./quickvps --auth=true --password=secret
```

Open `http://your-server:8080` and sign in with `admin` / `secret`.

### Build from source

Requires Go 1.24+ and Node.js 18+.

```bash
git clone https://github.com/webmonaz/quickvps
cd quickvps
make build          # current OS/arch
make linux          # cross-compile → quickvps-linux (amd64)
make linux-arm64    # cross-compile → quickvps-linux-arm64 (e.g. Oracle Cloud free tier)
make build-full     # build frontend then cross-compile Go for Linux amd64
```

### Frontend development

The UI lives in `frontend/` (React 18 + TypeScript + TailwindCSS + Vite). The
Vite dev server proxies `/api` and `/ws` to the Go backend at `:8080`.

```bash
# Terminal 1 — run Go backend
./quickvps --auth=true --password=dev

# Terminal 2 — run Vite dev server with HMR
cd frontend
npm install
npm run dev          # → http://localhost:5173

# Build for production (outputs to web/ for Go embed)
npm run build
npm test              # run Vitest unit tests
# or from project root:
make frontend
```

## Usage

```
Usage of ./quickvps:
  -addr string
        Listen address (default ":8080")
  -auth
        Enable user management and login (default false)
  -db string
        SQLite database path (default "quickvps.db")
  -interval duration
        Metrics push interval (default 2s)
  -password string
        Initial admin password when auth is enabled (default: admin123 when omitted)
  -user string
        Initial admin username when auth is enabled (default "admin")
```

Environment variables as fallback (flags take precedence):

| Variable            | Flag         |
|---------------------|--------------|
| `QUICKVPS_AUTH`     | `--auth`     |
| `QUICKVPS_USER`     | `--user`     |
| `QUICKVPS_PASSWORD` | `--password` |

Additional environment variable:

- `QUICKVPS_ALERTS_KEY` — base64-encoded 32-byte key used to encrypt alert secrets in SQLite (`telegram_bot_token`, `gmail_app_password`)
- `QUICKVPS_FW_HIGH_RISK_PORTS` — optional comma-separated ports overriding default high-risk firewall policy (e.g. `3306,5432,6379`)
- `QUICKVPS_FW_MEDIUM_RISK_PORTS` — optional comma-separated ports overriding default medium-risk firewall policy (e.g. `22,25`)

Auth behavior:

- `--auth=false` (default): authentication is disabled (public access).
- `--auth=true`: session authentication and user management are enabled.
- If `--auth=true` and `--password` is empty, QuickVPS bootstraps `admin/admin123` on first run and logs a warning.

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

When `--auth=true`, API and WebSocket endpoints (except `/api/auth/login`) require a valid session cookie.

| Method   | Path               | Description                              |
|----------|--------------------|------------------------------------------|
| `GET`    | `/`                | Dashboard HTML (embedded)                |
| `GET`    | `/api/info`        | Host/system info + auth/cache/app metadata |
| `POST`   | `/api/auth/login`  | Login `{"username":"admin","password":"..."}` |
| `POST`   | `/api/auth/logout` | Logout current session                    |
| `GET`    | `/api/auth/me`     | Current authenticated user                |
| `GET`    | `/api/users`       | List users (admin)                        |
| `POST`   | `/api/users`       | Create user (admin)                       |
| `PUT`    | `/api/users/:id`   | Update role/password (admin)              |
| `DELETE` | `/api/users/:id`   | Delete user (admin)                       |
| `GET`    | `/api/audit/users` | User audit trail (admin, optional `?limit=`) |
| `GET`    | `/api/interval`    | Current metrics interval                 |
| `PUT`    | `/api/interval`    | Update interval `{"interval_ms":2000}` |
| `GET`    | `/api/metrics`     | Current snapshot (one-shot JSON)         |
| `POST`   | `/api/ncdu/scan`   | Start storage scan `{"path":"/"}`        |
| `GET`    | `/api/ncdu/cache`  | Current ncdu cache TTL                   |
| `PUT`    | `/api/ncdu/cache`  | Update cache TTL `{"cache_ttl_sec":600}` |
| `GET`    | `/api/ncdu/status` | Poll scan status / result                |
| `DELETE` | `/api/ncdu/scan`   | Cancel running scan                      |
| `GET`    | `/api/ports`       | List listening TCP/UDP ports             |
| `DELETE` | `/api/ports/:port` | Kill processes bound to the port         |
| `GET`    | `/api/alerts/config` | Read alert config (read-only in public mode) |
| `PUT`    | `/api/alerts/config` | Update alert config (admin only, auth mode) |
| `GET`    | `/api/alerts/status` | Current alert runtime state |
| `GET`    | `/api/alerts/history` | Alert history (`?limit=&before_id=`) |
| `POST`   | `/api/alerts/test` | Send test alert (admin only, auth mode) |
| `POST`   | `/api/alerts/silence` | Mute alerts for minutes `{"minutes":30}` (admin only) |
| `DELETE` | `/api/alerts/silence` | Clear mute window (admin only) |
| `GET`    | `/api/firewall/status` | Firewall backend/status summary |
| `GET`    | `/api/firewall/rules` | Inbound firewall rules (read-only) |
| `GET`    | `/api/firewall/exposures` | Listener exposure/risk summary |
| `GET`    | `/api/packages/inventory` | Installed package inventory (`?limit=&q=`) |
| `GET`    | `/api/packages/updates` | Available package updates |
| `GET`    | `/ws`              | WebSocket — server pushes snapshot every interval |

Note: firewall/package audit endpoints are Linux-only and return `501 Not Implemented` on macOS/Windows.

WebSocket message shape:

```json
{
  "type": "metrics",
  "snapshot": { ... },
  "ncdu_ready": false
}
```

When `ncdu_ready` is `true`, the UI automatically fetches `/api/ncdu/status`.

`GET /api/info` returns:

- `hostname`, `os`, `arch`, `uptime`
- `auth_enabled`, `interval_ms`, `ncdu_cache_ttl_sec`
- `alerts_enabled`, `alerts_read_only`, `alerts_history_retention_days`
- `local_ip`, `public_ip`, `dns_servers`, `version`

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
│   ├── alerts/                # CPU alert evaluator + notifier + SQLite store
│   │   ├── types.go
│   │   ├── evaluator.go
│   │   ├── notifier.go
│   │   ├── service.go
│   │   ├── crypto.go
│   │   └── store.go
│   ├── firewall/              # Read-only firewall audit (ufw/nft/iptables)
│   │   └── audit.go
│   ├── packages/              # Read-only package inventory/update audit
│   │   └── audit.go
│   ├── ws/                    # WebSocket hub
│   │   ├── hub.go             # Register / unregister / broadcast
│   │   └── client.go          # Read/write pumps, ping-pong keepalive
│   ├── auth/                  # SQLite-backed users + session primitives
│   │   ├── store.go           # User migrations + CRUD + password verify
│   │   ├── session.go         # In-memory session manager
│   │   └── types.go           # User/Role types
│   └── server/                # HTTP layer
│       ├── server.go          # Mux, auth middleware, logging middleware
│       └── handlers.go        # REST + WebSocket handlers
├── frontend/                  # React 18 + TypeScript + TailwindCSS source
│   ├── src/
│   │   ├── components/        # UI, charts, layout, metrics, storage
│   │   ├── hooks/             # useWebSocket, useServerInfo, useNcduScan
│   │   ├── store/             # Zustand store with Immer
│   │   ├── types/             # TypeScript interfaces for API contracts
│   │   ├── lib/               # formatBytes, thresholdColor, chartConfig
│   │   └── pages/             # Dashboard + Alerts + Firewall + Packages + Settings
│   └── vite.config.ts         # Builds to ../web/ for Go embed
├── web/                       # Embedded assets (//go:embed web) — built by Vite
│   ├── index.html
│   └── assets/                # Hashed JS/CSS bundles
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
| [`modernc.org/sqlite`](https://pkg.go.dev/modernc.org/sqlite) | Pure-Go SQLite driver |

The web UI uses [Chart.js](https://www.chartjs.org/) bundled via Vite with `react-chartjs-2`.

**Frontend dependencies** (see `frontend/package.json`): React 18, react-router-dom, Zustand, Immer, chart.js, react-chartjs-2, TailwindCSS, Vite, Vitest, jsdom (component tests).

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
