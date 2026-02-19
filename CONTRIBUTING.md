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
- Node.js 18 or newer (`npm`)
- `make`
- A Linux target for integration testing (or a VM)

### Setup

```bash
git clone https://github.com/webmonaz/quickvps
cd quickvps
go mod download
cd frontend && npm install && cd ..
make build-full     # builds React frontend then Go binary
```

### Run locally

```bash
# Terminal 1 — Go backend
./quickvps --password=dev

# Terminal 2 — Vite dev server with HMR (proxies /api and /ws to :8080)
cd frontend && npm run dev
```

Open `http://localhost:5173` for development (HMR) or `http://localhost:8080` for the embedded build.

---

## Development Workflow

### Project layout

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before making structural changes. The three-layer separation (metrics collection → WebSocket hub → HTTP server) must be maintained.

### Making changes

```bash
# Go changes: build and run
make build && ./quickvps --password=dev

# UI changes: use the Vite dev server (no recompile needed)
cd frontend && npm run dev

# Before PR: build full stack and verify cross-compile
make build-full
make linux-arm64
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
4. Add the TypeScript type in `frontend/src/types/metrics.ts`.
5. Subscribe to the new field in the relevant section component (e.g. `CpuSection.tsx`) via a narrow Zustand selector.
6. Add any required JSX to the component and style it using Tailwind token classes.
7. Follow the design tokens in [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for colors and thresholds.

### Adding a new API endpoint

1. Add the handler method to `internal/server/handlers.go`.
2. Register the route in `internal/server/server.go` (`registerRoutes`).
3. Document the endpoint in `README.md`'s API table.
4. Do not add new middleware without discussion — auth and logging are intentionally the only middleware layers.

### Modifying the web UI

- All UI source lives in `frontend/src/`. Do not edit `web/` directly — it is the Vite build output.
- Use Tailwind token classes (`text-accent-green`, `bg-bg-card`, etc.) for all colors. Never write bare hex in JSX.
- Use `getThresholdHex(pct)` from `src/lib/thresholdColor.ts` when a hex string is required (Chart.js dataset colors).
- All component files export named exports (`export const Foo = memo(...)`). Pages use `export default` for lazy loading.
- See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for color tokens, thresholds, component patterns, and the Chart.js ref pattern.
- After UI changes run `npm run build && npm run lint` in `frontend/` before opening a PR.

---

## Code Style

### Go

- Follow standard Go conventions (`gofmt`, `go vet`).
- Error strings are lowercase and do not end with punctuation (Go convention).
- Exported types and functions must have a doc comment if non-obvious.
- No `panic` in library code (`internal/`). Return errors.
- Prefer returning concrete types over interfaces in internal packages.
- Keep functions short. If a function is more than ~50 lines, consider splitting it.

### TypeScript / React

- Strict TypeScript (`"strict": true`). `@typescript-eslint/no-explicit-any` is an ESLint error.
- Use `import type` for type-only imports (`@typescript-eslint/consistent-type-imports` is enforced).
- All components are named exports wrapped in `React.memo`. Props interfaces are co-located in the same file.
- `react-hooks/exhaustive-deps` is set to `error` — do not suppress it without strong justification.
- No `useState` for data driven by the Zustand store — use selectors. No `useState` for Chart.js data — use `useRef`.
- See Zustand selector pattern and Chart.js ref pattern in `CLAUDE.md` before touching chart or store code.

### CSS / Tailwind

- Use Tailwind token classes defined in `tailwind.config.ts` for all colors. No bare hex in JSX.
- No `!important`.
- Dark mode only in Phase 1 — the `dark` class is set on `<html>` at load time.

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
   cd frontend && npm run build && npm run lint
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
