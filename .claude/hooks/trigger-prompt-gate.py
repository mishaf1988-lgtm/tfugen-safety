#!/usr/bin/env python3
"""PreToolUse on send_message (21/10/2026, lesson 140 recurred; Michael: "בצע").
A Routine's prompt is changed on its page by Michael, not by asking an agent's own
session to run update_trigger: on 20/10 and again on 21/10/2026 that session refused or
its permission classifier denied it, even with Michael's approval pasted there. This
hook denies a send_message that asks another session for update_trigger, and says what
works: a link to the Routine page, the whole new prompt in one code block, then get_trigger.

Test:  python3 tests/harness/trigger-prompt-gate-test.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

ASK = re.compile(r"update_trigger", re.I)


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    if not str(d.get("tool_name", "")).endswith("send_message"):
        print("{}"); return
    msg = str((d.get("tool_input") or {}).get("message", "") or "")
    if not ASK.search(msg):
        print("{}"); return
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
        "permissionDecisionReason": "trigger-prompt-gate (לקח 140): את ה-prompt של Routine מיכאל משנה בדף ה-Routine (https://claude.ai/code/routines/<trig>), לא שיחה אחרת שמריצה update_trigger (נחסם ב-20/10 וב-21/10/2026, גם עם אישור שלו). לתת לו קישור ואת כל ה-prompt החדש בתיבת קוד אחת, ואז get_trigger."}}, ensure_ascii=False))


main()
