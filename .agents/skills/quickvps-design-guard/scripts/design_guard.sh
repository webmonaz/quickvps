#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

hard_fail=0

print_section() {
  echo
  echo "### $1"
}

print_section "Rule 1: Wide Zustand selector (useStore -> snapshot)"
rule1="$(rg -n "useStore\\(\\s*\\(?s\\)?\\s*=>\\s*s\\.snapshot\\s*(\\)|,)" frontend/src --glob '*.ts' --glob '*.tsx' || true)"
if [[ -n "$rule1" ]]; then
  echo "$rule1"
  echo "Fix: subscribe to narrow primitives/objects with shallow when needed."
  hard_fail=1
else
  echo "No violations."
fi

print_section "Rule 2: Hardcoded hex in TSX (warning)"
rule2="$(rg -n "#[0-9a-fA-F]{3,8}\\b" frontend/src --glob '*.tsx' || true)"
if [[ -n "$rule2" ]]; then
  echo "$rule2"
  echo "Suggestion: prefer Tailwind tokens for UI surfaces; keep hex only where Chart.js needs explicit colors."
else
  echo "No findings."
fi

print_section "Rule 3: Realtime chart state anti-patterns"
rule3="$(rg -n -i "useState\\([^)]*(dataset|datasets|chart|history|series|points)" frontend/src/components/charts frontend/src/components/metrics --glob '*.tsx' || true)"
if [[ -n "$rule3" ]]; then
  echo "$rule3"
  echo "Fix: keep Chart.js instances in useRef and update datasets imperatively via chart.update('none')."
  hard_fail=1
else
  echo "No violations."
fi

print_section "Pattern reminder"
echo "- Use narrow Zustand selectors; avoid whole snapshot subscriptions."
echo "- Keep Chart.js instance in useRef."
echo "- Mutate chart data imperatively and call chart.update('none')."

if [[ "$hard_fail" -eq 1 ]]; then
  echo
  echo "Design guard failed due to high-impact violations."
  exit 1
fi

echo

echo "Design guard passed."
exit 0
