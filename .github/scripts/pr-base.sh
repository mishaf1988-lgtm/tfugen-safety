#!/usr/bin/env bash
# The commit a pull_request job compares HEAD with (17/11/2026, #2884).
# CI checks out the merge of the PR with main as it is NOW, but pull_request.base.sha ($BASE) is main as it was
# when the event was made. `git diff "$BASE" HEAD` therefore also listed what other PRs merged meanwhile, and the
# description gate asked #2884 for a security review of a file it never touched. On a merge commit the first
# parent is the main it was merged with, so HEAD^1..HEAD is this PR's own change and nothing else.
# Not a merge commit (a push, a local run): $BASE as given.
if git rev-parse -q --verify 'HEAD^2' >/dev/null 2>&1; then git rev-parse 'HEAD^1'; else printf '%s\n' "${BASE:-}"; fi
