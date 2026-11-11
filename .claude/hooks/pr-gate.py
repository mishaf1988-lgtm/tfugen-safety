#!/usr/bin/env python3
"""PreToolUse (mcp__github__create_pull_request): the PR description has the
retro and skill lines before the PR is opened (lessons-gate.py runs the same
check in CI, but only after the PR exists, so a missing line costs a red round
and an edit). Runs check(title, body, files) from .github/scripts/lessons-gate.py
on `git diff --name-only origin/main...<the PR's head branch>` (HEAD when git does not know the branch). Red = deny with the reason.

Tests set PR_GATE_CHANGED (comma list) instead of git.
Test:  python3 tests/harness/pr-gate-test.py
"""
import importlib.util, json, os, shutil, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

GATE = ".github/scripts/lessons-gate.py"


def root(d):
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True, timeout=10).stdout.strip()
        return top or cwd
    except Exception:
        return cwd


def head_ref(cwd, head):
    """The branch the PR is opened from, when git knows it (11/11/2026: a PR built in a second worktree was checked
    against the files of the directory the session stood in, passed here and failed in CI three times)."""
    head = str(head or "").split(":")[-1].strip()
    if not head or not all(c.isalnum() or c in "/._-" for c in head) or head.startswith("-"):
        return "HEAD"
    for ref in ("origin/" + head, head):
        try:
            if subprocess.run(["git", "rev-parse", "--verify", "--quiet", ref + "^{commit}"], cwd=cwd, capture_output=True, timeout=10).returncode == 0:
                return ref
        except Exception:
            pass
    return "HEAD"


def _git(cwd, *a):
    return subprocess.run(["git"] + list(a), cwd=cwd, capture_output=True, text=True, timeout=30)


def src_dir(cwd, ref):
    """Where the PR's own files are, so lessons-gate and pii-md-test read them and not the directory the session
    stands in (11/11/2026 retro: a PR from another worktree with a mobile number in a .md passed here and failed in CI,
    lesson 77 again). Returns (dir, cleanup): cwd when the ref is what is checked out here, the worktree that has
    it checked out, or a temporary detached worktree of it (removed by cleanup)."""
    if ref == "HEAD":
        return cwd, None
    try:
        want = _git(cwd, "rev-parse", "--verify", "--quiet", ref + "^{commit}").stdout.strip()
        if not want or want == _git(cwd, "rev-parse", "HEAD").stdout.strip():
            return cwd, None
        path = None
        for line in _git(cwd, "worktree", "list", "--porcelain").stdout.split("\n"):
            if line.startswith("worktree "):
                path = line[9:]
            elif line == "HEAD " + want and path and os.path.isdir(path) and not _git(path, "status", "--porcelain", "--untracked-files=no").stdout.strip():
                return path, None
        tmp = tempfile.mkdtemp(prefix="pr-gate-")
        if _git(cwd, "worktree", "add", "--detach", "--quiet", tmp, want).returncode != 0:
            shutil.rmtree(tmp, ignore_errors=True)
            return cwd, None
        return tmp, lambda: (_git(cwd, "worktree", "remove", "--force", tmp), shutil.rmtree(tmp, ignore_errors=True))
    except Exception:
        return cwd, None


def changed(cwd, head=None):
    env = os.environ.get("PR_GATE_CHANGED")
    if env is not None:
        return [x for x in env.split(",") if x]
    p = subprocess.run(["git", "-c", "core.quotepath=off", "diff", "--name-only", "origin/main..." + head_ref(cwd, head)], cwd=cwd, capture_output=True, text=True, timeout=20)
    return [x for x in p.stdout.split("\n") if x]


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    if not str(d.get("tool_name", "")).endswith("create_pull_request"):
        print("{}"); return
    inp = d.get("tool_input") or {}
    cwd = root(d)
    src, cleanup = (cwd, None) if os.environ.get("PR_GATE_CHANGED") is not None else src_dir(cwd, head_ref(cwd, inp.get("head")))
    try:
        check(cwd, src, inp)
    finally:
        if cleanup:
            cleanup()


def check(cwd, src, inp):
    try:
        spec = importlib.util.spec_from_file_location("lessons_gate", os.path.join(src, GATE))
        gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
        files = changed(cwd, inp.get("head"))
        ok, why = gate.check(inp.get("title", ""), inp.get("body", ""), files)
    except Exception:
        print("{}"); return        # the gate is missing or broken: CI still checks
    if ok:
        # 31/10/2026 (retro, PR 2334): a mobile number in a .md file passed the merge and failed pii-md-test only in CI.
        # A PR that changes a .md file runs the same test here, before it is opened. PR_GATE_PII_CMD replaces the command in tests.
        if any(f.endswith(".md") for f in files):
            cmd = os.environ.get("PR_GATE_PII_CMD") or "%s -I tests/harness/pii-md-test.py" % sys.executable
            try:
                r = subprocess.run(cmd, shell=True, cwd=src, capture_output=True, text=True, encoding="utf-8", timeout=60)
                bad = r.returncode != 0
                out = (r.stdout or "")[-600:]
            except Exception:
                bad, out = False, ""        # the test is missing or slow: CI still checks
            if bad:
                print(json.dumps({"hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "pr-gate: בדיקת הפרטיות (pii-md-test) נכשלה, מספר נייד או אימייל אישי בקובץ md. להחליף בתיאור ('הנייד של מיכאל') ולדחוף שוב:\n" + out}}, ensure_ascii=False))
                return
        print("{}"); return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "pr-gate: התיאור לא יעבור את lessons-gate ב-CI. לתקן לפני פתיחת ה-PR:\n" + why}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
