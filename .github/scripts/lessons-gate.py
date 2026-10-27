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
Since 08/10/2026 a text change there is pushed straight to main: "michael-skills@<sha>" counts too.

Input: env PR_TITLE, PR_BODY; changed file names on stdin, one per line.
Exit 0 = ok, 1 = missing lesson. Called from .github/workflows/tests.yml.
Test: tests/harness/lessons-gate-test.py
"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
FIX = re.compile(r"^\s*(fix|hotfix|תיקון)\b", re.I)
RETRO = re.compile(r"^\s*(retro|רטרו)\s*:\s*(\S.*)$", re.I | re.M)
RETRO_NONE = re.compile(r"^(אין|none|-)\W*$", re.I)
SKILL = re.compile(r"^\s*(skill|סקייל)\s*:\s*(\S.*)$", re.I | re.M)
SKILL_DIRS = (".claude/skills/", "project-files/claude-ai-skill/")
EXT = re.compile(r"michael-skills(#\d+|/pull/\d+|@[0-9a-f]{7,40}\b)")
WAIVER = re.compile(r"^\s*(no-lesson|בלי לקח)\s*:\s*(.{10,})$", re.I | re.M)
DOMAIN_MARK = "## לקחים בתחום"
# 27/10/2026 (Michael in the questionnaire, after CodeRabbit: "do it: a built-in review only for a sensitive PR"):
# a PR touching login, codes, users, signatures or database permissions carries a line "סקירה: <result>" from a
# separate reviewer agent that got the diff, not the author's conclusion (CLAUDE.md, deploy section).
SENSITIVE = ("functions/_middleware.js", "functions/_sign.js", "functions/api/codes.js", "functions/api/create-user.js",
             "functions/api/delete-user.js", "functions/api/rename-user.js", "functions/api/reset-password.js",
             "functions/api/ms-auth.js", "functions/api/trustee-gate.js", "functions/api/self-recovery.js",
             "functions/api/owner-sig.js", "functions/api/_securityselftest.js",
             # 27/10/2026 (Michael: "do it: add to the sensitive list"): code that receives or parses a file or a
             # URL from outside (anonymous trustees, WhatsApp, uploads, mail). The scan that day found the server
             # signing any storage path an anonymous report gave (#2078). wa-hook.js is left out: its signature
             # check and media handling sit in _wa.js, and it changes almost daily.
             "functions/_wa.js", "functions/api/trustee-log.js", "functions/api/trustee-notify.js",
             "functions/api/trustee-gate.js", "functions/api/hazard-file.js", "functions/api/hazard-report.js",
             "functions/api/vitre.js", "functions/api/mail-inbox.js", "functions/api/od-read.js", "functions/api/od-pick.js",
             "functions/api/chat.js", "functions/api/chat-file/[[name]].js", "functions/_closelink.js",
             "functions/_pdftext.js", "functions/_xlsx.js", "functions/_xlsxpatch.js", "functions/_pptx.js",
             "functions/_deckpatch.js", "functions/_ocr.js", "functions/_stt.js")
PERM_SQL = re.compile(r"\b(create|alter|drop)\s+policy\b|\bgrant\b|\brevoke\b|row\s+level\s+security|security\s+definer", re.I)
REVIEW = re.compile(r"^\s*(review|סקירה)\s*:\s*(\S.{4,})$", re.I | re.M)


def sensitive(files):
    """The changed files that need a security review."""
    out = [f for f in files if f in SENSITIVE]
    for f in files:
        if f.startswith("migrations/") and f.endswith(".sql"):
            try:
                if PERM_SQL.search(open(os.path.join(ROOT, f), encoding="utf-8").read()):
                    out.append(f)
            except OSError:
                pass
    return out


def has_domain_lessons(f):
    """A field skill holding lessons (Michael, 11/10/2026: lessons per field)."""
    if not (f.startswith(".claude/skills/") and f.endswith("/SKILL.md")):
        return False
    try:
        return DOMAIN_MARK in open(f, encoding="utf-8").read()
    except OSError:
        return False


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
    # A skill named in the line is the one that changed (17/10/2026, #1619 said "tfugen-ref" and
    # only tfugen-lessons changed: the edit sat in a Bash command a hook blocked before it ran).
    named = [n for n in sorted(set(re.findall(r"\btfugen-[a-z]+(?:-[a-z]+)*\b", sk.group(2))))
             if os.path.isdir(os.path.join(ROOT, ".claude", "skills", n))]
    missing = [n for n in named if not any(f.startswith(".claude/skills/%s/" % n) for f in files)]
    if missing:
        return False, ("the skill line names %s, but no file of it changed in this PR. Update it, "
                       "or name the skill that did change." % ", ".join(missing))
    sens = sensitive(files)
    if sens and not REVIEW.search(body or ""):
        return False, ("this PR touches login, users or database permissions (%s). Run a security review by a "
                       "separate agent that gets the diff (CLAUDE.md, deploy section), fix what it finds, and add "
                       "'סקירה: <what it checked and found>' to the PR description." % ", ".join(sens))
    if not FIX.search(title or ""):
        return True, "not a fix PR"
    if LESSONS in files or any(has_domain_lessons(f) for f in files):
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
