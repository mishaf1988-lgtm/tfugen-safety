#!/usr/bin/env python3
"""PreToolUse gate on mcp__github__merge_pull_request (upgrade review 28,
Michael 01/10/2026): no merge to main until the "tests" check of the PR's
head commit is green in GitHub (.github/workflows/tests.yml). Until 01/10 the
harness ran only when Claude remembered (#994 went in red).

The check name depends on the repo (07/10/2026): the account skills moved to the
private repo michael-skills, whose CI check is "checks" (.github/workflows/checks.yml
there). An unknown repo gets "tests". GITHUB_TOKEN or GH_TOKEN in the environment
is sent as Authorization, so a private repo can be read; without one the public
API answers 404 for a private repo and the merge waits (fails closed), with a
message that a token is needed. Any read failure keeps the merge waiting.

Test:  echo '{"tool_name":"mcp__github__merge_pull_request","tool_input":{"owner":"mishaf1988-lgtm","repo":"tfugen-safety","pullNumber":1005}}' | python3 .claude/hooks/merge-gate.py
"""
import json, os, sys, urllib.error, urllib.request
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

CHECKS = {"tfugen-safety": "tests", "michael-skills": "checks"}
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""


def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason}}))
    sys.exit(0)


def get(url):
    h = {"Accept": "application/vnd.github+json", "User-Agent": "tapugan-merge-gate"}
    if TOKEN:
        h["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(url, headers=h)
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
CHECK = CHECKS.get(str(repo), "tests")
api = "https://api.github.com/repos/%s/%s" % (owner, repo)
try:
    pr = get("%s/pulls/%s" % (api, int(num)))
    sha = pr["head"]["sha"]
    want = str(ti.get("expectedHeadSha") or "")
    if want and not sha.startswith(want):  # a short sha is fine
        out("deny", "merge-gate: the PR head moved (%s), check again" % sha[:7])
    runs = get("%s/commits/%s/check-runs?check_name=%s&per_page=20" % (api, sha, CHECK)).get("check_runs", [])
except SystemExit:
    raise
except urllib.error.HTTPError as e:
    if e.code == 404 and not TOKEN:  # a private repo looks like 404 without a token
        out("deny", "merge-gate: %s/%s is not readable without a token (private repo?). Set GITHUB_TOKEN or GH_TOKEN and try again." % (owner, repo))
    out("deny", "merge-gate: could not read the checks from GitHub (%s). Try again in a minute." % str(e)[:120])
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
