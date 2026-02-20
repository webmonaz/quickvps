---
name: quickvps-docs-sync
description: Detect documentation drift against QuickVPS source-of-truth files (routes, flags, and /api/info payload). Use when asked to sync docs, review README/CLAUDE/docs changes, or verify docs before merge.
---

# QuickVPS Docs Sync

Check that code and docs stay aligned for APIs, flags, and server info payload fields.

## Run

From repository root:

```bash
bash skills/quickvps-docs-sync/scripts/check_docs_sync.sh
```

## Sources of truth

- `internal/server/server.go` for routes
- `main.go` for CLI flags
- `internal/server/handlers.go` (`handleInfo`) for `/api/info` fields

## Docs checked

- `README.md`
- `CLAUDE.md` (and `AGENTS.md` via symlink)
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`

## Output contract

- Print a markdown checklist of checks and mismatches.
- Exit code `0` when no mismatches are found.
- Exit code `1` when any mismatch is found.
