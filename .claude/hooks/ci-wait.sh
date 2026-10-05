#!/usr/bin/env bash
# Wait for the `tests` check on a branch's head (lesson 25). REST only: GitHub
# GraphQL (gh pr checks) is blocked in Claude Code sessions.
# Usage: bash .claude/hooks/ci-wait.sh <branch> [repo]
# Exit 0 = green, 1 = red, 2 = no run after 10 minutes / gh not usable.
# The sha is read every round, so a watcher started before a push follows the new
# head: never kill it to "restart" (02/10/2026, the kill took the new one down too).
# Only the newest `tests` run of the sha counts (05/10/2026: an old failed or
# cancelled run on the same sha made it exit 1 while the new run was green).
# A cancelled run is skipped (a newer push cancels it; the new run decides).
set -u
br="${1:?branch}"; repo="${2:-mishaf1988-lgtm/tfugen-safety}"; waited=0
while :; do
  sha=$(gh api "repos/$repo/commits/$br" --jq .sha 2>/dev/null) || { echo "ci-wait: gh api failed"; exit 2; }
  # A cancelled workflow run leaves its summary job `tests` as "failure", not "cancelled"
  # (05/10/2026, #1200: a PR-body edit queued a second run, the first was cancelled, and
  # its `tests` read as red while the real run was still going). So `tests` is ignored
  # when a sibling job in the same check suite was cancelled.
  q='(.check_runs | map(select(.conclusion == "cancelled" and .check_suite.id != null) | .check_suite.id) | unique) as $cs
     | [.check_runs[] | select(.name == null or .name == "tests") | select(.conclusion != "cancelled")
        | select(.check_suite.id == null or ((.check_suite.id as $id | $cs | index($id)) == null))]
     | sort_by(.id) | last | if . == null then "" else .status + ":" + (.conclusion // "") end'
  out=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=50" --jq "$q" 2>/dev/null) || { echo "ci-wait: gh api failed"; exit 2; }
  if [ -n "$out" ] && ! echo "$out" | grep -qE "(queued|in_progress|pending|waiting|requested):"; then
    echo "ci-wait: $br ${sha:0:7} tests = $out"
    echo "$out" | grep -qE ":(failure|cancelled|timed_out|action_required)" && exit 1
    exit 0
  fi
  # No decisive `tests` yet: jobs of a newer run may still be running (their `tests` is created last).
  busy=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=50" --jq '[.check_runs[] | select(.status != "completed")] | length' 2>/dev/null || echo 0)
  [ -z "$out" ] && [ "${busy:-0}" = "0" ] && [ "$waited" -ge 600 ] && { echo "ci-wait: no tests run on ${sha:0:7} after 10 minutes"; exit 2; }
  sleep ${CI_WAIT_SLEEP:-30}; waited=$((waited+30))
done
