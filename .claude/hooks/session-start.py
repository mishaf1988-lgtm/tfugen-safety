#!/usr/bin/env python3
"""SessionStart: what CLAUDE.md asks a new session to read, printed for it
(lesson 13 and others were forgotten because the session started by reading
600KB, or nothing). Prints: the skills to load, the root handoff, the open
items in STATUS.md, the open items that may already be done, the open Chrome
tasks, and the last row of project-files/METRICS.md.
In a cloud session it also copies the repo's hooks to ~/.claude/settings.json
(14/10/2026, Michael: "בצע: את שניהם"): when the working directory moved to
/home/user mid-session, the project hooks stopped and nothing said so. Each
copied command first checks $CLAUDE_PROJECT_DIR: in the repo the project hook
runs and the copy does nothing, so no hook runs twice.
Output to stdout becomes context for the session. Never fails the start.

Test:  python3 tests/harness/session-start-test.py
"""
import datetime, json, os, re, shlex, sys
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


def ideas_waiting(cwd):
    """Ideas waiting for Michael's verdict (15/10/2026, project-files/ideas-lab.md, the inventor Routine)."""
    t = read(os.path.join(cwd, "project-files", "ideas-lab.md"))
    sec = t.split("## ממתין להחלטה", 1)[1].split("\n## ", 1)[0] if "## ממתין להחלטה" in t else ""
    return [l[4:].strip()[:100] for l in sec.splitlines() if l.startswith("### ")]


def office_url(cwd):
    """The agents' office page (16/10/2026, Michael: "always pin it to my conversations"). The Artifacts
    button of a conversation lists only the pages opened in it, so every new one opens the office."""
    m = re.search(r"https://claude\.ai/artifact/[A-Za-z0-9]+", read(os.path.join(cwd, "project-files", "routine-office.md")))
    return m.group(0) if m else ""


def report(cwd):
    out = ["== התחלת שיחה (session-start.py) ==",
           "skills לטעון: " + ", ".join(SKILLS) + " (CLAUDE.md, Workflow 1-2)"]
    office = office_url(cwd)
    if office:
        out += ["🏢 משרד הסוכנים: בתחילת השיחה Artifact עם action \"open\" ו-url " + office +
                " (מיכאל, 16/10/2026: \"תמיד הצמד לי אותו לשיחות\"; כפתור Artifacts בשיחה מראה רק מה שנפתח בה)"]
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
    ideas = ideas_waiting(cwd)
    if ideas:
        out += ["", "-- 💡 רעיונות שמחכים להחלטה של מיכאל: %d (project-files/ideas-lab.md). לשאול בשאלון כשמתאים, עד 4 בכל פעם --" % len(ideas)] + ideas
    rows = [l for l in read(os.path.join(cwd, "project-files", "METRICS.md")).splitlines() if l.startswith("|") and not re.match(r"\|\s*-", l)]
    if len(rows) > 1:
        out += ["", "-- METRICS (שורה אחרונה) --", rows[0], rows[-1]]
    return "\n".join(out)


def install_user_hooks(cwd, home=None):
    """Copy the repo's hooks to the user settings, guarded. True if written."""
    if os.environ.get("CLAUDE_CODE_REMOTE") != "true" or os.name != "posix":
        return False  # Michael's Windows computer has its own settings
    root = os.path.abspath(cwd)
    try:
        hooks = json.load(open(os.path.join(root, ".claude", "settings.json"), encoding="utf-8"))["hooks"]
    except Exception:
        return False
    q = shlex.quote(root)
    for groups in hooks.values():
        for g in groups:
            for h in g.get("hooks", []):
                cmd = h["command"].replace('"$CLAUDE_PROJECT_DIR"', q)
                h["command"] = '[ "$CLAUDE_PROJECT_DIR" = %s ] || CLAUDE_PROJECT_DIR=%s %s' % (q, q, cmd)
    f = os.path.join(home or os.path.expanduser("~"), ".claude", "settings.json")
    try:
        cur = json.load(open(f, encoding="utf-8"))
        if not isinstance(cur, dict):
            return False  # not ours to overwrite
    except FileNotFoundError:
        cur = {}
    except Exception:
        return False  # unreadable or half-written settings: do not replace the whole file with just hooks
    # Merge, not replace (retro 15/10/2026): a group of the repo's hooks is replaced, every other
    # group the user or the cloud put there (a Stop check, a notifier) stays.
    as_groups = lambda v: [g for g in v if isinstance(g, dict)] if isinstance(v, list) else []
    group_hooks = lambda g: g.get("hooks") if isinstance(g.get("hooks"), list) else []
    mine = lambda g: any(isinstance(h, dict) and str(h.get("command", "")).startswith('[ "$CLAUDE_PROJECT_DIR" = ') for h in group_hooks(g))  # the wrapper added above
    old = cur.get("hooks") if isinstance(cur.get("hooks"), dict) else {}
    merged = {}
    for ev, groups in old.items():
        keep = [g for g in as_groups(groups) if not mine(g)]
        if keep:
            merged[ev] = keep
    for ev, groups in hooks.items():
        merged[ev] = merged.get(ev, []) + groups
    if cur.get("hooks") == merged:
        return False
    cur["hooks"] = merged
    os.makedirs(os.path.dirname(f), exist_ok=True)
    tmp = f + ".tmp%d" % os.getpid()  # atomic: two sessions or a crash never leave half a file
    try:
        json.dump(cur, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        if os.path.exists(f):
            os.chmod(tmp, os.stat(f).st_mode & 0o777)  # a 0600 file with secrets stays 0600
        os.replace(tmp, f)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        return False
    return True


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
    try:
        install_user_hooks(cwd)
    except Exception:
        pass


if __name__ == "__main__":
    main()
