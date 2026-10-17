#!/usr/bin/env bash
# The agents' way to the database: /api/routine-db on this factory's site, with ROUTINE_KEY.
# Run from the root of the repo. The site address comes from functions/_site.js (SITE.appUrl).
# Usage: bash agents/routine-db.sh '{"op":"select","table":"docs","query":"select=id,n,e"}'
#        bash agents/routine-db.sh '{"op":"state_get","keys":["agent_log"]}'
#        bash agents/routine-db.sh '{"op":"agent_report","agent":"compliance","ok":true,"line":"...","learned":"..."}'
# Exit 3 = no ROUTINE_KEY in this environment. Exit 4 = the call failed (HTTP not 200, or no
# "ok":true in the answer), so an empty answer is never read as "no rows".
if [ -z "${ROUTINE_KEY:-}" ]; then echo "ROUTINE_KEY missing" >&2; exit 3; fi
app=$(node -e "import('./functions/_site.js').then((m) => console.log(m.SITE.appUrl))") || { echo "functions/_site.js not readable" >&2; exit 4; }
out=$(curl -sS --max-time 60 -w '\n%{http_code}' -X POST "$app/api/routine-db" \
  -H "x-routine-key: $ROUTINE_KEY" -H 'content-type: application/json' --data "$1") || { echo "curl failed" >&2; exit 4; }
code=${out##*$'\n'}
body=${out%$'\n'*}
printf '%s\n' "$body"
if [ "$code" != "200" ]; then echo "HTTP $code" >&2; exit 4; fi
case "$body" in *'"ok":true'*) exit 0 ;; *) echo "no ok:true" >&2; exit 4 ;; esac
