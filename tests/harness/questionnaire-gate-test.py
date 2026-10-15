#!/usr/bin/env python3
"""The Stop hook .claude/hooks/questionnaire-gate.py (lesson 101, Michael 15/10/2026: "זה חוק לא?").

A merge with no questionnaire after it is blocked; a questionnaire after the merge passes;
a question in text is blocked; the escape line passes; tool results do not reset the turn;
stop_hook_active never blocks twice.
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HOOK = os.path.join(HERE, "..", "..", ".claude", "hooks", "questionnaire-gate.py")
passed = failed = 0


def check(label, cond, detail=None):
    global passed, failed
    if cond:
        passed += 1; print("  ✓ " + label)
    else:
        failed += 1; print("  ✗ " + label + ("  -> " + repr(detail) if detail is not None else ""))


def run(entries, active=False):
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    p = subprocess.run([sys.executable, HOOK], input=json.dumps({"transcript_path": path, "stop_hook_active": active}),
                       capture_output=True, text=True, timeout=20)
    os.unlink(path)
    return p.stdout.strip()


user = lambda t: {"type": "user", "message": {"role": "user", "content": t}}
result = {"type": "user", "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "x", "content": "ok"}]}}
text = lambda t: {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": t}]}}
tool = lambda n: {"type": "assistant", "message": {"role": "assistant", "content": [{"type": "tool_use", "id": "x", "name": n, "input": {}}]}}
MERGE = "mcp__github__merge_pull_request"

o = run([user("עשה"), tool(MERGE), result, text("מוזג. הכל ירוק.")])
check("a merge with no questionnaire after it is blocked", '"block"' in o and "שאלון" in o, o)
o = run([user("עשה"), tool(MERGE), result, tool("AskUserQuestion"), result, text("ממשיך לפי התשובות.")])
check("a questionnaire after the merge passes", o == "", o)
o = run([user("עשה"), tool("AskUserQuestion"), result, tool(MERGE), result, text("מוזג.")])
check("a questionnaire before the last merge does not count", '"block"' in o, o)
o = run([user("מה נשאר?"), text("נשארו שלוש בדיקות.\nלבדוק אותן עכשיו?")])
check("a question in text is blocked", '"block"' in o and "AskUserQuestion" in o, o)
o = run([user("מה נשאר?"), text("לבדוק?"), tool("AskUserQuestion"), result, text("בסדר, ממשיך.")])
check("a question answered by a questionnaire passes", o == "", o)
o = run([user("עשה"), tool(MERGE), result, text("מוזג.\nבלי שאלון: אין שום דבר שמחכה למיכאל.")])
check("the escape line lets the turn end", o == "", o)
o = run([user("תריץ"), tool("Bash"), result, text("הבדיקות רצות ברקע.")])
check("a plain turn with no merge and no question passes", o == "", o)
o = run([user("עשה"), tool(MERGE), result, text("מוזג.")], active=True)
check("stop_hook_active never blocks twice", o == "", o)
o = run([user("עשה"), tool(MERGE), result, tool("AskUserQuestion"), result, user("<task-notification>done</task-notification>"), text("עוד ירוק.")])
check("a new user event starts a new turn (a merge in the previous turn does not count)", o == "", o)
o = run([user("שאלה"), text("```\nwhat?\n```\nזה הקוד.")])
check("a question mark inside a code block is not a question", o == "", o)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
