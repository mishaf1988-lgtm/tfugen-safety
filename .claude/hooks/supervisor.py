#!/usr/bin/env python3
"""Stop hook: the supervisor (Michael, 01/10/2026: "a supervisor that, when you
stop, tells you to keep learning and working"). Lessons 24 and 25 were text:
Claude stopped with a PR not merged, or waited for Michael with work left.

Before a turn ends it checks, locally and without network:
  1. tracked files changed and not committed  -> block
  2. the branch has commits not in origin/main -> block (PR, ci-wait, merge)
  3. a PR was merged since the last reply that had a "הצעות לשדרוג" section,
     and this reply has none -> block (Michael, 02/10/2026). Only merges
     after that reply count (05/10/2026: one merge early in a long session
     made every later short reply carry the section again)
  4. a PR was merged in this session and no next session was opened
     (create_session) -> block (lesson? then handoff, or the next item),
     unless the handoff in the repo root says "אין קוד" (CLAUDE.md, #1099:
     no code item without Michael = the session stays open for his answer)
  5. a PR was merged since the last reply, project-files/chrome-queue.md has
     open tasks, and the reply has no "לכרום" line -> block (Michael, 12/10/2026)
  6. session-start.py asked to open the agents' office (🏢) and no Artifact
     "open" of that url came after it -> block, even on a question or with
     ci-wait running (Michael, 16/10/2026: "לא תמיד מציג את המשרד": the
     session was resumed twice, the hook asked again, and it was not opened)
  7. the reply says it added to / updated / recorded in STATUS, DECISIONS,
     BACKLOG, CLAUDE.md, ideas-lab or a tfugen-* skill, and that file changed
     neither locally nor on origin/main in the last 12 hours -> block
     (STATUS 99, Michael 12/10/2026: "מאשר"; lesson 42, lesson 19 recurred)
It lets the stop through when the reply ends on a question to Michael (an
approval he must give), when ci-wait.sh is running in the background (its
end wakes the session), and never blocks twice in a row (stop_hook_active).

Test:  python3 tests/harness/supervisor-test.py
"""
import json, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

PROPOSALS = "הצעות לשדרוג"
CHROME = "לכרום"


def chrome_open(cwd):
    try:
        t = open(os.path.join(cwd, "project-files", "chrome-queue.md"), encoding="utf-8").read()
    except Exception:
        return []
    return [l for l in t.splitlines() if re.match(r"- \[ \] \*\*C\d+", l)]


def chrome_done(cwd):
    """C-numbers already marked [x] in chrome-queue.md."""
    try:
        t = open(os.path.join(cwd, "project-files", "chrome-queue.md"), encoding="utf-8").read()
    except Exception:
        return set()
    return set(re.findall(r"^- \[x\] \*\*(C\d+)\b", t, re.M))


def chrome_stale(cwd, text):
    """13/10/2026 (Michael: "I think Chrome is already closed"): a "לכרום" line that still
    names tasks another session closed. Three summaries in a row listed C1-C3 from memory."""
    done = chrome_done(cwd)
    named = set()
    for line in text.splitlines():
        if CHROME in line:
            named |= set(re.findall(r"\bC\d+\b", line))
    return sorted(named & done, key=lambda c: int(c[1:]))


def git(cwd, *args):
    p = subprocess.run(["git"] + list(args), cwd=cwd, capture_output=True, text=True, timeout=20)
    return p.returncode, p.stdout.strip()


