#!/usr/bin/env python3
"""Stop hook: the supervisor (Michael, 01/10/2026: "a supervisor that, when you
stop, tells you to keep learning and working"). Lessons 24 and 25 were text:
Claude stopped with a PR not merged, or waited for Michael with work left.

Before a turn ends it checks, locally and without network:
  1. tracked files changed and not committed  -> block
  2. the branch has commits not in origin/main -> block (PR, ci-wait, merge)
  3. a PR was merged in this session and no next session was opened
     (create_session) -> block (lesson? then handoff, or the next item)
It lets the stop through when the reply ends on a question to Michael (an
approval he must give), when ci-wait.sh is running in the background (its
end wakes the session), and never blocks twice in a row (stop_hook_active).

Test:  python3 tests/harness/supervisor-test.py
"""
import json, os, subprocess, sys


def git(cwd, *args):
    p = subprocess.run(["git"] + list(args), cwd=cwd, capture_output=True, text=True, timeout=20)
    return p.returncode, p.stdout.strip()


def transcript(path):
    """(text of the assistant's last turn, tool names used in the whole session)."""
    texts, tools = [], set()
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
                    elif c.get("type") == "tool_use":
                        tools.add(c.get("name", ""))
    return "\n".join(texts), tools


def ci_wait_running():
    if os.environ.get("SUPERVISOR_CI_WAIT") in ("0", "1"):   # tests
        return os.environ["SUPERVISOR_CI_WAIT"] == "1"
    p = subprocess.run(["pgrep", "-f", "ci-wait.sh"], capture_output=True, text=True)
    return p.returncode == 0


def verdict(cwd, text, tools, waiting):
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
    if any(t.endswith("merge_pull_request") for t in tools) and not any(t.endswith("create_session") for t in tools):
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
        text, tools = transcript(data["transcript_path"])
        reason = verdict(cwd, text, tools, ci_wait_running())
    except Exception:
        sys.exit(0)
    if reason:
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
