#!/usr/bin/env python3
"""PreToolUse (Bash): before `git push`, the file checks that CI would run on the
changed files run here first (lesson 41, 02/10/2026: the lessons file went out
170 bytes over its cap and CI went red for a round).

Today one check: tests/harness/lessons-format-test.py when
.claude/skills/tfugen-lessons/SKILL.md differs from origin/main. Red = deny,
with the test's last lines as the reason. Anything else passes.

Tests set PUSH_GATE_CHANGED (comma list of changed files) and PUSH_GATE_TEST
(a script to run instead of the real one).

Test:  python3 tests/harness/push-gate-test.py
"""
import json, os, re, subprocess, sys

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
TEST = "tests/harness/lessons-format-test.py"


def changed(cwd):
    env = os.environ.get("PUSH_GATE_CHANGED")
    if env is not None:
        return [x for x in env.split(",") if x]
    try:
        p = subprocess.run(["git", "diff", "--name-only", "origin/main...HEAD"], cwd=cwd, capture_output=True, text=True, timeout=20)
        files = p.stdout.split()
        p = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=cwd, capture_output=True, text=True, timeout=20)
        files += [l[3:] for l in p.stdout.splitlines() if len(l) > 3]
        return files
    except Exception:
        return []


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    cmd = (d.get("tool_input") or {}).get("command", "") or ""
    if d.get("tool_name", "Bash") != "Bash" or not re.search(r"(^|[;&|\s])git\s+push\b", cmd):
        print("{}"); return
    # The repo root, not the shell's cwd (the first live run came from tests/harness
    # and looked for tests/harness/tests/harness/...).
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True, timeout=10).stdout.strip()
        if top:
            cwd = top
    except Exception:
        pass
    if LESSONS not in changed(cwd):
        print("{}"); return
    test = os.environ.get("PUSH_GATE_TEST") or os.path.join(cwd, TEST)
    try:
        p = subprocess.run([sys.executable, test], cwd=cwd, capture_output=True, text=True, timeout=120)
    except Exception as e:
        print("{}"); return
    if p.returncode == 0:
        print("{}"); return
    tail = "\n".join((p.stdout + p.stderr).strip().splitlines()[-4:])
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason":
            "push-gate (לקח 41): קובץ הלקחים השתנה ו-lessons-format-test.py אדום. לתקן לפני push:\n" + tail}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
