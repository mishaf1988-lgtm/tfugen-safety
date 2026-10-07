#!/usr/bin/env python3
"""PostToolUse / PostToolUseFailure: after a tool that failed, remind that the
next message to Michael is in Hebrew (lesson 13: 36 recurrences by 07/10/2026,
most of them a short English line written right after a failed script or test;
hebrew-midturn.py warns only after the English line is out).

A failure is: the PostToolUseFailure event, or a tool response that reads like
one (Traceback, AssertionError, "Exit code N", "N failed", a red test mark).
The exact shape of a failed tool's hook input is checked live after install
(INSTALL.md, step 4).

Test:  python3 tests/harness/hebrew-after-fail-test.py
"""
import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255 (lesson 57)
sys.stdin.reconfigure(encoding="utf-8")

FAIL = re.compile(r"Traceback \(most recent call last\)|AssertionError|\bExit code [1-9]|\b[1-9]\d* failed\b|✗|FAILURES ABOVE|InputValidationError|<tool_use_error>")


def failed(d):
    if d.get("hook_event_name") == "PostToolUseFailure":
        return True
    r = d.get("tool_response")
    if isinstance(r, dict) and (r.get("is_error") or r.get("isError")):
        return True
    try:
        s = r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)
    except Exception:
        return False
    return bool(FAIL.search(s or ""))


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    if not failed(d):
        print("{}"); return
    ev = d.get("hook_event_name") or "PostToolUse"
    print(json.dumps({"hookSpecificOutput": {"hookEventName": ev, "additionalContext":
        "hebrew-after-fail (לקח 13): הכלי נכשל. ההודעה הבאה למיכאל, גם שורה אחת של \"מתקן\", בעברית."}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
