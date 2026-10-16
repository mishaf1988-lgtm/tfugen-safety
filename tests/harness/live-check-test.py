#!/usr/bin/env python3
"""live-check.py (lesson 61, 08/10/2026): a questionnaire that says something
"existing" or "already works" is denied once, then passes; any other passes."""
import json, tempfile
from _common import run, check, done
st = tempfile.mkdtemp()
root = tempfile.mkdtemp()
import os
os.makedirs(os.path.join(root, "project-files"))
open(os.path.join(root, "DECISIONS.md"), "w", encoding="utf-8").write("## x\n**מה:** `received_at` ב-`trustee_reports`.\n" + "trustee_reports\n" * 10)
env = {"LIVE_CHECK_STATE": st, "LIVE_CHECK_ROOT": root}
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
# lesson 15 (16/10/2026): asked to approve received_at, built the day before.
o = ask("להוסיף שעת קבלה בשרת (received_at)?", [("בצע", "עמודה חדשה")])
check("a rare identifier already in DECISIONS: denied, naming where", '"deny"' in o and "received_at: DECISIONS.md:2" in o and "15" in o, o)
check("...and asked again it passes", ask("להוסיף שעת קבלה בשרת (received_at)?", [("בצע", "עמודה חדשה")]) == "")
check("a common identifier (11 hits) does not stop the question", ask("לשנות את trustee_reports?") == "")
check("an identifier not in any decision passes", ask("להוסיף new_column?") == "")
done()
