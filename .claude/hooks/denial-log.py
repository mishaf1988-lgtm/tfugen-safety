#!/usr/bin/env python3
"""PermissionDenied hook: one row in agent_log for every auto-mode denial (ideas-lab 18; Michael 03/11/2026 in a
questionnaire: "בצע: יומן חסימות (מומלץ)").

03/11/2026: the filing run of 10:52 had 2 of 8 identical od_move calls denied ([External System Writes]); it was found
only by reading the whole transcript. Before this, every denial was found by hand in one run's story.

What is logged: the tool name, the reason (the rule in square brackets), the first word of a Bash command, and the
first 8 characters of the session id. Never the full command or tool input: it can hold an employee's name.
Sent with routine-db agent_report as agent "permission-denials", ok true (a denial is data, not a failed run).
Never blocks, never asks for a retry, always exits 0 (the denial already happened; the docs: exit code is ignored).
Needs ROUTINE_KEY; without it the row goes to stderr only. A scheduled Routine that clones the repo itself does not
load this file: those runs are counted by the daily quality checker from list_events (routine-quality.md)."""
import json, os, re, subprocess, sys

AGENT = "permission-denials"


def first_word(cmd):
    for w in re.split(r"\s+", str(cmd or "").strip()):
        if not w or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", w) or w in ("sudo", "env", "time", "cd"):
            continue
        return os.path.basename(w)[:40]
    return ""


def row(ev):
    tool = str(ev.get("tool_name") or "?")[:60]
    reason = re.sub(r"\s+", " ", str(ev.get("reason") or "")).strip()[:90]
    # the classifier's free text can quote the command (a token, a name): only its leading [rule tag] is kept (retro 04/11/2026)
    mt = re.match(r"\[[^\]]{1,60}\]", reason)
    reason = mt.group(0) if mt else ""
    ti = ev.get("tool_input") if isinstance(ev.get("tool_input"), dict) else {}
    fw = first_word(ti.get("command")) if tool in ("Bash", "PowerShell") else ""
    if fw == "bash" or fw == "sh" or fw == "python3":
        # 'bash project-files/routine-db.sh ...': the script name says what was tried, the op says which write
        parts = [p for p in re.split(r"\s+", str(ti.get("command") or "").strip()) if p]
        idx = next((i for i, p in enumerate(parts) if os.path.basename(p) == fw), -1)
        if 0 <= idx < len(parts) - 1:
            fw = fw + " " + os.path.basename(parts[idx + 1])[:40]
        m = re.search(r'"op"\s*:\s*"([a-z_]{2,30})"', str(ti.get("command") or ""))
        if m:
            fw = fw + " " + m.group(1)
    sid = str(ev.get("session_id") or "")[-8:]
    # "חסימה" = denial
    line = "חסימה: " + tool + " " + reason + ((" (" + fw + ")") if fw else "") + ((" s:" + sid) if sid else "")
    return line[:300]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdin.reconfigure(encoding="utf-8")
    try:
        ev = json.loads(sys.stdin.read() or "{}")
    except Exception:
        return 0
    if not isinstance(ev, dict):
        return 0
    if ev.get("hook_event_name") not in (None, "PermissionDenied"):
        return 0
    line = row(ev)
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    script = os.path.join(root, "project-files", "routine-db.sh")
    if not os.environ.get("ROUTINE_KEY") or not os.path.exists(script):
        sys.stderr.buffer.write(("denial-log (no ROUTINE_KEY): " + line + "\n").encode("utf-8"))
        return 0
    body = json.dumps({"op": "agent_report", "agent": AGENT, "ok": True, "line": line}, ensure_ascii=False)
    try:
        subprocess.run(["bash", script, body], timeout=20, capture_output=True)
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
