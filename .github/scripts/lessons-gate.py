#!/usr/bin/env python3
"""A fix PR must carry its lesson (Michael, 01/10/2026: every mistake that is
discovered goes into .claude/skills/tfugen-lessons/SKILL.md in the same PR as
its fix). Until now the rule was text only.

A PR whose title starts with Fix / Hotfix / תיקון passes only if it changes the
lessons file, or its description has a line "no-lesson: <reason>" or
"בלי לקח: <reason>" with a reason of at least a few words.

Input: env PR_TITLE, PR_BODY; changed file names on stdin, one per line.
Exit 0 = ok, 1 = missing lesson. Called from .github/workflows/tests.yml.
Test: tests/harness/lessons-gate-test.py
"""
import os, re, sys

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
FIX = re.compile(r"^\s*(fix|hotfix|תיקון)\b", re.I)
WAIVER = re.compile(r"^\s*(no-lesson|בלי לקח)\s*:\s*(.{10,})$", re.I | re.M)


def check(title, body, files):
    if not FIX.search(title or ""):
        return True, "not a fix PR"
    if LESSONS in files:
        return True, "fix PR with a lesson"
    m = WAIVER.search(body or "")
    if m:
        return True, "fix PR, no lesson: " + m.group(2).strip()
    return False, ("fix PR without a lesson. Add an entry to %s in this PR, or a line "
                   "'no-lesson: <reason>' (or 'בלי לקח: <סיבה>') to the PR description." % LESSONS)


if __name__ == "__main__":
    files = [l.strip() for l in sys.stdin if l.strip()]
    ok, why = check(os.environ.get("PR_TITLE", ""), os.environ.get("PR_BODY", ""), files)
    print("lessons-gate: " + why)
    sys.exit(0 if ok else 1)
