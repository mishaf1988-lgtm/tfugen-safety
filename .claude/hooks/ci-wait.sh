#!/usr/bin/env bash
# Wait for the CI check on a branch's head (lesson 25): `tests`, or `checks` in
# michael-skills (07/10/2026, its .github/workflows/checks.yml); unknown repo = `tests`.
# REST only: GitHub GraphQL (gh pr checks) is blocked in Claude Code sessions.
# Usage: bash .claude/hooks/ci-wait.sh <branch> [repo]
# Exit 0 = green, 1 = red, 2 = no run after 10 minutes / gh not usable.
# The sha is read every round, so a watcher started before a push follows the new
# head: never kill it to "restart" (02/10/2026, the kill took the new one down too).
# Only the newest `tests` run of the sha counts (05/10/2026: an old failed or
# cancelled run on the same sha made it exit 1 while the new run was green).
# A cancelled run is skipped (a newer push cancels it; the new run decides).
# 17/11/2026 (Michael in the questionnaire, four test rules, rules 3 and 4): every red head of a branch is
# written to $CI_FAILS_DIR/<repo>_<branch> (one sha per line). The third red in a row exits 3: the session
# stops and asks Michael in a questionnaire, and push-gate.py refuses a push to that branch until
# `ci-wait.sh --continue <branch> "<his answer>"`. Green clears the count. A sha that was red and is now
# green with no change in between is a flaky test: it goes to tests/harness/flaky.md, never "run again until green".
# Exit 0 = green, 1 = red, 2 = no run / gh not usable, 3 = third red in a row.
set -u
fails_file() { local d="${CI_FAILS_DIR:-$HOME/.claude/ci-fails}"; mkdir -p "$d" 2>/dev/null; echo "$d/$(echo "${2:-mishaf1988-lgtm/tfugen-safety}_$1" | tr -c 'A-Za-z0-9._\n-' '_')"; }
if [ "${1:-}" = "--continue" ]; then
  ans="${3:-}"; [ -n "${2:-}" ] && [ "${#ans}" -ge 4 ] || { echo 'usage: ci-wait.sh --continue <branch> "<what Michael answered>" [repo]'; exit 2; }
  f=$(fails_file "$2" "${4:-}"); echo "$(date -u +%FT%TZ) $2: $ans" >> "$(dirname "$f")/continued.log"; rm -f "$f"
  echo "ci-wait: the count of $2 is cleared"; exit 0
fi
if [ "${1:-}" = "--count" ]; then f=$(fails_file "${2:?branch}" "${3:-}"); n=$(grep -c . "$f" 2>/dev/null); echo "${n:-0}"; exit 0; fi
br="${1:?branch}"; repo="${2:-mishaf1988-lgtm/tfugen-safety}"; waited=0
ff=$(fails_file "$br" "$repo")
case "${repo##*/}" in
  michael-skills) check=checks ;;
  *) check=tests ;;
esac
while :; do
  sha=$(gh api "repos/$repo/commits/$br" --jq .sha 2>/dev/null) || { echo "ci-wait: gh api failed"; exit 2; }
  # A cancelled workflow run leaves its summary job `tests` as "failure", not "cancelled"
  # (05/10/2026, #1200: a PR-body edit queued a second run, the first was cancelled, and
  # its `tests` read as red while the real run was still going). So `tests` is ignored
  # when a sibling job in the same check suite was cancelled.
  q='(.check_runs | map(select(.conclusion == "cancelled" and .check_suite.id != null) | .check_suite.id) | unique) as $cs
     | [.check_runs[] | select(.name == null or .name == $check) | select(.conclusion != "cancelled")
        | select(.check_suite.id == null or ((.check_suite.id as $id | $cs | index($id)) == null))]
     | sort_by(.id) | last | if . == null then "" else .status + ":" + (.conclusion // "") end'
  out=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=50" --jq "\"$check\" as \$check | $q" 2>/dev/null) || { echo "ci-wait: gh api failed"; exit 2; }
  if [ -n "$out" ] && ! echo "$out" | grep -qE "(queued|in_progress|pending|waiting|requested):"; then
    echo "ci-wait: $br ${sha:0:7} $check = $out"
    if echo "$out" | grep -qE ":(failure|cancelled|timed_out|action_required)"; then
      grep -qx "$sha" "$ff" 2>/dev/null || echo "$sha" >> "$ff"
      n=$(grep -c . "$ff" 2>/dev/null); n=${n:-0}
      if [ "$n" -ge 3 ]; then
        echo "ci-wait: $n כשלונות ברצף על $br. עוצרים: לא מתקנים ולא דוחפים שוב. שאלון למיכאל (מה נכשל בכל סבב, ומה האפשרויות), ואחרי התשובה: bash .claude/hooks/ci-wait.sh --continue $br \"<מה ענה>\""
        exit 3
      fi
      echo "ci-wait: כשלון $n מתוך 3 על $br. אדום בלי שינוי בקוד = בדיקה לא יציבה: לרשום ב-tests/harness/flaky.md, לא להריץ שוב עד ירוק."
      exit 1
    fi
    grep -qx "$sha" "$ff" 2>/dev/null && echo "ci-wait: ${sha:0:7} נכשל ועבר בלי שינוי: בדיקה לא יציבה. לרשום אותה ב-tests/harness/flaky.md לפני המיזוג."
    rm -f "$ff"
    exit 0
  fi
  # No decisive `tests` yet: jobs of a newer run may still be running (their `tests` is created last).
  busy=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=50" --jq '[.check_runs[] | select(.status != "completed")] | length' 2>/dev/null || echo 0)
  [ -z "$out" ] && [ "${busy:-0}" = "0" ] && [ "$waited" -ge 600 ] && { echo "ci-wait: no $check run on ${sha:0:7} after 10 minutes"; exit 2; }
  sleep ${CI_WAIT_SLEEP:-30}; waited=$((waited+30))
done
