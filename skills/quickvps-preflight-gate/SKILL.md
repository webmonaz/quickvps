---
name: quickvps-preflight-gate
description: Run the full QuickVPS pre-PR validation gate and summarize pass/fail for each required check. Use when asked to run preflight, final checks, CI-equivalent local checks, or verify the branch is merge-ready.
---

# QuickVPS Preflight Gate

Run the canonical validation sequence before PR/merge and report a compact checklist.

## Run

From repository root:

```bash
bash skills/quickvps-preflight-gate/scripts/run_preflight.sh
```

## Required sequence

1. `go test ./...`
2. `go test -race ./...`
3. `make linux`
4. `make linux-arm64`
5. `cd frontend && npm run build`
6. `cd frontend && npm run lint`
7. `cd frontend && npm test`

## Output contract

- Show one line per step with PASS/FAIL and duration.
- If a step fails, stop immediately and report the first failed command.
- Exit code `0` only when all steps pass.
