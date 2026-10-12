#!/usr/bin/env bash
# Take an open item before coding it, so two sessions do not build the same thing
# (12/10/2026, lesson 10: two sessions built the retro proposals in parallel).
# Usage: bash project-files/claim.sh <item> [note]      take it (item: a-z 0-9 . _ -)
#        bash project-files/claim.sh <item> --release   give it back when merged
#        bash project-files/claim.sh --list             the fresh claims
# Exit 0 = yours. Exit 5 = another session holds it (printed): do not code it; read that
# session (list_events) or pick another item. Exit 3/4 = as routine-db.sh (no key / failed):
# go on, but grep STATUS again right before coding.
# A claim lasts CLAIM_HOURS (6) in routine-db.js; claim again to renew it.
set -u
dir=$(dirname "$0")
sid="${CLAUDE_CODE_REMOTE_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-}}"
if [ "${1:-}" = "--list" ]; then exec bash "$dir/routine-db.sh" '{"op":"claims"}'; fi
item="${1:-}"
[ -n "$item" ] || { echo "usage: claim.sh <item> [note|--release] | --list" >&2; exit 2; }
[ -n "$sid" ] || { echo "no session id in the environment" >&2; exit 2; }
if [ "${2:-}" = "--release" ]; then
  body=$(python3 -c 'import json,sys; print(json.dumps({"op":"claim","item":sys.argv[1],"session":sys.argv[2],"release":True}))' "$item" "$sid")
else
  body=$(python3 -c 'import json,sys; print(json.dumps({"op":"claim","item":sys.argv[1],"session":sys.argv[2],"note":sys.argv[3]}))' "$item" "$sid" "${2:-}")
fi
out=$(bash "$dir/routine-db.sh" "$body"); rc=$?
printf '%s\n' "$out"
[ $rc -ne 0 ] && exit $rc
case "$out" in *'"mine":false'*'"holder"'*) echo "held by another session: do not code this item" >&2; exit 5 ;; esac
exit 0
