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
It lets the stop through when the reply ends on a question to Michael (an
approval he must give), when ci-wait.sh is running in the background (its
end wakes the session), and never blocks twice in a row (stop_hook_active).

Test:  python3 tests/harness/supervisor-test.py
"""
import json, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)

PROPOSALS = "הצעות לשדרוג"


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


def verdict(cwd, text, tools, waiting, recent=None):
    if text.rstrip()[-400:].count("?"):
        return None
    if waiting:
        return None
    rc, dirty = git(cwd, "status", "--porcelain", "--untracked-files=no")
    if rc == 0 and dirty:
        return "המפקח: יש שינויים שלא נכנסו ל-commit:\n" + dirty[:400] + "\nלסיים: בדיקות, commit, PR, מיזוג. או להסביר למיכאל למה עוצרים."
    rc, ahead = git(cwd, "rev-list", "--count", "origin/main..HEAD")
    if rc == 0 and ahead not in ("", "0"):
        return ("המפקח: %s commits על ה-branch עוד לא ב-main (Cloudflare מפרסם רק את main). "
                "לפתוח PR אם אין, להריץ ברקע ci-wait.sh ולמזג כשירוק (לקח 25)." % ahead)
    merged = any(t.endswith("merge_pull_request") for t in tools)
    merged_since = any(t.endswith("merge_pull_request") for t in (tools if recent is None else recent))
    # Michael, 02/10/2026 ("remember we said you must recommend new skills or
    # upgrades"): a task summary after a merge carries the proposals section.
    # The rule was text in tfugen-screen-review and was forgotten the same day.
    if merged_since and PROPOSALS not in text:
        return ("המפקח: מוזג, ובסיכום אין סעיף \"💡 הצעות לשדרוג\" (tfugen-screen-review; מיכאל 02/10/2026). "
                "להוסיף: skill לעדכן או ליצור, בדיקה או hook שיתפסו טעות שחזרה, ומה מהם נעשה לבד.")
    if merged and not any(t.endswith("create_session") for t in tools) and not no_code_handoff(cwd):
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
        text, tools, recent = transcript(data["transcript_path"])
        reason = verdict(cwd, text, tools, ci_wait_running(), recent)
    except Exception:
        sys.exit(0)
    if reason:
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
