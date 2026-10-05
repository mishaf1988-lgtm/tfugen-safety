#!/usr/bin/env python3
"""SessionStart: what CLAUDE.md asks a new session to read, printed for it
(lesson 13 and others were forgotten because the session started by reading
600KB, or nothing). Prints: the skills to load, the root handoff, the open
items in STATUS.md, and the last row of project-files/METRICS.md.
Output to stdout becomes context for the session. Never fails the start.

Test:  python3 tests/harness/session-start-test.py
"""
import json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

SKILLS = ["tfugen-lean", "tfugen-lessons", "tfugen-ref"]
MAX_HANDOFF = 3000
MAX_OPEN = 25


def read(p):
    try:
        return open(p, encoding="utf-8").read()
    except Exception:
        return ""


def report(cwd):
    out = ["== התחלת שיחה (session-start.py) ==",
           "skills לטעון: " + ", ".join(SKILLS) + " (CLAUDE.md, Workflow 1-2)"]
    hand = sorted(n for n in os.listdir(cwd) if n.startswith("handoff-") and n.endswith(".md")) if os.path.isdir(cwd) else []
    for n in hand:
        t = read(os.path.join(cwd, n))
        out += ["", "-- " + n + " --", t[:MAX_HANDOFF] + ("\n[...נחתך]" if len(t) > MAX_HANDOFF else "")]
    opens = [l.strip() for l in read(os.path.join(cwd, "STATUS.md")).splitlines() if re.match(r"\s*- \[ \]", l)]
    out += ["", "-- STATUS.md: %d פריטים פתוחים --" % len(opens)] + [o[:200] for o in opens[:MAX_OPEN]]
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
