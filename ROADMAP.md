# QuickVPS Roadmap

## Phase 1 — React Frontend Migration (current)
- Replace vanilla HTML/JS/CSS with React 18 + TypeScript + TailwindCSS
- Vite build pipeline, Zustand state management, React Router scaffold
- Full feature parity with existing dashboard (CPU, Memory, Swap, Disk, Network, Storage Analyzer)
- Dark mode only; English only; single-binary Go embed preserved

## Phase 2 — Theme Toggle + Internationalization ✅
- Dark / Light mode toggle (CSS class on `<html>`)
- i18n: English (default) + Vietnamese via react-i18next
- Language and theme persisted in localStorage

## Phase 3 — Router + Settings Page
- `/storage` route: full-page Storage Analyzer
- `/settings` route: theme, language, default scan path preferences
- Go SPA fallback for React Router deep links

## Phase 4 — SQLite + Users + Roles
- Server-side SQLite database (pure-Go driver, no CGO)
- User management: create/edit/delete users
- Role-based access: admin, viewer
- Replace HTTP Basic Auth with proper session/JWT authentication
- Admin panel UI at `/admin`

## Phase 5 — Production Hardening
- GitHub Actions CI: lint → test → build → cross-compile (amd64 + arm64)
- Bundle analysis and size budgets
- Vitest unit tests for lib functions
- React Testing Library component tests
- Playwright E2E tests for critical flows
