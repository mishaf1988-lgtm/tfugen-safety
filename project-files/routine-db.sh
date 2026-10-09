#!/usr/bin/env bash
# The Routines' way to the database (09/10/2026): /api/routine-db with ROUTINE_KEY,
# instead of the Supabase connector (its approval is locked by the org admin).
# Usage: bash project-files/routine-db.sh '{"op":"state_get","keys":["quote_track"]}'
#        bash project-files/routine-db.sh '{"op":"select","table":"docs","query":"select=id,n,e"}'
#        bash project-files/routine-db.sh '{"op":"state_set","key":"quote_track","value":{...}}'
# Exit 3 = no ROUTINE_KEY in this environment: fall back to execute_sql, as the prompt says.
if [ -z "${ROUTINE_KEY:-}" ]; then echo "ROUTINE_KEY missing" >&2; exit 3; fi
curl -sS --max-time 60 -X POST https://tapugan-safety.pages.dev/api/routine-db \
  -H "x-routine-key: $ROUTINE_KEY" -H 'content-type: application/json' --data "$1"
