#!/usr/bin/env bash
# The Routines' way to the database (09/10/2026): /api/routine-db with ROUTINE_KEY,
# instead of the Supabase connector (its approval is locked by the org admin).
# Usage: bash project-files/routine-db.sh '{"op":"state_get","keys":["quote_track"]}'
#        bash project-files/routine-db.sh '{"op":"select","table":"docs","query":"select=id,n,e"}'
#        bash project-files/routine-db.sh '{"op":"state_set","key":"quote_track","value":{...}}'
#        bash project-files/routine-db.sh '{"op":"agent_report","agent":"routine-quotes","ok":true,"line":"...","learned":"..."}'
# Exit 3 = no ROUTINE_KEY in this environment: fall back to execute_sql, as the prompt says.
# Exit 4 = the call failed (HTTP not 200, e.g. 403 for a wrong key, or no "ok":true in the
# answer). Before 09/10/2026 a 403 left exit 0, and a Routine read it as "no rows".
if [ -z "${ROUTINE_KEY:-}" ]; then echo "ROUTINE_KEY missing" >&2; exit 3; fi
out=$(curl -sS --max-time 60 -w '\n%{http_code}' -X POST https://tapugan-safety.pages.dev/api/routine-db \
  -H "x-routine-key: $ROUTINE_KEY" -H 'content-type: application/json' --data "$1") || { echo "curl failed" >&2; exit 4; }
code=${out##*$'\n'}
body=${out%$'\n'*}
printf '%s\n' "$body"
if [ "$code" != "200" ]; then echo "HTTP $code" >&2; exit 4; fi
case "$body" in *'"ok":true'*) exit 0 ;; *) echo "no ok:true" >&2; exit 4 ;; esac