def transcript(path):
    """(text of the assistant's last turn, tool names used in the whole session,
    tool names used since the last assistant text with the proposals section)."""
    texts, tools, recent = [], set(), set()
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                msg = json.loads(line).get("message") or {}
            except Exception:
                continue
            content = msg.get("content")
            if msg.get("role") == "user":
                if isinstance(content, list) and all(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
                    continue
                texts = []
            elif msg.get("role") == "assistant" and isinstance(content, list):
                for c in content:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") == "text":
                        texts.append(c.get("text", ""))
                        if PROPOSALS in c.get("text", ""):
                            recent = set()
                    elif c.get("type") == "tool_use":
                        tools.add(c.get("name", ""))
                        recent.add(c.get("name", ""))
    return "\n".join(texts), tools, recent


OFFICE_MARK = "🏢 משרד הסוכנים"


def office_pending(path):
    """The office url the last SessionStart (startup or resume) asked to open, when
    no Artifact open of it followed; else None. The Artifacts button of a session
    shows only what was opened in it (session-start.py), and a resumed session is
    asked again, so each SessionStart needs its own open."""
    pending = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except Exception:
                continue
            att = row.get("attachment") or {}
            if att.get("hookEvent") == "SessionStart" and OFFICE_MARK in str(att.get("content", "")):
                m = re.search(r"https://claude\.ai/artifact/([A-Za-z0-9]+)", str(att.get("content", "")))
                pending = m.group(0) if m else pending
                continue
            msg = row.get("message") or {}
            if pending and msg.get("role") == "assistant" and isinstance(msg.get("content"), list):
                for c in msg["content"]:
                    inp = c.get("input") if isinstance(c, dict) and c.get("type") == "tool_use" and c.get("name") == "Artifact" else None
                    if isinstance(inp, dict) and inp.get("action") == "open" and pending.rsplit("/", 1)[-1] in str(inp.get("url", "")):
                        pending = None
    return pending


def ci_wait_running():
    if os.environ.get("SUPERVISOR_CI_WAIT") in ("0", "1"):   # tests
        return os.environ["SUPERVISOR_CI_WAIT"] == "1"
    p = subprocess.run(["pgrep", "-f", "ci-wait.sh"], capture_output=True, text=True)
    return p.returncode == 0


def no_code_handoff(cwd):
    """The root handoff (only one, handoff-root-test.py) says there is no code item."""
    try:
        names = [n for n in os.listdir(cwd) if n.startswith("handoff-") and n.endswith(".md")]
        return any(re.search("אין (פריט )?קוד", open(os.path.join(cwd, n), encoding="utf-8").read()) for n in names)
    except Exception:
        return False


def chain_limit_handoff(cwd):
    """The root handoff says this session is generation 7 or later and Michael opens the next one
    by hand: create_session is refused there (lineage limit 8, CLAUDE.md), so asking for it loops
    forever (13/10/2026, four blocks in a row in a generation-8 session, lesson 87)."""
    try:
        names = [n for n in os.listdir(cwd) if n.startswith("handoff-") and n.endswith(".md")]
        for n in names:
            t = open(os.path.join(cwd, n), encoding="utf-8").read()
            m = re.search(r"דור (\d+)", t)
            if m and int(m.group(1)) >= 7 and "ביד" in t:
                return True
    except Exception:
        pass
    return False


def squashed_into_main(cwd):
    """A squash merge leaves the branch commits "ahead" by hash, though main has
    their content (09/10/2026, a false block after #1257). True when every file
    the branch changed since the merge base is identical in origin/main."""
    rc, base = git(cwd, "merge-base", "origin/main", "HEAD")
    if rc or not base:
        return False
    rc, files = git(cwd, "diff", "--name-only", base, "HEAD")
    if rc or not files:
        return False
    p = subprocess.run(["git", "diff", "--quiet", "origin/main", "HEAD", "--"] + files.splitlines(), cwd=cwd, timeout=20)
    return p.returncode == 0


# "I added / updated / it was recorded" next to a shared file (STATUS 99).
CLAIM_VERB = re.compile(r"(הוספתי|עדכנתי|רשמתי|נרשם|נרשמה|נרשמו|נוסף|נוספה|נוספו|עודכן|עודכנה|עודכנו)")
CLAIM_FILES = [("STATUS-archive", "project-files/STATUS-archive.md"), ("STATUS", "STATUS.md"),
               ("DECISIONS", "DECISIONS.md"), ("BACKLOG", "project-files/BACKLOG.md"),
               ("CLAUDE.md", "CLAUDE.md"), ("ideas-lab", "project-files/ideas-lab.md")]


def claimed_files(text):
    """The repo files the reply says it wrote to, as paths."""
    out = set()
    for line in text.splitlines():
        if not CLAIM_VERB.search(line):
            continue
        rest = line
        for name, path in CLAIM_FILES:
            if re.search(r"(?<!\w)" + re.escape(name) + r"(?![\w-])", rest):
                out.add(path)
                rest = rest.replace(name, " ")
        for sk in re.findall(r"\btfugen-[a-z]+\b", rest):
            out.add(".claude/skills/%s/SKILL.md" % sk)
    return out


def unchanged_claims(cwd, text):
    """Claimed files that changed neither in the work tree nor on origin/main in 12 hours."""
    claimed = claimed_files(text)
    if not claimed:
        return []
    rc1, local = git(cwd, "diff", "--name-only", "HEAD")
    rc2, recent = git(cwd, "log", "origin/main", "--since=12 hours ago", "--name-only", "--format=")
    rc3, branch = git(cwd, "diff", "--name-only", "origin/main...HEAD")
    if rc2:
        return []  # no origin/main to compare with: say nothing
    changed = set((local + "\n" + recent + "\n" + branch).split())
    return sorted(f for f in claimed if f not in changed and os.path.exists(os.path.join(cwd, f)))


def verdict(cwd, text, tools, waiting, recent=None):
    if text.rstrip()[-400:].count("?"):
        return None
    if waiting:
        return None
    rc, dirty = git(cwd, "status", "--porcelain", "--untracked-files=no")
    if rc == 0 and dirty:
        return "המפקח: יש שינויים שלא נכנסו ל-commit:\n" + dirty[:400] + "\nלסיים: בדיקות, commit, PR, מיזוג. או להסביר למיכאל למה עוצרים."
    rc, ahead = git(cwd, "rev-list", "--count", "origin/main..HEAD")
    if rc == 0 and ahead not in ("", "0") and not squashed_into_main(cwd):
        return ("המפקח: %s commits על ה-branch עוד לא ב-main (Cloudflare מפרסם רק את main). "
                "לפתוח PR אם אין, להריץ ברקע ci-wait.sh ולמזג כשירוק (לקח 25)." % ahead)
    ghost = unchanged_claims(cwd, text)
    if ghost:
        return ("המפקח: כתבת שהוספת או עדכנת את %s, והקובץ לא השתנה (לא מקומית ולא ב-main ב-12 השעות האחרונות). "
                "לכתוב את זה עכשיו, או לתקן את התשובה (STATUS 99, לקח 19)." % ", ".join(ghost))
    merged = any(t.endswith("merge_pull_request") for t in tools)
    merged_since = any(t.endswith("merge_pull_request") for t in (tools if recent is None else recent))
    # Michael, 02/10/2026 ("remember we said you must recommend new skills or
    # upgrades"): a task summary after a merge carries the proposals section.
    # The rule was text in tfugen-screen-review and was forgotten the same day.
    if merged_since and PROPOSALS not in text:
        return ("המפקח: מוזג, ובסיכום אין סעיף \"💡 הצעות לשדרוג\" (tfugen-screen-review; מיכאל 02/10/2026). "
                "להוסיף: skill לעדכן או ליצור, בדיקה או hook שיתפסו טעות שחזרה, ומה מהם נעשה לבד.")
    # Michael, 12/10/2026: "remind me to ask Chrome". A task summary after a merge
    # names the open tasks in project-files/chrome-queue.md.
    stale = chrome_stale(cwd, text)
    if stale:
        return ("המפקח: בשורת \"🌐 לכרום\" מופיעות משימות שכבר סגורות ב-project-files/chrome-queue.md: %s. "
                "לקרוא את הקובץ מחדש (git fetch) ולכתוב רק את מה שפתוח (לקח 85)." % ", ".join(stale))
    chrome = chrome_open(cwd)
    if merged_since and chrome and CHROME not in text:
        return ("המפקח: יש %d משימות פתוחות לכרום (project-files/chrome-queue.md), ובסיכום אין שורה \"🌐 לכרום\" "
                "(מיכאל 12/10/2026: \"לתזכר אותי לבקש מהכרום\"). להוסיף: מה מחכה, ושהטקסט להדבקה בקובץ." % len(chrome))
    # Michael, 20/10/2026: "write me what to pass to Chrome, in a box, always". A "לכרום" line
    # that names an open task carries its paste text as a code block in the reply itself.
    if CHROME in text and chrome and "```" not in text:
        return ("המפקח: יש שורת \"🌐 לכרום\" בלי תיבה עם הטקסט להדבקה (מיכאל 20/10/2026: \"רשום לי מה להעביר לכרום בתיבה תמיד\"). "
                "להדביק בתשובה את הטקסט של המשימה מ-project-files/chrome-queue.md בבלוק קוד.")
    if merged and not any(t.endswith("create_session") for t in tools) and not no_code_handoff(cwd) and not chain_limit_handoff(cwd):
        return ("המפקח: מוזג, ולא נפתחה שיחה הבאה. לפני שעוצרים: היה לקח? (tfugen-lessons). "
                "אחר כך הפריט הבא שאפשר לעשות בקוד מ-STATUS/BACKLOG (לקח 24), "
                "או handoff + create_session + archive_session (CLAUDE.md, שיחה ארוכה).")
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    if data.get("stop_hook_active"):
        sys.exit(0)
    cwd = data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or "."
    try:
        office = office_pending(data["transcript_path"])
        if office:
            print(json.dumps({"decision": "block", "reason": "המפקח: השיחה התחילה או הופעלה מחדש, והמשרד לא נפתח (מיכאל 16/10/2026: \"לא תמיד מציג את המשרד\"). "
                              "לקרוא ל-Artifact עם action \"open\" ו-url " + office + ", ואז לסיים."}, ensure_ascii=False))
            sys.exit(0)
        text, tools, recent = transcript(data["transcript_path"])
        reason = verdict(cwd, text, tools, ci_wait_running(), recent)
    except Exception:
        sys.exit(0)
    if reason:
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
