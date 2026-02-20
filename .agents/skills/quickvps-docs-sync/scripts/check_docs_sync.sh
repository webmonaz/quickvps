#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

README="README.md"
CLAUDE="CLAUDE.md"
ARCH="docs/ARCHITECTURE.md"
TESTING="docs/TESTING.md"

mismatches=0

ok() {
  echo "- [x] $1"
}

miss() {
  echo "- [ ] $1"
  mismatches=$((mismatches + 1))
}

contains() {
  local file="$1"
  local pattern="$2"
  rg -q --fixed-strings -- "$pattern" "$file"
}

echo "## Docs Sync Report"
echo

echo "### Routes"
routes="$(rg 'HandleFunc\(\"([^\"]+)\"' -or '$1' internal/server/server.go | sort -u)"
while IFS= read -r route; do
  [[ -z "$route" ]] && continue
  if contains "$README" "$route" && contains "$CLAUDE" "$route"; then
    ok "Route [$route] present in README + CLAUDE"
  else
    miss "Route [$route] missing from README or CLAUDE"
  fi
done <<< "$routes"

for must in "/api/info" "/api/auth/login" "/api/users" "/api/audit/users" "/api/ncdu/scan" "/ws"; do
  if contains "$ARCH" "$must" || contains "$TESTING" "$must"; then
    ok "Core route [$must] documented in ARCHITECTURE or TESTING"
  else
    miss "Core route [$must] missing from ARCHITECTURE and TESTING"
  fi
done

echo
echo "### Flags"
flags="$(rg 'flag\.(String|Bool|Duration)\(\"([a-z_]+)\"' -or '$2' main.go | sort -u)"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  has_readme=0
  has_claude=0
  if contains "$README" "--$f" || contains "$README" "-$f"; then
    has_readme=1
  fi
  if contains "$CLAUDE" "--$f" || contains "$CLAUDE" "-$f"; then
    has_claude=1
  fi

  if [[ "$has_readme" -eq 1 && "$has_claude" -eq 1 ]]; then
    ok "Flag [--$f / -$f] present in README + CLAUDE"
  else
    miss "Flag [--$f / -$f] missing from README or CLAUDE"
  fi
done <<< "$flags"

echo
echo "### /api/info payload"
info_fields="$(
  awk '
    /func \(s \*Server\) handleInfo\(/ {in_block=1}
    in_block && /"[a-z_]+"[[:space:]]*:/ {
      if (match($0, /"[a-z_]+"/)) {
        key=substr($0, RSTART+1, RLENGTH-2)
        print key
      }
    }
    in_block && /writeJSON\(w, http.StatusOK, info\)/ {exit}
  ' internal/server/handlers.go | sort -u
)"

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  if contains "$README" "$key"; then
    ok "README mentions [$key]"
  else
    miss "README missing [$key]"
  fi

  if contains "$CLAUDE" "$key"; then
    ok "CLAUDE mentions [$key]"
  else
    miss "CLAUDE missing [$key]"
  fi
done <<< "$info_fields"

for ext in "local_ip" "public_ip" "dns_servers" "version"; do
  if contains "$TESTING" "$ext" || contains "$ARCH" "$ext"; then
    ok "Extended field [$ext] covered by TESTING or ARCHITECTURE"
  else
    miss "Extended field [$ext] missing from TESTING and ARCHITECTURE"
  fi
done

echo
if [[ "$mismatches" -eq 0 ]]; then
  echo "No documentation drift detected."
  exit 0
fi

echo "Detected $mismatches mismatch(es)."
exit 1
