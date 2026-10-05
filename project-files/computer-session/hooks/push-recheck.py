#!/usr/bin/env python3
"""PostToolUse (Bash, `git push`): push-gate.py checks before the command runs,
so a commit made in the same command (git commit ... && git push) is not seen.
After the push, run lessons-format-test.py again when the lessons file differs
from origin/main, and warn (additionalContext) if it is red: fix and push again
before CI goes red.

Tests set PUSH_RECHECK_CHANGED and PUSH_RECHECK_TEST, like push-gate.
Test:  python3 tests/harness/push-recheck-test.py
"""
import json, os, re, subprocess, sys

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
TEST = "tests/harness/lessons-format-test.py"


def changed(cwd):
    env = os.environ.get("PUSH_RECHECK_CHANGED")
    if env is not None:
        return [x for x in env.split(",") if x]
    p = subprocess.run(["git", "diff", "--name-only", "origin/main...HEAD"], cwd=cwd, capture_output=True, text=True, timeout=20)
    return p.stdout.split()


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    cmd = (d.get("tool_input") or {}).get("command", "") or ""
    if d.get("tool_name") != "Bash" or not re.search(r"(^|[;&|\s])git\s+push\b", cmd):
        print("{}"); return
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd, capture_output=True, text=True, timeout=10).stdout.strip()
        cwd = top or cwd
        if LESSONS not in changed(cwd):
            print("{}"); return
        test = os.environ.get("PUSH_RECHECK_TEST") or os.path.join(cwd, TEST)
        p = subprocess.run([sys.executable, test], cwd=cwd, capture_output=True, text=True, timeout=120)
    except Exception:
        print("{}"); return
    if p.returncode == 0:
        print("{}"); return
    tail = "\n".join((p.stdout + p.stderr).strip().splitlines()[-4:])
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext":
        "push-recheck (לקח 41): אחרי ה-push קובץ הלקחים אדום ב-lessons-format-test.py, ו-CI ייכשל. לתקן ולדחוף שוב:\n" + tail}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
