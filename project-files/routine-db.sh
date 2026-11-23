#!/usr/bin/env bash
# The Routines' way to the database (09/10/2026): /api/routine-db with ROUTINE_KEY,
# instead of the Supabase connector (its approval is locked by the org admin).
# Usage: bash project-files/routine-db.sh '{"op":"state_get","keys":["quote_track"]}'
#        bash project-files/routine-db.sh '{"op":"select","table":"docs","query":"select=id,n,e"}'
#        bash project-files/routine-db.sh '{"op":"state_set","key":"quote_track","value":{...}}'
#        bash project-files/routine-db.sh '{"op":"expiry_set","table":"docs","id":"...","agent":"routine-mail-filing","e":"2027-05-01","why":"...","doc":"..."}'
#        bash project-files/routine-db.sh '{"op":"talk_field","id":"w20261018","dept":"...","text":"..."}'
#        bash project-files/routine-db.sh '{"op":"agent_report","agent":"routine-quotes","ok":true,"line":"...","learned":"..."}'
# Exit 3 = no ROUTINE_KEY in this environment: fall back to execute_sql, as the prompt says.
# Exit 4 = the call failed (HTTP not 200, e.g. 403 for a wrong key, or no "ok":true in the
# answer). Before 09/10/2026 a 403 left exit 0, and a Routine read it as "no rows".
# A big body (od_put_pdf of a docx over ~128KB: "Argument list too long", 23/11/2026): write the JSON to a file and
# pass @<file>, or pipe it and pass - :  bash project-files/routine-db.sh @/tmp/put.json   |   ... | routine-db.sh -
if [ -z "${ROUTINE_KEY:-}" ]; then echo "ROUTINE_KEY missing" >&2; exit 3; fi
case "${1:-}" in
  -) data=(--data-binary @-) ;;
  @*) [ -f "${1#@}" ] || { echo "no such file: ${1#@}" >&2; exit 4; }; data=(--data-binary "$1") ;;
  *) data=(--data "$1") ;;
esac
out=$(curl -sS --max-time 60 -w '\n%{http_code}' -X POST https://tapugan-safety.pages.dev/api/routine-db \
  -H "x-routine-key: $ROUTINE_KEY" -H 'content-type: application/json' "${data[@]}") || { echo "curl failed" >&2; exit 4; }
code=${out##*$'\n'}
body=${out%$'\n'*}
printf '%s\n' "$body"
if [ "$code" != "200" ]; then echo "HTTP $code" >&2; exit 4; fi
case "$body" in *'"ok":true'*) exit 0 ;; *) echo "no ok:true" >&2; exit 4 ;; esac
