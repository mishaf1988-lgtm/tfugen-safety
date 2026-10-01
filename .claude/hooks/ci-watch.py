#!/usr/bin/env python3
"""PostToolUse: after a push, watch the PR's checks in the background (lesson 25).

01/10/2026: #1027 went green at 15:48 and sat unmerged, because the session
waited for a GitHub event that never came instead of looking. Michael: "why
did it stop". So every `git push` (Bash) and every PR opened through the
GitHub MCP answers with the exact command to run in the background; it
returns when the checks finish, green or red, with no event needed.

Test:  python3 tests/harness/ci-watch-test.py
"""
import json, re, subprocess, sys

REPO = "mishaf1988-lgtm/tfugen-safety"

def branch():
    try:
        return subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)
tool = d.get("tool_name", "")
inp = d.get("tool_input", {}) or {}
ref = ""
if tool == "Bash":
    cmd = inp.get("command", "") or ""
    if not re.search(r"(^|[;&|\s])git\s+push\b", cmd) or inp.get("run_in_background"):
        print("{}"); sys.exit(0)
    ref = branch()
elif tool == "mcp__github__create_pull_request":
    ref = inp.get("head", "") or branch()
else:
    print("{}"); sys.exit(0)
if not ref or ref in ("main", "HEAD"):
    print("{}"); sys.exit(0)

cmd = "sleep 20; gh pr checks %s -R %s --watch --interval 30" % (ref, REPO)
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext":
        "ci-watch (lesson 25): run now with Bash run_in_background=true: `%s` . "
        "It returns when the checks finish. Green = merge (no expectedHeadSha); red = fix. "
        "Do not wait for a GitHub event instead." % cmd}}))
