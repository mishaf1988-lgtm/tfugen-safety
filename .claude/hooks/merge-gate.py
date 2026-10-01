#!/usr/bin/env python3
"""PreToolUse gate on mcp__github__merge_pull_request (upgrade review 28,
Michael 01/10/2026): no merge to main until the "tests" check of the PR's
head commit is green in GitHub (.github/workflows/tests.yml). Until 01/10 the
harness ran only when Claude remembered (#994 went in red).

Reads the public GitHub API without a token (the repo is public; 60 calls an
hour is plenty). Fails closed: if GitHub cannot be read, the merge waits.

Test:  echo '{"tool_name":"mcp__github__merge_pull_request","tool_input":{"owner":"mishaf1988-lgtm","repo":"tfugen-safety","pullNumber":1005}}' | python3 .claude/hooks/merge-gate.py
"""
import json, sys, urllib.request

CHECK = "tests"


def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason}}))
    sys.exit(0)


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "tapugan-merge-gate"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


d = json.load(sys.stdin)
if not str(d.get("tool_name", "")).endswith("merge_pull_request"):
    print("{}")
    sys.exit(0)
ti = d.get("tool_input", {}) or {}
owner, repo, num = ti.get("owner"), ti.get("repo"), ti.get("pullNumber")
if not (owner and repo and num):
    out("deny", "merge-gate: owner/repo/pullNumber missing")
api = "https://api.github.com/repos/%s/%s" % (owner, repo)
try:
    pr = get("%s/pulls/%s" % (api, int(num)))
    sha = pr["head"]["sha"]
    if ti.get("expectedHeadSha") and ti["expectedHeadSha"] != sha:
        out("deny", "merge-gate: the PR head moved (%s), check again" % sha[:7])
    runs = get("%s/commits/%s/check-runs?check_name=%s&per_page=20" % (api, sha, CHECK)).get("check_runs", [])
except SystemExit:
    raise
except Exception as e:  # fail closed
    out("deny", "merge-gate: could not read the checks from GitHub (%s). Try again in a minute." % str(e)[:120])
if not runs:
    out("deny", "merge-gate: no '%s' check on %s yet. Wait for the GitHub workflow to start and finish (2-3 min)." % (CHECK, sha[:7]))
runs.sort(key=lambda r: r.get("started_at") or "", reverse=True)
r = runs[0]
if r.get("status") != "completed":
    out("deny", "merge-gate: '%s' is still %s on %s. Wait until it finishes." % (CHECK, r.get("status"), sha[:7]))
if r.get("conclusion") != "success":
    out("deny", "merge-gate: '%s' is %s on %s: fix it, do not merge. %s" % (CHECK, r.get("conclusion"), sha[:7], r.get("html_url", "")))
out("allow", "merge-gate: '%s' green on %s" % (CHECK, sha[:7]))
