#!/usr/bin/env python3
"""SessionStart: what CLAUDE.md asks a new session to read, printed for it
(lesson 13 and others were forgotten because the session started by reading
600KB, or nothing). Prints: the skills to load, the root handoff, the open
items in STATUS.md, the open items that may already be done, the open Chrome
tasks, and the last row of project-files/METRICS.md.
Output to stdout becomes context for the session. Never fails the start.

Test:  python3 tests/harness/session-start-test.py
"""
import datetime, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

SKILLS = ["tfugen-lean", "tfugen-lessons", "tfugen-ref"]
MAX_HANDOFF = 3000
MAX_OPEN = 25
MAX_MAYBE = 3


def read(p):
    try:
        return open(p, encoding="utf-8").read()
    except Exception:
        return ""


def chrome_open(cwd):
    """Open tasks for Claude in Chrome (Michael, 12/10/2026: "remind me to ask Chrome")."""
    t = read(os.path.join(cwd, "project-files", "chrome-queue.md"))
    return [re.sub(r"\s+", " ", l.strip())[:160] for l in t.splitlines() if re.match(r"- \[ \] \*\*C\d+", l)]


def _dates(t, iso):
    """Dates up to today: DD/MM/YYYY, and YYYY-MM-DD when iso. A test file's ISO dates
    are fixtures, and a date after today is a fixture too, so neither counts."""
    today = datetime.date.today().timetuple()[:3]
    out = [(int(y), int(m), int(d)) for d, m, y in re.findall(r"\b(\d\d)/(\d\d)/(20\d\d)\b", t)]
    if iso:
        out += [(int(y), int(m), int(d)) for y, m, d in re.findall(r"\b(20\d\d)-(\d\d)-(\d\d)\b", t)]
        for d, m in re.findall(r"(?<![\d/])(\d\d?)/(\d\d?)(?![\d/])", t):  # "28/09" in an old item: the last such day
            if 1 <= int(d) <= 31 and 1 <= int(m) <= 12:
                x = (today[0], int(m), int(d))
                out.append(x if x <= today else (today[0] - 1, int(m), int(d)))
    return [x for x in out if x <= today]


def maybe_done(cwd, lines):
    """Open STATUS items whose test changed after the item's last date (lesson 15, 14/10/2026:
    "שאר תווי המקלדת" sat open 11 days after keyboard-only-test.js had done it, and Michael
    was asked again). Oldest item first, MAX_MAYBE of them. Checking one ends with closing it
    or with "נבדק DD/MM/YYYY: ..." on its line, and that date silences it."""
    found, parent = [], (0, 0, 0)
    for n, l in enumerate(lines, 1):
        if re.match(r"- \[", l):  # a top-level item; an indented one under it carries its date
            parent = max(_dates(l, True) or [(0, 0, 0)])
        if not re.match(r"\s*- \[ \]", l):
            continue
        mine = max(_dates(l, True) + [parent])
        for t in sorted(set(re.findall(r"[\w.-]+-test\.(?:py|js|mjs)", l))):
            td = max(_dates(read(os.path.join(cwd, "tests", "harness", t)), False) or [(0, 0, 0)])
            if td > mine:
                found.append((mine, n, t, td, re.sub(r"\s+", " ", l.strip())[6:96]))
                break
    fmt = lambda x: "%02d/%02d/%d" % (x[2], x[1], x[0]) if x[0] else "בלי תאריך"
    return ["STATUS.md:%d %s | %s עודכנה %s, הפריט %s" % (n, txt, t, fmt(td), fmt(mine))
            for mine, n, t, td, txt in sorted(found)[:MAX_MAYBE]], len(found)


def report(cwd):
    out = ["== התחלת שיחה (session-start.py) ==",
           "skills לטעון: " + ", ".join(SKILLS) + " (CLAUDE.md, Workflow 1-2)"]
    hand = sorted(n for n in os.listdir(cwd) if n.startswith("handoff-") and n.endswith(".md")) if os.path.isdir(cwd) else []
    for n in hand:
        t = read(os.path.join(cwd, n))
        out += ["", "-- " + n + " --", t[:MAX_HANDOFF] + ("\n[...נחתך]" if len(t) > MAX_HANDOFF else "")]
    status = read(os.path.join(cwd, "STATUS.md")).splitlines()
    opens = [l.strip() for l in status if re.match(r"\s*- \[ \]", l)]
    out += ["", "-- STATUS.md: %d פריטים פתוחים --" % len(opens)] + [o[:200] for o in opens[:MAX_OPEN]]
    maybe, total = maybe_done(cwd, status)
    if maybe:
        out += ["", "-- אולי כבר בוצעו: %d פריטים שהבדיקה שלהם עודכנה אחרי התאריך האחרון בשורה (מוצגים %d הישנים). "
                "לבדוק כל אחד בקוד, ואז לסגור לארכיון או להוסיף לשורה \"נבדק DD/MM/YYYY: עדיין פתוח כי ...\" (לקח 15) --"
                % (total, len(maybe))] + maybe
    chrome = chrome_open(cwd)
    if chrome:
        out += ["", "-- 🌐 משימות לכרום: %d פתוחות (project-files/chrome-queue.md). להזכיר למיכאל --" % len(chrome)] + chrome
    rows = [l for l in read(os.path.join(cwd, "project-files", "METRICS.md")).splitlines() if l.startswith("|") and not re.match(r"\|\s*-", l)]
    if len(rows) > 1:
        out += ["", "-- METRICS (שורה אחרונה) --", rows[0], rows[-1]]
    return "\n".join(out)


def main():
    d = {}
    if not sys.stdin.isatty():
        try:
            d = json.load(sys.stdin)
        except Exception:
            d = {}
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or d.get("cwd") or "."
    try:
        print(report(cwd))
    except Exception:
        pass


if __name__ == "__main__":
    main()
