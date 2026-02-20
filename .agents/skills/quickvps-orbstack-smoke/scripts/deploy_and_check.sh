#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}" # all | push | start | check

ORB_USER="${ORB_USER:-ubuntu}"
ORB_HOST="${ORB_HOST:-orb}"
ORB_WEB_HOST="${ORB_WEB_HOST:-${ORB_USER}.orb.local}"
REMOTE_BIN="${REMOTE_BIN:-~/quickvps}"
ADDR="${ADDR:-:8080}"
PASSWORD="${PASSWORD:-dev}"

if [[ "${ADDR}" != :* ]]; then
  echo "ADDR must be in :<port> format (current: ${ADDR})" >&2
  exit 2
fi

PORT="${ADDR#:}"
APP_URL="http://${ORB_WEB_HOST}:${PORT}/"
API_URL="http://${ORB_WEB_HOST}:${PORT}/api/info"

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
  ssh "${ORB_USER}@${ORB_HOST}" "chmod +x ${REMOTE_BIN} && nohup ${REMOTE_BIN} --auth=true --password='${PASSWORD}' --addr='${ADDR}' >/tmp/quickvps.log 2>&1 < /dev/null &"
}

run_check() {
  echo "Smoke-check: ${API_URL}"
  curl --fail --silent --show-error "${API_URL}" >/dev/null
  echo "OK: service reachable at ${APP_URL}"
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
