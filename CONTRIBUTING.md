# Contributing to QuickVPS

Thank you for your interest in contributing. QuickVPS is a small, focused tool — contributions that keep it simple and self-contained are the most welcome.

## Table of Contents

- [Philosophy](#philosophy)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Philosophy

QuickVPS has three design principles that govern every decision:

1. **Single binary.** No config files, no sidecars, no daemons required. Everything — web assets, dependencies — compiles into one executable. If a change requires an additional file on disk at runtime, reconsider the approach.

2. **Zero external runtime dependencies.** The binary should run on a fresh Linux VPS with nothing installed except `ncdu` (which the app installs automatically). Avoid adding dependencies that require system libraries.

3. **Minimal complexity.** This is a monitoring tool, not a platform. Reject changes that add abstraction layers for hypothetical future needs. The right amount of code is the minimum that solves the current problem correctly.

---

## Getting Started

### Prerequisites

- Go 1.21 or newer
- `make`
- A Linux target for integration testing (or a VM)

### Setup

```bash
git clone https://github.com/webmonaz/quickvps
cd quickvps
go mod download
make build
```

### Run locally

```bash
# Start with auth disabled (development only)
./quickvps

# Start with auth enabled
./quickvps --password=dev
```

Open `http://localhost:8080`.

---

## Development Workflow

### Project layout

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before making structural changes. The three-layer separation (metrics collection → WebSocket hub → HTTP server) must be maintained.

### Making changes

```bash
# Build and run after every change
make build && ./quickvps --password=dev

# Verify cross-compile still works before opening a PR
make linux
```

### Testing

Read [`docs/TESTING.md`](docs/TESTING.md) for the full testing guide.

```bash
# Run all unit tests
go test ./...

# Run tests with race detector (required before submitting)
go test -race ./...

# Run a specific package
go test ./internal/ncdu/...
```

There is no automated integration test suite yet — manual verification on a Linux host is expected for any change that touches `internal/ncdu/` or `internal/metrics/`.

### Adding a new metric

1. Add the field to the appropriate struct in `internal/metrics/types.go`.
2. Populate it in the relevant `collect*` function (`cpu.go`, `memory.go`, etc.).
3. The field will automatically appear in `/api/metrics` and the WebSocket stream.
4. Add rendering logic in `web/js/app.js` and any required HTML in `web/index.html`.
5. Follow the design tokens in [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for any new UI elements.

### Adding a new API endpoint

1. Add the handler method to `internal/server/handlers.go`.
2. Register the route in `internal/server/server.go` (`registerRoutes`).
3. Document the endpoint in `README.md`'s API table.
4. Do not add new middleware without discussion — auth and logging are intentionally the only middleware layers.

### Modifying the web UI

- All styles go in `web/css/style.css`. No inline styles except dynamically computed values (widths, colors driven by data).
- All CSS values must use the design tokens defined in `:root`. Do not hardcode color hex values in HTML or JS — reference the CSS variables.
- Chart.js is loaded from CDN. Do not vendor it or add a build step.
- See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for color thresholds, spacing, and component patterns.

---

## Code Style

### Go

- Follow standard Go conventions (`gofmt`, `go vet`).
- Error strings are lowercase and do not end with punctuation (Go convention).
- Exported types and functions must have a doc comment if non-obvious.
- No `panic` in library code (`internal/`). Return errors.
- Prefer returning concrete types over interfaces in internal packages.
- Keep functions short. If a function is more than ~50 lines, consider splitting it.

### JavaScript

- Vanilla ES6+. No frameworks, no transpilers, no `npm`.
- Each file exposes exactly one namespace on `window` (e.g., `window.GaugeHelper`, `window.ChartHelper`).
- No `var`. Use `const` by default, `let` only when reassignment is needed.
- DOM manipulation goes in `app.js`. Chart helpers stay in `gauges.js` / `charts.js`. Tree rendering stays in `ncdu.js`.

### CSS

- Use CSS custom properties (`var(--token)`) for every color, radius, and spacing value. Never write a bare hex color.
- Class names use BEM-lite: `block`, `block-element`, `block--modifier`.
- No `!important`.

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Keep the scope small.** One logical change per PR. Refactoring and feature work should be separate PRs.

3. **Ensure these pass before opening the PR:**
   ```bash
   go vet ./...
   go test -race ./...
   make linux          # cross-compile must succeed
   ```

4. **Update documentation** if you changed behavior, added an endpoint, or modified the data schema. At minimum update `README.md`.

5. **Write a clear PR description** that explains:
   - What problem this solves
   - What approach was taken and why
   - How to test it manually

6. PRs that introduce new dependencies require extra justification. Each new import adds maintenance burden and may affect the binary size constraint.

---

## Reporting Bugs

Open a GitHub Issue with:

- The QuickVPS version (`./quickvps --version` or the git tag)
- The Linux distribution and kernel version
- Steps to reproduce
- What you expected vs. what happened
- Relevant log lines (`journalctl -u quickvps` or stderr output)

---

## Feature Requests

Open a GitHub Issue tagged `enhancement`. Describe:

- The concrete use case (not just the feature in the abstract)
- Whether it can be implemented while keeping the binary self-contained
- Whether it fits the "single binary, zero config, minimal complexity" philosophy

Features that require a database, additional processes, or config files are unlikely to be accepted. Features that add new metrics, improve the UI, or improve deployment ergonomics are welcome.
