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
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/wa-templates.js > _build/wa-templates.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/vitre.js > _build/vitre.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/wa-send.js > _build/wa-send.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/claude.js > _build/claude.mjs
filter="${1:-}"; fail=0
# The only two scripts that legitimately print a report instead of a pass/fail
# count. Anything ELSE that prints no summary has crashed or timed out, and that
# is a failure — it used to be reported as "(report only)" and ALL GREEN still
# printed, which made a broken suite indistinguishable from a passing one.
NO_ASSERTIONS="notif-scan-test.js sc-test.js"
for f in *.js *.mjs *.py; do
  [ -n "$filter" ] && [[ "$f" != *"$filter"* ]] && continue
  printf '%-28s ' "$f"
  case "$f" in
    *.py) out=$(timeout 300 python3 "$f" 2>&1); rc=$? ;;
    *)    out=$(timeout 300 node "$f" 2>&1); rc=$? ;;
  esac
  line=$(echo "$out" | grep -E "passed|HARNESS ERROR" | tail -1)
  if [ -z "$line" ]; then
    if [[ " $NO_ASSERTIONS " == *" $f "* ]] && [ $rc -eq 0 ]; then
      echo "(report only — no assertions by design)"
    else
      fail=1
      [ $rc -eq 124 ] && echo "TIMED OUT after 300s" || echo "NO SUMMARY — crashed (exit $rc)"
      echo "$out" | tail -5 | sed 's/^/    /'
    fi
  elif echo "$line" | grep -q " 0 failed"; then
    echo "$line"
    # a suite that passes every check but still exits non-zero is broken too
    [ $rc -ne 0 ] && { echo "    ...but exited $rc"; fail=1; }
  else
    echo "$line"; fail=1; echo "$out" | grep -E "✗|HARNESS" | head -5
  fi
done
rm -rf _build
[ $fail -eq 0 ] && echo "ALL GREEN" || echo "FAILURES ABOVE"
exit $fail
