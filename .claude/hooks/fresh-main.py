#!/usr/bin/env python3
"""PreToolUse gate on Edit/Write/MultiEdit (BACKLOG 31, Michael 01/10/2026):
no edit of a file that changed on origin/main since this checkout last caught
up. Two accounts edit the same repo; an edit on a stale copy can undo a fix the
other side merged (three times on 22/09/2026, skill tfugen-history).

Blocks only when the file being edited differs between the merge-base and
origin/main, so a branch that is behind on unrelated files keeps working.
Fetches origin main at most once a minute (FRESH_MAIN_EVERY seconds).
Fails open: no network, no git, no origin/main -> the edit goes ahead.
Edits made by a Bash script do not pass through here.

Test:  python3 tests/harness/fresh-main-test.py
"""
import json, os, subprocess, sys, time
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

EVERY = int(os.environ.get("FRESH_MAIN_EVERY", "60"))


def allow():
    print("{}")
    sys.exit(0)


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason}}))
    sys.exit(0)


def git(root, *args, timeout=10):
    r = subprocess.run(["git", "-C", root, "-c", "core.quotepath=off"] + list(args),
                       capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip()


try:
    d = json.load(sys.stdin)
    path = str((d.get("tool_input") or {}).get("file_path") or "")
    if not path:
        allow()
    path = os.path.abspath(path)
    here = os.path.dirname(path)
    while here and not os.path.isdir(here):
        here = os.path.dirname(here)
    rc, root = git(here, "rev-parse", "--show-toplevel")
    if rc or not root:
        allow()
    rel = os.path.relpath(path, root)
    if rel.startswith(".."):
        allow()
    rc, gitdir = git(root, "rev-parse", "--absolute-git-dir")
    stamp = os.path.join(gitdir, "fresh-main-stamp")
    if rc == 0 and (not os.path.exists(stamp) or time.time() - os.path.getmtime(stamp) >= EVERY):
        try:
            git(root, "fetch", "-q", "origin", "main", timeout=20)
        except subprocess.TimeoutExpired:
            pass
        open(stamp, "w").close()
    rc, _ = git(root, "rev-parse", "--verify", "-q", "origin/main")
    if rc:
        allow()
    rc, _ = git(root, "merge-base", "--is-ancestor", "origin/main", "HEAD")
    if rc == 0:
        allow()
    rc, base = git(root, "merge-base", "HEAD", "origin/main")
    if rc or not base:
        allow()
    rc, changed = git(root, "diff", "--name-only", base, "origin/main", "--", rel)
    if rc or not changed:
        allow()
    _, behind = git(root, "rev-list", "--count", base + "..origin/main")
    _, branch = git(root, "rev-parse", "--abbrev-ref", "HEAD")
    fix = ("git fetch origin main && git reset --hard origin/main" if branch == "main"
           else "git fetch origin main && git rebase origin/main")
    deny("fresh-main: %s changed on main since this copy (%s new commits on main). "
         "Run: %s, then read the file again before editing. (CLAUDE.md, sync rule 1)" % (rel, behind, fix))
except SystemExit:
    raise
except Exception:
    allow()
