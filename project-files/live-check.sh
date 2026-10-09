#!/usr/bin/env bash
# Prove the live site serves exactly the index.html of origin/main (09/10/2026, night round).
# The cloud is outside Israel, so a plain fetch of tapugan-safety.pages.dev gets the country
# gate's 403. routine-db's "live" op (a machine path, behind ROUTINE_KEY) returns the deployed
# commit and the sha256 of the index.html it serves. This waits until that hash equals the hash
# of origin/main's index.html, up to 20 minutes (a Cloudflare deploy takes 1-3).
# Exit 0 = live matches main. 4 = no match in time (or the call failed). 3 = no ROUTINE_KEY.
cd "$(dirname "$0")/.." || exit 4
git fetch -q origin main || exit 4
want=$(git show origin/main:index.html | sha256sum | cut -d' ' -f1)
echo "main $(git rev-parse --short origin/main) index sha256 $want"
for i in $(seq 1 40); do
  out=$(bash project-files/routine-db.sh '{"op":"live"}' 2>/dev/null); rc=$?
  [ $rc -eq 3 ] && { echo "ROUTINE_KEY missing" >&2; exit 3; }
  got=$(printf '%s' "$out" | sed -n 's/.*"index_sha256":"\([0-9a-f]*\)".*/\1/p')
  commit=$(printf '%s' "$out" | sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p')
  if [ -n "$got" ] && [ "$got" = "$want" ]; then echo "live OK: commit ${commit:0:7}, index matches main"; exit 0; fi
  echo "try $i: live commit ${commit:0:7}, index ${got:0:12} (waiting for ${want:0:12})"
  sleep 30
done
echo "live does not match main after 20 minutes" >&2; exit 4
