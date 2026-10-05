#!/usr/bin/env bash
# All the package tests. Before install: from this folder. Exit 1 if any fails.
cd "$(dirname "$0")/tests" || exit 2
rc=0
for t in *-test.py; do
  out=$(python3 "$t" 2>&1); last=$(echo "$out" | tail -1)
  echo "$t: $last"
  echo "$last" | grep -q " 0 failed" || { echo "$out" | grep "✗"; rc=1; }
done
exit $rc
