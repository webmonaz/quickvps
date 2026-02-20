---
name: quickvps-orbstack-smoke
description: Build QuickVPS binaries and run real-machine smoke checks on OrbStack by copying the ARM64 binary to ubuntu@orb, starting the service, and verifying http://ubuntu.orb.local:8080. Use after implementing/fixing features when you need to confirm behavior outside local dev.
---

# QuickVPS OrbStack Smoke

Run a repeatable deploy-and-check flow for OrbStack Linux machine validation.

## Prerequisite gate

Always verify OrbStack is installed before using this skill.

- Required command: `orb` must exist in `PATH`.
- Required SSH host setup: `ssh ubuntu@orb` (or your configured user/host) must be resolvable.

The bundled script enforces this gate automatically and exits early with install/setup guidance when OrbStack is missing.

## Run

From repository root:

```bash
bash .agents/skills/quickvps-orbstack-smoke/scripts/deploy_and_check.sh all
```

## Modes

```bash
bash .agents/skills/quickvps-orbstack-smoke/scripts/deploy_and_check.sh all    # build + scp + start + smoke check
bash .agents/skills/quickvps-orbstack-smoke/scripts/deploy_and_check.sh push   # build + scp only
bash .agents/skills/quickvps-orbstack-smoke/scripts/deploy_and_check.sh start  # start remote binary only
bash .agents/skills/quickvps-orbstack-smoke/scripts/deploy_and_check.sh check  # curl smoke check only
```

## Environment overrides

Set variables when defaults need to change:

- `ORB_USER` default: `ubuntu`
- `ORB_HOST` default: `orb`
- `ORB_WEB_HOST` default: `${ORB_USER}.orb.local`
- `REMOTE_BIN` default: `~/quickvps`
- `ADDR` default: `:8080`
- `PASSWORD` default: `dev123`

Example:

```bash
ORB_USER=ubuntu ORB_HOST=orb PASSWORD=dev123 ADDR=:8080 \
  bash .agents/skills/quickvps-orbstack-smoke/scripts/deploy_and_check.sh all
```

## Output contract

- Validate OrbStack installation and OrbStack SSH host config before remote operations.
- `all` must run `make build-full`, copy `quickvps-linux-arm64`, start remote process, then smoke-check HTTP reachability.
- Smoke-check must verify the app root is reachable and `/api/info` returns `401` when started with `--auth=true`.
- Start step must fail fast when startup exits early (e.g., invalid password) or when target port is already in use.
- Exit `0` only when all selected steps succeed.
- Print final reachable URL (`http://<machine>.orb.local:<port>/`) on success.
