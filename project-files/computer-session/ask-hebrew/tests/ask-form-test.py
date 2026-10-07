#!/usr/bin/env python3
"""ask-form.py: a question in the final text with no questionnaire blocks once;
a questionnaire, a question inside code or a table, or a second stop pass."""
import json, os, tempfile
from _common import run, check, done
d = tempfile.mkdtemp()
def tr(final, tools=("Bash",), before="עובד על זה."):
    p = os.path.join(d, "t%d.jsonl" % len(os.listdir(d)))
    with open(p, "w", encoding="utf-8") as f:
        f.write(json.dumps({"message": {"role": "user", "content": "במה נמשיך"}}, ensure_ascii=False) + "\n")
        f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "text", "text": before}] + [{"type": "tool_use", "name": t} for t in tools]}}, ensure_ascii=False) + "\n")
        f.write(json.dumps({"message": {"role": "user", "content": [{"type": "tool_result", "content": "ok"}]}}) + "\n")
        f.write(json.dumps({"message": {"role": "assistant", "content": [{"type": "text", "text": final}]}}, ensure_ascii=False) + "\n")
    return p
Q = "סיימתי.\n\n1. לסגור את בדיקות הנאמנים?\n2. מה הלאה?"
out = run("ask-form.py", {"transcript_path": tr(Q)})
check("a question in text, no questionnaire: blocked, with lesson 64", '"block"' in out and "לקח 64" in out and "AskUserQuestion" in out, out)
check("...a question with a closing quote or bold counts", '"block"' in run("ask-form.py", {"transcript_path": tr('לסגור את "בדיקה 2"?"')}) and '"block"' in run("ask-form.py", {"transcript_path": tr("**לסגור?**")}))
check("a questionnaire in the turn: passes", run("ask-form.py", {"transcript_path": tr(Q, tools=("Bash", "AskUserQuestion"))}) == "")
check("second stop in a row (stop_hook_active): passes", run("ask-form.py", {"transcript_path": tr(Q), "stop_hook_active": True}) == "")
check("no question: passes", run("ask-form.py", {"transcript_path": tr("מוזג (#1238). הכל ירוק.")}) == "")
check("a ? in code, a table cell or a quote line: passes", run("ask-form.py", {"transcript_path": tr("```\nif x?\n```\n| עובד? | כן |\n> מה זה?\n`a?`")}) == "")
check("a question only in an earlier block, final block plain: passes", run("ask-form.py", {"transcript_path": tr("סיימתי.", before="לבדוק את זה?")}) == "")
check("no transcript: passes, no crash", run("ask-form.py", {"transcript_path": "/nonexistent"}) == "")
done()
