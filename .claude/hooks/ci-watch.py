#!/usr/bin/env python3
"""PostToolUse: after a push, watch the PR's checks in the background (lesson 25).

01/10/2026: #1027 went green at 15:48 and sat unmerged, because the session
waited for a GitHub event that never came instead of looking. Michael: "why
did it stop". So every `git push` (Bash) and every PR opened through the
GitHub MCP answers with the exact command to run in the background
(ci-wait.sh, REST: `gh pr checks` uses GraphQL, which is blocked here and
still exits 0); it returns when `tests` finishes, with no event needed.

Test:  python3 tests/harness/ci-watch-test.py
"""
import json, os, re, subprocess, sys

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
    # The branch named in the push (git push -u origin <b>), else the checkout's.
    m = re.search(r"git\s+push\b[^;&|]*?\borigin\s+(?:HEAD:)?([\w./-]+)", cmd)
    ref = m.group(1) if m else branch()
elif tool == "mcp__github__create_pull_request":
    ref = inp.get("head", "") or branch()
else:
    print("{}"); sys.exit(0)
if not ref or ref in ("main", "HEAD"):
    print("{}"); sys.exit(0)

# A watcher already running on this branch follows the new head by itself (it
# re-reads the sha every round). 02/10/2026: two watchers were killed to "restart"
# them and the kill took the new one down too; nothing needed restarting.
def already_watching(ref):
    env = os.environ.get("CI_WATCH_RUNNING")
    if env in ("0", "1"):
        return env == "1"
    try:
        p = subprocess.run(["pgrep", "-f", "ci-wait.sh %s " % ref], capture_output=True, text=True, timeout=10)
        return p.returncode == 0 and p.stdout.strip() != ""
    except Exception:
        return False

if already_watching(ref):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext":
            "ci-watch: ci-wait.sh כבר רץ על %s ועוקב אחרי ה-head החדש בעצמו (קורא את ה-sha בכל סבב). "
            "לא להפעיל שוב ולא להרוג אותו; הסיום שלו יעיר את השיחה." % ref}}, ensure_ascii=False))
    sys.exit(0)

cmd = "sleep 20; bash .claude/hooks/ci-wait.sh %s %s" % (ref, REPO)
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext":
        "ci-watch (lesson 25): run now with Bash run_in_background=true: `%s` . "
        "Exit 0 = green: merge (no expectedHeadSha); 1 = red: fix; 2 = look yourself. "
        "Do not wait for a GitHub event instead." % cmd}}))
