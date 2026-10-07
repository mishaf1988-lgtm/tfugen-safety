#!/usr/bin/env python3
"""A fix PR must carry its lesson (Michael, 01/10/2026: every mistake that is
discovered goes into .claude/skills/tfugen-lessons/SKILL.md in the same PR as
its fix). Until now the rule was text only.

A PR whose title starts with Fix / Hotfix / תיקון passes only if it changes the
lessons file, or its description has a line "no-lesson: <reason>" or
"בלי לקח: <reason>" with a reason of at least a few words.

Every PR (01/10/2026, "a machine that learns"): its description has a retro
line, "retro: <answer>" or "רטרו: <תשובה>", answering three questions: what
failed on the first try, what Michael corrected or said "not what I meant",
what took more rounds than it should. "רטרו: אין" / "retro: none" is a valid
answer. A correction from Michael in the chat never passes through a Fix PR,
so without this line it is never written down. monthly-metrics.py counts the
retro lines that found something.

Every PR (02/10/2026, Michael: "the skill has to keep learning from every job
we do"): a line "skill: <what was learned and where>" or "skill: אין". Any
answer other than none must come with a changed file under .claude/skills/ or
project-files/claude-ai-skill/, so "learned" means written down, not said. Since 07/10/2026
the account skills live in michael-skills: "michael-skills#N" in the line counts.

Input: env PR_TITLE, PR_BODY; changed file names on stdin, one per line.
Exit 0 = ok, 1 = missing lesson. Called from .github/workflows/tests.yml.
Test: tests/harness/lessons-gate-test.py
"""
import os, re, sys

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
FIX = re.compile(r"^\s*(fix|hotfix|תיקון)\b", re.I)
RETRO = re.compile(r"^\s*(retro|רטרו)\s*:\s*(\S.*)$", re.I | re.M)
RETRO_NONE = re.compile(r"^(אין|none|-)\W*$", re.I)
SKILL = re.compile(r"^\s*(skill|סקייל)\s*:\s*(\S.*)$", re.I | re.M)
SKILL_DIRS = (".claude/skills/", "project-files/claude-ai-skill/")
EXT = re.compile(r"michael-skills(#|/pull/)\d+")
WAIVER = re.compile(r"^\s*(no-lesson|בלי לקח)\s*:\s*(.{10,})$", re.I | re.M)


def check(title, body, files):
    if not RETRO.search(body or ""):
        return False, ("no retro line. Add to the PR description a line 'רטרו: <answer>' "
                       "(what failed on the first try, what Michael corrected, what took too "
                       "many rounds), or 'רטרו: אין'. See tfugen-lessons, section Retro.")
    sk = SKILL.search(body or "")
    if not sk:
        return False, ("no skill line. Add 'skill: <what was learned, which skill was updated>' "
                       "or 'skill: אין'. See tfugen-lessons, section Retro.")
    if not RETRO_NONE.match(sk.group(2).strip()) and not any(f.startswith(SKILL_DIRS) for f in files) and not EXT.search(sk.group(2)):
        return False, ("the skill line says something was learned, but no skill file changed. "
                       "Update a SKILL.md under .claude/skills/ (or name the michael-skills PR: michael-skills#N) "
                       "in this PR, or write 'skill: אין'.")
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
