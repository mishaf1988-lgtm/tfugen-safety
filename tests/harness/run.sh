#!/usr/bin/env bash
# Runs every harness against the repo's index.html / functions / tools.
# Needs: node 18+, playwright (npm i -g playwright; browsers via PLAYWRIGHT_BROWSERS_PATH), python3.
# Usage: bash tests/harness/run.sh            (all)
#        bash tests/harness/run.sh trustee    (only files matching a substring)
set -u
cd "$(dirname "$0")"
# One run at a time (lesson 29, 02/10/2026): the end removes the shared _build, and a
# second run.sh beside a full one crashed 30 mjs suites in it. A lock left by a dead run is taken over.
if ! mkdir .run.lock 2>/dev/null; then
  if kill -0 "$(cat .run.lock/pid 2>/dev/null)" 2>/dev/null; then echo "HARNESS ERROR: run.sh already running (pid $(cat .run.lock/pid)). One test alone: node <file>"; exit 1; fi
fi
echo $$ > .run.lock/pid; trap 'rm -rf .run.lock' EXIT
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
# the function unit test imports ESM copies of the Cloudflare function + shared helpers
mkdir -p _build
cp ../../functions/_shared.js _build/_shared.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/wa-templates.js > _build/wa-templates.mjs
sed -e "s#'../_shared.js'#'./_shared.mjs'#" -e "s#'../_onedrive.js'#'./_onedrive.mjs'#" ../../functions/api/vitre.js > _build/vitre.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/wa-send.js > _build/wa-send.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/wa-status.js > _build/wa-status.mjs
sed "s#'../_shared.js'#'./_shared.mjs'#" ../../functions/api/claude.js > _build/claude.mjs
# trustee-log (27/09): its own helper modules, imported as ../_xlsx.js and ../_onedrive.js
for m in _xlsx _onedrive _closelink _xlsxpatch _ai _meeting _pptx _deckpatch _watchdog; do cp ../../functions/$m.js _build/$m.mjs; done
sed -i "s#'./api/hazard-file.js'#'./hazard-file.mjs'#" _build/_meeting.mjs
sed -i "s#'./_xlsxpatch.js'#'./_xlsxpatch.mjs'#" _build/_pptx.mjs _build/_deckpatch.mjs
sed -i "s#'./_onedrive.js'#'./_onedrive.mjs'#" _build/_watchdog.mjs
for f in trustee-log ms-auth trustee-notify mail-inbox close-hazard hazard-file od-read hazard-report meeting-data hazard-deck weekly-digest backup-od; do
  sed -e "s#'../_shared.js'#'./_shared.mjs'#" -e "s#'../_xlsx.js'#'./_xlsx.mjs'#" -e "s#'../_onedrive.js'#'./_onedrive.mjs'#" -e "s#'../_closelink.js'#'./_closelink.mjs'#" -e "s#'../_xlsxpatch.js'#'./_xlsxpatch.mjs'#" -e "s#'../_ai.js'#'./_ai.mjs'#" -e "s#'./hazard-file.js'#'./hazard-file.mjs'#" -e "s#'./hazard-deck.js'#'./hazard-deck.mjs'#" -e "s#'../_meeting.js'#'./_meeting.mjs'#" -e "s#'../_pptx.js'#'./_pptx.mjs'#" -e "s#'../_deckpatch.js'#'./_deckpatch.mjs'#" -e "s#'../_watchdog.js'#'./_watchdog.mjs'#" ../../functions/api/$f.js > _build/$f.mjs
done
filter="${1:-}"; fail=0
# SHARD=i/n (the GitHub workflow, 01/10/2026): only every n-th file, from i.
shard="${SHARD:-}"; idx=0
# The only two scripts that legitimately print a report instead of a pass/fail
# count. Anything ELSE that prints no summary has crashed or timed out, and that
# is a failure — it used to be reported as "(report only)" and ALL GREEN still
# printed, which made a broken suite indistinguishable from a passing one.
NO_ASSERTIONS="notif-scan-test.js sc-test.js"
for f in *.js *.mjs *.py; do
  # visual-audit.js is the on-demand phone sweep (~5 min per width, screenshots
  # to a folder), not a pass/fail suite. Run it by name; see README.
  [ "$f" = "visual-audit.js" ] && continue
  [ -n "$filter" ] && [[ "$f" != *"$filter"* ]] && continue
  if [ -n "$shard" ]; then i=$idx; idx=$((idx + 1)); [ $((i % ${shard#*/})) -ne "${shard%/*}" ] && continue; fi
  ran=$((${ran:-0} + 1))
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
    echo "$line"; fail=1; echo "$out" | grep -E "✗|FAIL|HARNESS" | head -5
  fi
done
rm -rf _build
# A filter that matches no file used to print ALL GREEN over zero suites (01/10/2026, lesson 22).
[ "${ran:-0}" -eq 0 ] && { echo "NO SUITE MATCHED '$filter'"; fail=1; }
[ $fail -eq 0 ] && echo "ALL GREEN" || echo "FAILURES ABOVE"
exit $fail
