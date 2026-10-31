#!/usr/bin/env python3
"""Stop hook (31/10/2026, Michael: "transfer between accounts as if I talked to it a minute ago").
A conversation in one account cannot see the other account's conversations, and a model remembers
nothing that was not written. So at the end of every reply this writes a short note to the database
(routine-db state_set, key live_note): the last thing Michael asked, the last reply, the branch, the
session and the account. session-start.py reads it at the start of every conversation, in both accounts.

Never blocks (no output, exit 0), never fails the reply: no key, offline, a bad answer = nothing.
Secrets are scrubbed before anything leaves the machine, and the note is cut to a fixed size (the
server also refuses over 4000 characters).
LIVE_NOTE_DRY=<file> writes the request body there instead of calling the server (tests).

Test:  python3 tests/harness/live-note-test.py
"""
import json, os, re, subprocess, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

MAX_USER = 500
MAX_REPLY = 1200
SECRETS = [
    (re.compile(r"sk-[A-Za-z0-9_\-]{10,}"), "[מפתח הוסר]"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]*"), "[טוקן הוסר]"),
    (re.compile(r"(?i)(bearer|token|key|password|secret)[\"'=: ]+[A-Za-z0-9_\-\.]{16,}"), "[סוד הוסר]"),
    (re.compile(r"\b(?:ghp|gho|ghs|github_pat|sb_secret|sb_publishable|xox[abp])_[A-Za-z0-9_\-]{10,}"), "[מפתח הוסר]"),
    (re.compile(r"(?:סיסמה|סיסמא|קוד גישה|מפתח|טוקן)[\"'=: ]+[^\s,.;]{6,}"), "[סוד הוסר]"),
    (re.compile(r"\b[0-9a-fA-F]{32,}\b"), "[מזהה ארוך הוסר]"),
]


def scrub(text):
    for rx, rep in SECRETS:
        text = rx.sub(rep, text)
    return re.sub(r"\s+", " ", text).strip()


def cut(text, n):
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def last_turn(path):
    """(last real user text, last assistant text block) from the transcript."""
    user, reply = "", ""
    try:
        f = open(path, encoding="utf-8")
    except Exception:
        return user, reply
    with f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            msg = e.get("message") or {}
            role = msg.get("role") or e.get("type")
            content = msg.get("content")
            if role == "user":
                if isinstance(content, str):
                    txt = content
                elif isinstance(content, list):
                    if all(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
                        continue
                    txt = " ".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")
                else:
                    continue
                if txt.strip() and not txt.lstrip().startswith("<system-reminder>"):
                    user = txt
            elif role == "assistant":
                blocks = [content] if isinstance(content, str) else [c.get("text", "") for c in (content or []) if isinstance(c, dict) and c.get("type") == "text"]
                blocks = [b for b in blocks if b and b.strip()]
                if blocks:
                    reply = blocks[-1]
    return user, reply


def account():
    """'main' for the company account, 'gmail' for the other; the address itself is never stored."""
    return "main" if os.environ.get("CLAUDE_CODE_USER_EMAIL", "").lower().endswith("@tapugan.co.il") else "gmail"


def branch(cwd):
    try:
        return subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd, capture_output=True, text=True,
                              encoding="utf-8", timeout=5).stdout.strip()[:80]
    except Exception:
        return ""


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    dry = os.environ.get("LIVE_NOTE_DRY")
    # Only a conversation with a person in it writes the note (security review 31/10/2026: a Routine run has the key and the
    # hooks too, and its last message is the trigger's prompt or text from a mail, not what Michael asked).
    if not dry and os.environ.get("CLAUDE_CODE_SESSION_ATTENDED") != "1":
        return
    if not dry and not os.environ.get("ROUTINE_KEY"):
        return
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or "."
    user, reply = last_turn(data.get("transcript_path") or "")
    if not user and not reply:
        return
    note = {
        "session": str(data.get("session_id") or os.environ.get("CLAUDE_CODE_SESSION_ID") or "")[:60],
        "account": account(),
        "branch": branch(cwd),
        "last_user": cut(scrub(user), MAX_USER),
        "last_reply": cut(scrub(reply), MAX_REPLY),
    }
    body = json.dumps({"op": "state_set", "key": "live_note", "value": note}, ensure_ascii=False)
    if dry:
        open(dry, "w", encoding="utf-8").write(body)
        return
    sh = os.path.join(cwd, "project-files", "routine-db.sh")
    if not os.path.exists(sh):
        return
    try:
        subprocess.run(["bash", sh, body], capture_output=True, text=True, encoding="utf-8", timeout=8, cwd=cwd)
    except Exception:
        pass


try:
    main()
except Exception:
    pass
sys.exit(0)
