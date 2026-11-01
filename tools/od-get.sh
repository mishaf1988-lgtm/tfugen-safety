#!/usr/bin/env bash
# Download ONE file from Michael's OneDrive safety folder (01/11/2026, Michael: agents fill the factory's controlled
# Word form instead of building one; the form is fetched as it is, logo and header included).
# Usage: bash tools/od-get.sh '<path under the safety folder>' <out-file>
#   e.g. bash tools/od-get.sh '11_x/y/form.doc' /tmp/t/form.doc
# Sets a fresh one-off raw token for 10 minutes (od_raw_token / od_raw_exp through routine-db state_set), downloads
# with /api/od-read {path, raw:true} and header x-raw-token, prints the HTTP code and the size, and ends the token
# right after (od_raw_exp set to now). Exit 0 = the file is there; 2 = usage; 3 = no ROUTINE_KEY; 4 = token not set;
# 5 = download failed (HTTP not 200, empty file, or a JSON error instead of the file).
set -u
if [ $# -ne 2 ]; then echo "usage: bash tools/od-get.sh '<path under the safety folder>' <out-file>" >&2; exit 2; fi
path=$1; out=$2
if [ -z "${ROUTINE_KEY:-}" ]; then echo "ROUTINE_KEY missing" >&2; exit 3; fi
here=$(cd "$(dirname "$0")/.." && pwd)
tok=$(python3 -c 'import secrets; print(secrets.token_hex(24))')
exp=$(python3 -c 'import datetime as d; print((d.datetime.now(d.timezone.utc)+d.timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ"))')
now=$(python3 -c 'import datetime as d; print(d.datetime.now(d.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))')
bash "$here/project-files/routine-db.sh" "{\"op\":\"state_set\",\"key\":\"od_raw_token\",\"value\":\"$tok\"}" >/dev/null || { echo "token: state_set od_raw_token failed" >&2; exit 4; }
bash "$here/project-files/routine-db.sh" "{\"op\":\"state_set\",\"key\":\"od_raw_exp\",\"value\":\"$exp\"}" >/dev/null || { echo "token: state_set od_raw_exp failed" >&2; exit 4; }
body=$(python3 -c 'import json,sys; print(json.dumps({"path": sys.argv[1], "raw": True}, ensure_ascii=False))' "$path")
mkdir -p "$(dirname "$out")"
code=$(curl -sS --max-time 120 -o "$out" -w '%{http_code}' -X POST https://tapugan-safety.pages.dev/api/od-read \
  -H "x-raw-token: $tok" -H 'content-type: application/json' --data "$body") || code=000
# the token ends now, whatever happened (it would end by itself within 10 minutes)
bash "$here/project-files/routine-db.sh" "{\"op\":\"state_set\",\"key\":\"od_raw_exp\",\"value\":\"$now\"}" >/dev/null 2>&1 || echo "od-get: WARNING: revoking the one-off token failed; it stays valid until its expiry (10 minutes). Do not run two od-get.sh at once." >&2
size=$(stat -c %s "$out" 2>/dev/null || echo 0)
echo "HTTP $code, $size bytes, $out"
if [ "$code" != "200" ] || [ "$size" -eq 0 ]; then echo "download failed: $(head -c 300 "$out" 2>/dev/null)" >&2; exit 5; fi
if head -c 1 "$out" | grep -q '{'; then echo "download failed (the server answered JSON): $(head -c 300 "$out")" >&2; exit 5; fi
exit 0
