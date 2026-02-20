#!/usr/bin/env bash
set -u -o pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

step_names=(
  "Go unit tests"
  "Go race tests"
  "Linux amd64 build"
  "Linux arm64 build"
  "Frontend build"
  "Frontend lint"
  "Frontend tests"
)

step_cmds=(
  "go test ./..."
  "go test -race ./..."
  "make linux"
  "make linux-arm64"
  "cd frontend && npm run build"
  "cd frontend && npm run lint"
  "cd frontend && npm test"
)

results=()
failed_index=-1

run_step() {
  local idx="$1"
  local name="${step_names[$idx]}"
  local cmd="${step_cmds[$idx]}"
  local started ended duration

  printf '\n[%d/%d] %s\n' "$((idx + 1))" "${#step_names[@]}" "$name"
  echo "$cmd"

  started="$(date +%s)"
  if bash -lc "cd '$repo_root' && $cmd"; then
    ended="$(date +%s)"
    duration="$((ended - started))"
    results+=("PASS|$name|$duration|$cmd")
    return 0
  fi

  ended="$(date +%s)"
  duration="$((ended - started))"
  results+=("FAIL|$name|$duration|$cmd")
  return 1
}

for i in "${!step_names[@]}"; do
  if ! run_step "$i"; then
    failed_index="$i"
    break
  fi
done

echo

echo "## Preflight Summary"
for r in "${results[@]}"; do
  IFS='|' read -r status name duration cmd <<<"$r"
  if [[ "$status" == "PASS" ]]; then
    echo "- [x] $name (${duration}s)"
  else
    echo "- [ ] $name (${duration}s)"
  fi
done

if [[ "$failed_index" -ge 0 ]]; then
  echo
  echo "First failed command:"
  echo "\`${step_cmds[$failed_index]}\`"
  exit 1
fi

echo

echo "All preflight checks passed."
exit 0
