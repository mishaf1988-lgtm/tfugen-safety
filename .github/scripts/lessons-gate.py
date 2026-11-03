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
import subprocess, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

LESSONS = ".claude/skills/tfugen-lessons/SKILL.md"
FIX = re.compile(r"^\s*(fix|hotfix|תיקון)\b", re.I)
RETRO = re.compile(r"^\s*(retro|רטרו)\s*:\s*(\S.*)$", re.I | re.M)
RETRO_NONE = re.compile(r"^(אין|none|-)\W*$", re.I)
# 01/11/2026 (Michael: "I should not have had to tell you. You should have written it down yourself"): two PRs said
# "רטרו: <a mistake>" and carried no lesson, because only a Fix title asked for one. A retro that names a mistake
# now asks for a lesson like a Fix PR. "אין" / "אין טעות" = no mistake.
RETRO_CLEAN = re.compile(r"^(אין|none|-)(\s+טעות)?\W*$", re.I)
SKILL = re.compile(r"^\s*(skill|סקייל)\s*:\s*(\S.*)$", re.I | re.M)
SKILL_DIRS = (".claude/skills/", "project-files/claude-ai-skill/")
EXT = re.compile(r"michael-skills(#\d+|/pull/\d+|@[0-9a-f]{7,40}\b)")
WAIVER = re.compile(r"^\s*(no-lesson|בלי לקח)\s*:\s*(.{10,})$", re.I | re.M)
DOMAIN_MARK = "## לקחים בתחום"
# 27/10/2026 (Michael in the questionnaire, after CodeRabbit: "do it: a built-in review only for a sensitive PR"):
# a PR touching login, codes, users, signatures or database permissions carries a line "סקירה: <result>" from a
# separate reviewer agent that got the diff, not the author's conclusion (CLAUDE.md, core rule 8).
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
# 02/11/2026 (Michael in the questionnaire: "do it: only when the checks change"; retro 28/10/2026 (c, d)): routine-db.js
# is not in SENSITIVE, since almost every PR touches it, so a weakened check there (QUOTE_VALID_RE, mail_forward's subject)
# went in with no review. It needs one only when a changed line, not a comment, refuses something or is a check.
CHECKED_FILES = ("functions/api/routine-db.js",)
CHECK_LINE = re.compile(r"return\s+(jsonResp\(\{\s*ok:\s*false|\{\s*error:)|\b\w+(Check|Gate)\s*\(|function\s+\w+(Check|Gate)\b")


def changes_checks(diff):
    """True when an added or removed code line (not a comment) refuses a request or is a *Check / *Gate."""
    for l in (diff or "").splitlines():
        if l[:1] not in "+-" or l.startswith(("+++", "---")):
            continue
        t = l[1:].strip()
        if t.startswith("//"):
            continue
        if CHECK_LINE.search(t):
            return True
    return False


def file_diff(f):
    """The file's diff against the PR base (CI: $BASE) or origin/main (the pr-gate hook). None = could not read it."""
    base = os.environ.get("BASE")
    rng = [base, "HEAD"] if base else ["origin/main...HEAD"]
    try:
        p = subprocess.run(["git", "diff"] + rng + ["--", f], cwd=ROOT, capture_output=True, text=True, timeout=20)
        return p.stdout if p.returncode == 0 else None
    except Exception:
        return None


# 02/11/2026 (Michael in the questionnaire: "do it: required in every fix (recommended)"; retro 29/10/2026 (f)): the delete
# fix closed one of five "prev" fallbacks and no step asked for the others. A fix PR names where the same pattern was
# searched and what was found, each "fixed" or "left on purpose".
SIBLINGS = re.compile(r"^\s*(siblings|אחים)\s*:\s*(\S.{4,})$", re.I | re.M)
# 02/11/2026 (Michael in the questionnaire: "do it: yes (recommended)"; retro 28/10/2026 (d)): a changed regex or text
# filter is tried on 3 real lines that must match and 3 that must not (QUOTE_VALID_RE matched what it should not).
PAIRS = re.compile(r"^\s*(pairs|זוגות)\s*:\s*(\S.{9,})$", re.I | re.M)
REGEX_LINE = re.compile(r"new RegExp\(|(?:^|[=(,:!&|?]\s*)/(?![/*\s])(?:\\.|[^/\n])+/[gimsuy]*\s*(?:\.(?:test|exec)\(|[;,)])")
FILTER_DIRS = ("functions/", "index.html")


def changes_regex(diff):
    """True when an added or removed code line (not a comment) holds a regex literal or new RegExp."""
    for l in (diff or "").splitlines():
        if l[:1] not in "+-" or l.startswith(("+++", "---")):
            continue
        t = l[1:].strip()
        if t.startswith("//") or t.startswith("*"):
            continue
        if REGEX_LINE.search(t):
            return True
    return False


