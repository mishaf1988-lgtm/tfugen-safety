#!/usr/bin/env python3
"""PreToolUse on Artifact (29/10/2026, lesson 194). A publish of a file that the
repo tracks is denied when the working tree's copy lacks a change to that file
that is already on origin/main: the last origin/main commit touching the file is
not in HEAD. On 29/10/2026 the system map was published from a branch opened
before #2206 merged, the band was missing, and Michael refreshed twice.
A file outside the repo (the scratchpad) or not tracked passes; so does a branch
that already carries the merged change and adds its own.

Test:  python3 tests/harness/artifact-fresh-test.py
"""
import json, os, subprocess, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")


def git(cwd, *a):
    p = subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, encoding="utf-8", timeout=20)
    return p.returncode, p.stdout.strip()


def stale(path):
    """origin/main sha of a change this file lacks, else None."""
    d = os.path.dirname(os.path.abspath(path))
    if not os.path.isdir(d):
        return None
    rc, top = git(d, "rev-parse", "--show-toplevel")
    if rc or not top:
        return None
    rel = os.path.relpath(os.path.abspath(path), top)
    if rel.startswith(".."):
        return None
    rc, _ = git(top, "ls-files", "--error-unmatch", rel)
    if rc:
        return None
    if os.environ.get("ARTIFACT_FRESH_FETCH", "1") == "1":
        try:
            git(top, "fetch", "-q", "origin", "main")
        except Exception:
            pass
    rc, sha = git(top, "log", "-1", "--format=%h", "origin/main", "--", rel)
    if rc or not sha:
        return None
    rc, _ = git(top, "merge-base", "--is-ancestor", sha, "HEAD")
    return sha if rc == 1 else None


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("tool_name") != "Artifact":
        return
    ti = d.get("tool_input") or {}
    if ti.get("action", "publish") != "publish" or ti.get("asset"):
        return
    fp = ti.get("file_path")
    if not fp:
        return
    try:
        sha = stale(fp)
    except Exception:
        return
    if sha:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "artifact-fresh: בקובץ %s חסר שינוי שכבר מוזג ל-main (%s), הענף נפתח לפני המיזוג (לקח 194). "
                                        "לפרסם מ-main: git show origin/main:<נתיב> > <קובץ ב-scratchpad>, ואחרי הפרסום read ו-grep על מה שהשינוי הוסיף." % (fp, sha)}},
            ensure_ascii=False))


main()
