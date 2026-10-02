#!/usr/bin/env bash
# Wait for the `tests` check on a branch's head (lesson 25). REST only: GitHub
# GraphQL (gh pr checks) is blocked in Claude Code sessions.
# Usage: bash .claude/hooks/ci-wait.sh <branch> [repo]
# Exit 0 = green, 1 = red, 2 = no run after 10 minutes / gh not usable.
# The sha is read every round, so a watcher started before a push follows the new
# head: never kill it to "restart" (02/10/2026, the kill took the new one down too).
set -u
br="${1:?branch}"; repo="${2:-mishaf1988-lgtm/tfugen-safety}"; waited=0
while :; do
  sha=$(gh api "repos/$repo/commits/$br" --jq .sha 2>/dev/null) || { echo "ci-wait: gh api failed"; exit 2; }
  out=$(gh api "repos/$repo/commits/$sha/check-runs?check_name=tests&per_page=10" --jq '[.check_runs[] | .status + ":" + (.conclusion // "")] | join(",")' 2>/dev/null) || { echo "ci-wait: gh api failed"; exit 2; }
  if [ -n "$out" ] && ! echo "$out" | grep -qE "(queued|in_progress|pending|waiting|requested):"; then
    echo "ci-wait: $br ${sha:0:7} tests = $out"
    echo "$out" | grep -qE ":(failure|cancelled|timed_out|action_required)" && exit 1
    exit 0
  fi
  [ -z "$out" ] && [ "$waited" -ge 600 ] && { echo "ci-wait: no tests run on ${sha:0:7} after 10 minutes"; exit 2; }
  sleep 30; waited=$((waited+30))
done