PERM_SQL = re.compile(r"\b(create|alter|drop)\s+policy\b|\bgrant\b|\brevoke\b|row\s+level\s+security|security\s+definer", re.I)
REVIEW = re.compile(r"^\s*(review|סקירה)\s*:\s*(\S.{4,})$", re.I | re.M)
# 27/10/2026 (Michael in the questionnaire: "do it: brief + refute step", from cloudflare/security-audit-skill): every
# confirmed finding is checked by a fresh agent that tries to disprove it. project-files/security-review.md.
REFUTE = re.compile(r"^\s*(refute|הפרכה)\s*:\s*(\S.{4,})$", re.I | re.M)
# 31/10/2026 (Michael: "מאשר", the upgrade ideas after Ponytail; DECISIONS 31/10/2026): a PR that changes server code
# says what was not checked: skipped tests, an untried path, a risk Michael should know. "מה לא נבדק: אין" is valid.
UNCHECKED = re.compile(r"^\s*(untested|unchecked|מה לא נבדק)\s*:\s*(\S.*)$", re.I | re.M)
UNCHECKED_DIRS = ("functions/",)
# 03/11/2026 (Michael in the questionnaire: "do it: required in every fix (recommended)", retro 21/10/2026 (b), lesson 141:
# a fix in two layers passed with 57 of 57 green and fixed nothing): a fix PR that changes code says how its test was
# proven to catch the bug: the fix taken out on purpose, and which test failed.
BREAK = re.compile(r"^\s*(break|\u05e9\u05d1\u05d9\u05e8\u05d4)\s*:\s*(\S.{9,})$", re.I | re.M)
BREAK_DIRS = ("functions/", "index.html", "tools/", ".claude/hooks/", ".github/scripts/", "chat/")


def sensitive(files):
    """The changed files that need a security review."""
    out = [f for f in files if f in SENSITIVE]
    for f in files:
        if f in CHECKED_FILES:
            d = file_diff(f)
            if d is None or changes_checks(d):  # a diff that cannot be read counts as a change to the checks
                out.append(f)
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
    # 27/10/2026: a skill's lessons may sit in its references/ (tfugen-dev/references/lessons.md)
    if not (f.startswith(".claude/skills/") and (f.endswith("/SKILL.md") or ("/references/" in f and f.endswith(".md")))):
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
                       "separate agent that gets the diff (CLAUDE.md, core rule 8; the brief: project-files/security-review.md), fix what it finds, and add "
                       "'סקירה: <what it checked and found>' to the PR description." % ", ".join(sens))
    if sens and not REFUTE.search(body or ""):
        return False, ("this PR touches login, users or database permissions (%s). Each confirmed finding of the review "
                       "goes to a fresh agent that tries to disprove it (project-files/security-review.md); add "
                       "'הפרכה: <what held and what was disproved>' or 'הפרכה: אין ממצא מאושר'." % ", ".join(sens))
    if any(f.startswith(UNCHECKED_DIRS) for f in files) and not UNCHECKED.search(body or ""):
        return False, ("this PR changes server code (functions/). Add a line 'מה לא נבדק: <what was skipped or not tried, "
                       "and a risk Michael should know>' or 'מה לא נבדק: אין' (tfugen-dev, the ladder).")
    retro_mistake = not RETRO_CLEAN.match(RETRO.search(body or "").group(2).strip())
    if FIX.search(title or "") and not SIBLINGS.search(body or ""):
        return False, ("a fix PR names the siblings of what it fixed: 'אחים: <the grep of the pattern, each place found: "
                       "fixed / left on purpose and why>' (Michael 02/11/2026, retro 29/10/2026 (f)).")
    if FIX.search(title or "") and any(f.startswith(BREAK_DIRS) for f in files) and not BREAK.search(body or ""):
        return False, ("a fix PR that changes code proves its test catches the bug: take the fix out, run the test, "
                       "and add 'שבירה: <what was taken out, which test failed and how many>' (Michael 03/11/2026, "
                       "retro 21/10/2026 (b), lesson 141).")
    flt = [f for f in files if f.startswith(FILTER_DIRS) and f.endswith((".js", ".html"))]
    if flt and not PAIRS.search(body or "") and any(changes_regex(file_diff(f) or "") for f in flt):
        return False, ("this PR changes a regex or a text filter (%s). Add 'זוגות: <the test that tries it on 3 real lines "
                       "that must match and 3 that must not>' (Michael 02/11/2026, retro 28/10/2026 (d))." % ", ".join(flt))
    if not FIX.search(title or "") and not retro_mistake:
        return True, "not a fix PR"
    if LESSONS in files or any(has_domain_lessons(f) for f in files):
        return True, "fix PR with a lesson"
    m = WAIVER.search(body or "")
    if m:
        return True, "fix PR, no lesson: " + m.group(2).strip()
    return False, (("the retro line names a mistake, " if not FIX.search(title or "") else "") + "fix PR without a lesson. Add an entry to %s in this PR, or a line "
                   "'no-lesson: <reason>' (or 'בלי לקח: <סיבה>') to the PR description." % LESSONS)


if __name__ == "__main__":
    files = [l.strip() for l in sys.stdin if l.strip()]
    ok, why = check(os.environ.get("PR_TITLE", ""), os.environ.get("PR_BODY", ""), files)
    print("lessons-gate: " + why)
    sys.exit(0 if ok else 1)
