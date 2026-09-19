#!/usr/bin/env bash
# Runs every harness against the repo's index.html / functions / tools.
# Needs: node 18+, playwright (npm i -g playwright; browsers via PLAYWRIGHT_BROWSERS_PATH), python3.
# Usage: bash tests/harness/run.sh            (all)
#        bash tests/harness/run.sh trustee    (only files matching a substring)
set -u
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
# the function unit test imports ESM copies of the Cloudflare function + shared helpers
mkdir -p _build
cp ../../functions/_shared.js _build/_shared.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/trustee-notify.js > _build/trustee-notify.mjs
filter="${1:-}"; fail=0
for f in *.js *.mjs *.py; do
  [ -n "$filter" ] && [[ "$f" != *"$filter"* ]] && continue
  printf '%-28s ' "$f"
  case "$f" in
    *.py) out=$(timeout 300 python3 "$f" 2>&1) ;;
    *)    out=$(timeout 300 node "$f" 2>&1) ;;
  esac
  line=$(echo "$out" | grep -E "passed|HARNESS ERROR" | tail -1)
  echo "${line:-(no summary — see output)}"
  echo "$out" | grep -q " 0 failed" || { fail=1; echo "$out" | grep -E "✗|HARNESS" | head -5; }
done
rm -rf _build
exit $fail
