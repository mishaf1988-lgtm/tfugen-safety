#!/usr/bin/env bash
# Prove the live site runs origin/main and serves exactly its index.html (09/10/2026, night round).
# The cloud is outside Israel, so a plain fetch of tapugan-safety.pages.dev gets the country
# gate's 403. routine-db's "live" op (a machine path, behind ROUTINE_KEY) returns the deployed
# commit and the sha256 of the index.html it serves. This waits until that hash equals the hash
# of origin/main's index.html, up to 20 minutes (a Cloudflare deploy takes 1-3).
# Exit 0 = live runs main (or later) with that commit's index. 4 = no match in time (or the call failed). 3 = no ROUTINE_KEY.
cd "$(dirname "$0")/.." || exit 4
git fetch -q origin main || exit 4
# The commit to prove (LIVE_WANT, e.g. the merge sha; default origin/main now). The index alone is
# not enough: a PR that changes only functions/ leaves index.html as it was, so the old deployment
# matched at once (09/10/2026, #1294). Live must run this commit or a later main commit (main may
# move while waiting), and serve exactly the index.html of the commit it runs.
wantc=$(git rev-parse "${LIVE_WANT:-origin/main}") || exit 4
want=$(git show "$wantc:index.html" | sha256sum | cut -d' ' -f1)
echo "main ${wantc:0:7} index sha256 $want"
tries=${LIVE_TRIES:-40}
for i in $(seq 1 "$tries"); do
  out=$(bash project-files/routine-db.sh '{"op":"live"}' 2>/dev/null); rc=$?
  [ $rc -eq 3 ] && { echo "ROUTINE_KEY missing" >&2; exit 3; }
  got=$(printf '%s' "$out" | sed -n 's/.*"index_sha256":"\([0-9a-f]*\)".*/\1/p')
  commit=$(printf '%s' "$out" | sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p')
  if [ -n "$commit" ] && [ -n "$got" ]; then
    [ "$commit" != "$wantc" ] && git fetch -q origin main
    if [ "$commit" = "$wantc" ] || git merge-base --is-ancestor "$wantc" "$commit" 2>/dev/null; then
      has=$(git show "$commit:index.html" 2>/dev/null | sha256sum | cut -d' ' -f1)
      if [ "$got" = "$has" ]; then echo "live OK: commit ${commit:0:7}, index matches that commit"; exit 0; fi
    fi
  fi
  echo "try $i: live commit ${commit:0:7}, index ${got:0:12} (waiting for ${wantc:0:7} or later)"
  [ "$i" -lt "$tries" ] && sleep "${LIVE_SLEEP:-30}"
done
echo "live does not run ${wantc:0:7} (or later) with its index.html after $tries tries" >&2; exit 4
