#!/usr/bin/env python3
"""PreToolUse on ArtifactData (18/10/2026, Michael: "מאשר" to the proposal).
A Cowork task runs only when `approved_by_michael` holds the word "בצע"
(m365-guard). On 18/10/2026 a task went out without it, Cowork stopped,
and a folder and three height certificates waited an hour. This hook denies
the write before it reaches the queue: a `set` of a cowork_tasks document,
or an `update`/batch entry that writes `approved_by_michael` or sets status
"open", must carry "בצע" in `approved_by_michael`.
Updates that only report back (filed_checked, report, status done) pass.

Test:  echo '{"tool_name":"ArtifactData","tool_input":{"action":"set","collection":"cowork_tasks","doc_id":"x","data":{"status":"open","approved_by_michael":"שאלון"}}}' | python3 .claude/hooks/cowork-gate.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

# whole word only: "לבצע", "מבצע" and "לא לבצע" are not an approval (retro 19/10/2026)
WORD = re.compile(r"(?<![\u0590-\u05ff])בצע(?![\u0590-\u05ff])")


def bad(op, coll, data):
    """Reason string if this write would queue a Cowork task without בצע, else None."""
    if coll != "cowork_tasks":
        return None
    if not isinstance(data, dict):
        # an update that takes its fields from a file (file_path) cannot be inspected: deny
        return "write from a file (file_path) to cowork_tasks cannot be checked" if data == "FILE" else None
    appr = data.get("approved_by_michael")
    opens = data.get("status") == "open"
    if op == "set" or opens or appr is not None:
        if not isinstance(appr, str) or not WORD.search(appr):
            return "approved_by_michael בלי המילה בצע"
    return None


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("tool_name") != "ArtifactData":
        return
    ti = d.get("tool_input") or {}
    act = ti.get("action")
    writes = []
    if act in ("set", "update"):
        data = ti.get("data")
        if data is None and ti.get("file_path"):
            data = "FILE"
        writes = [(act, ti.get("collection"), data)]
    elif act == "batch":
        writes = [(w.get("op"), w.get("collection"), w.get("data")) for w in ti.get("writes") or [] if isinstance(w, dict)]
    for op, coll, data in writes:
        if op not in ("set", "update"):
            continue
        why = bad(op, coll, data)
        if why:
            print(json.dumps({"hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "cowork-gate: " + why + ". Cowork עוצר על משימה כזו (18/10/2026). קודם שאלון למיכאל עם אפשרות שמתחילה ב'בצע:', או ציטוט של אישור קבוע שכתוב בו בצע (למשל routine-mail-filing.md, 'אישור קבוע לתיוק שגרתי'), ואז לכתוב אותו ב-approved_by_michael."}}, ensure_ascii=False))
            return


main()
