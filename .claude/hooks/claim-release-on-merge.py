#!/usr/bin/env python3
"""PostToolUse on mcp__github__merge_pull_request: release this session's claims of the merged work.

20/11/2026 (Michael in the questionnaire, after a post about Vercel Board: "do it: release on merge (recommended)").
A claim (project-files/claim.sh) lasts 6 hours, and the status-md queue 20 minutes, also after the PR merged.
That day it stopped work twice: status-md stayed on a merged branch of this very session, and the weekly rotation's
claim stayed after #2951 merged. Vercel Board ends a claim with a short lease; here the merge is the natural end.

What is released, only claims of THIS session (the server releases only the caller's own):
- status-md, when its note is the branch that was merged (the note is always the branch, tools/status-queue.py);
- an item claim taken while this branch's work was open: from 30 minutes before the branch left main up to the
  branch's first own commit. A claim taken later (the next task, while CI of this one runs) is kept.
The merged branch is the current branch (the session merges the PR it just pushed). On main, nothing is released.
A failure never blocks: the hook prints a line and exits 0.

Test: python3 tests/harness/claim-release-test.py
"""
import json, os, subprocess, sys
from datetime import datetime, timedelta
sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUEUE = "status-md"
BEFORE = timedelta(minutes=30)


def parse_ts(s):
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def to_release(claims, session, branch, fork_ts, first_ts):
    """Pure: the items to release. claims = {item: {session, at, note}}; fork_ts / first_ts = aware datetimes or None."""
    if not session or not branch or branch in ("main", "HEAD"):
        return []
    out = []
    for item, c in sorted((claims or {}).items()):
        if not isinstance(c, dict) or c.get("session") != session:
            continue
        if item == QUEUE:
            if c.get("note") == branch:
                out.append(item)
            continue
        at = parse_ts(c.get("at"))
        if at is None or fork_ts is None or first_ts is None:
            continue
        if fork_ts - BEFORE <= at <= first_ts:
            out.append(item)
    return out


def merged(payload):
    r = payload.get("tool_response")
    txt = r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)
    return '"merged":true' in txt.replace(" ", "") or '\\"merged\\":true' in txt.replace(" ", "")


def git(args):
    p = subprocess.run(["git"] + args, cwd=ROOT, capture_output=True, text=True, timeout=20)
    return p.stdout.strip() if p.returncode == 0 else ""


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    if not merged(payload):
        return 0
    session = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID") or os.environ.get("CLAUDE_CODE_SESSION_ID") or ""
    session = session.replace("cse_", "session_", 1) if session.startswith("cse_") else session
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"])
    base = git(["merge-base", "HEAD", "origin/main"])
    fork_ts = parse_ts(git(["show", "-s", "--format=%cI", base])) if base else None
    firsts = git(["log", "--reverse", "--format=%cI", base + "..HEAD"]).splitlines() if base else []
    first_ts = parse_ts(firsts[0]) if firsts else None
    try:
        p = subprocess.run(["bash", os.path.join(ROOT, "project-files", "claim.sh"), "--list"], cwd=ROOT,
                           capture_output=True, text=True, timeout=60)
        claims = json.loads(p.stdout or "{}").get("claims", {})
    except Exception as e:
        print("claim-release: could not read the claims (%s); release by hand: claim.sh <item> --release" % e)
        return 0
    items = to_release(claims, session, branch, fork_ts, first_ts)
    done = []
    for item in items:
        p = subprocess.run(["bash", os.path.join(ROOT, "project-files", "claim.sh"), item, "--release"], cwd=ROOT,
                           capture_output=True, text=True, timeout=60)
        if '"released":true' in (p.stdout or "").replace(" ", ""):
            done.append(item)
    if done:
        print("claim-release: released after the merge: " + ", ".join(done))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("claim-release: skipped (%s)" % e)
        sys.exit(0)
