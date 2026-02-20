#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}" # all | push | start | check

ORB_USER="${ORB_USER:-ubuntu}"
ORB_HOST="${ORB_HOST:-orb}"
ORB_WEB_HOST="${ORB_WEB_HOST:-${ORB_USER}.orb.local}"
REMOTE_BIN="${REMOTE_BIN:-~/quickvps}"
ADDR="${ADDR:-:8080}"
# Password must satisfy QuickVPS minimum length (>= 6 chars).
PASSWORD="${PASSWORD:-dev123}"
REMOTE_LOG="${REMOTE_LOG:-/tmp/quickvps.log}"

if [[ "${ADDR}" != :* ]]; then
  echo "ADDR must be in :<port> format (current: ${ADDR})" >&2
  exit 2
fi

PORT="${ADDR#:}"
APP_URL="http://${ORB_WEB_HOST}:${PORT}/"
API_URL="http://${ORB_WEB_HOST}:${PORT}/api/info"
REMOTE_PID_FILE="${REMOTE_PID_FILE:-/tmp/quickvps-smoke-${PORT}.pid}"

check_orbstack_installed() {
  if ! command -v orb >/dev/null 2>&1; then
    echo "OrbStack CLI not found (missing 'orb' command)." >&2
    echo "Install OrbStack first: https://orbstack.dev/" >&2
    exit 3
  fi
}

check_orbstack_ssh_ready() {
  if ! ssh -G "${ORB_USER}@${ORB_HOST}" >/dev/null 2>&1; then
    echo "SSH host '${ORB_HOST}' is not configured for OrbStack yet." >&2
    echo "Open OrbStack at least once and verify 'ssh ${ORB_USER}@${ORB_HOST}' works." >&2
    exit 3
  fi
}

run_push() {
  echo "[1/3] Building binaries (frontend + current + linux + linux-arm64)..."
  make build-full

  echo "[2/3] Copying quickvps-linux-arm64 to ${ORB_USER}@${ORB_HOST}:${REMOTE_BIN}..."
  scp quickvps-linux-arm64 "${ORB_USER}@${ORB_HOST}:${REMOTE_BIN}"
}

run_start() {
  echo "[3/3] Starting remote quickvps on ${ORB_USER}@${ORB_HOST} (${ADDR})..."
  ssh "${ORB_USER}@${ORB_HOST}" "PORT='${PORT}' REMOTE_BIN='${REMOTE_BIN}' PASSWORD='${PASSWORD}' ADDR='${ADDR}' REMOTE_LOG='${REMOTE_LOG}' REMOTE_PID_FILE='${REMOTE_PID_FILE}' bash -s" <<'EOF'
set -euo pipefail

# Fail fast when the target port is already occupied; otherwise check step can
# pass against an unrelated, older process.
if command -v ss >/dev/null 2>&1; then
  if ss -ltn | awk '{print $4}' | grep -Eq "[:.]${PORT}\$"; then
    echo "Port ${PORT} is already in use on remote host. Stop existing process or use a different ADDR." >&2
    exit 5
  fi
fi

# Expand "~/" in configured remote binary path.
if [[ "${REMOTE_BIN}" == "~/"* ]]; then
  REMOTE_BIN="${HOME}/${REMOTE_BIN:2}"
fi

chmod +x "${REMOTE_BIN}"
nohup "${REMOTE_BIN}" --auth=true --password="${PASSWORD}" --addr="${ADDR}" >"${REMOTE_LOG}" 2>&1 < /dev/null &
pid=$!
echo "${pid}" > "${REMOTE_PID_FILE}"
sleep 1

if ! kill -0 "${pid}" >/dev/null 2>&1; then
  echo "quickvps exited during startup. Recent log output:" >&2
  tail -n 60 "${REMOTE_LOG}" >&2 || true
  exit 6
fi
EOF
}

run_check() {
  echo "Smoke-check: ${APP_URL}"

  root_status="$(curl --silent --show-error --output /dev/null --write-out "%{http_code}" "${APP_URL}")"
  if [[ "${root_status}" != "200" ]]; then
    echo "Unexpected status from ${APP_URL}: ${root_status} (expected 200)." >&2
    exit 7
  fi

  api_body="$(mktemp)"
  api_status="$(curl --silent --show-error --output "${api_body}" --write-out "%{http_code}" "${API_URL}")"
  if [[ "${api_status}" != "401" ]]; then
    echo "Unexpected status from ${API_URL}: ${api_status} (expected 401 with --auth=true)." >&2
    cat "${api_body}" >&2 || true
    rm -f "${api_body}"
    exit 8
  fi
  rm -f "${api_body}"

  echo "OK: service reachable at ${APP_URL} and /api/info is auth-protected."
}

case "${MODE}" in
  all)
    check_orbstack_installed
    check_orbstack_ssh_ready
    run_push
    run_start
    run_check
    ;;
  push)
    check_orbstack_installed
    check_orbstack_ssh_ready
    run_push
    ;;
  start)
    check_orbstack_installed
    check_orbstack_ssh_ready
    run_start
    ;;
  check)
    check_orbstack_installed
    run_check
    ;;
  *)
    echo "Unknown mode: ${MODE}" >&2
    echo "Usage: $0 [all|push|start|check]" >&2
    exit 2
    ;;
esac
