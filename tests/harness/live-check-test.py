#!/usr/bin/env python3
"""live-check.py (lesson 61, 08/10/2026): a questionnaire that says something
"existing" or "already works" is denied once, then passes; any other passes."""
import json, tempfile
from _common import run, check, done
st = tempfile.mkdtemp()
env = {"LIVE_CHECK_STATE": st}
def ask(q, opts=(), sid="s"):
    return run("live-check.py", {"tool_name": "AskUserQuestion", "session_id": sid, "tool_input": {"questions": [{"question": q, "options": [{"label": l, "description": dsc} for l, dsc in opts]}]}}, env)
o = ask("הסריקה הקיימת של המייל תזהה תשובות. מאשר?")
check("'הקיימת' in the question: denied, with the lesson and the word", '"deny"' in o and "61" in o and "הקיימת" in o, o)
check("the same question again: passes (one pause, no loop)", ask("הסריקה הקיימת של המייל תזהה תשובות. מאשר?") == "")
check("'הקיים' (final mem) in an option description: denied", '"deny"' in ask("מה לעשות?", [("בצע: לחבר", "דרך החיבור הקיים ל-OneDrive")]))
check("'כבר עובד' in a label: denied", '"deny"' in ask("איך?", [("השרת כבר עובד עם זה", "x")]))
check("'כבר קיים': denied", '"deny"' in ask("השדה כבר קיים במסך?"))
check("no claim: passes", ask("לאילו פריטים להוסיף קישור?", [("פג וגם עד 30 יום", "כמו הטבלה")]) == "")
check("'קיימת' without ה (a new thing that will exist) passes", ask("תהיה טבלה קיימת אחרי זה?") == "")
check("another tool: nothing", run("live-check.py", {"tool_name": "Bash", "tool_input": {"command": "echo הקיים"}}, env) == "")
check("bad input: nothing, no crash", run("live-check.py", {}, env) == "")
done()
