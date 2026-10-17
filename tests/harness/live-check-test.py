#!/usr/bin/env python3
"""live-check.py (lesson 61, 08/10/2026): a questionnaire that says something
"existing" or "already works" is denied once, then passes; any other passes."""
import json, tempfile
from _common import run, check, done
st = tempfile.mkdtemp()
root = tempfile.mkdtemp()
import os
os.makedirs(os.path.join(root, "project-files"))
open(os.path.join(root, "DECISIONS.md"), "w", encoding="utf-8").write("## x\n**מה:** `received_at` ב-`trustee_reports`.\n" + "trustee_reports\n" * 10
    + "## 17/10/2026 - הקוד והסוכנים של מיכאל; ה-repo נשאר ציבורי, הסוכנים עוברים לפרטי\n"
    + "## 2026-09-25 - פיילוט כניסה ב-Face ID / טביעת אצבע (passkeys של Supabase), קודם על הטלפון של מיכאל\n")
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
# lesson 10 (17/10/2026): the same subject asked again in plain Hebrew, no identifier.
REPO = "ה-repo של תפוגן (tfugen-safety) ציבורי, כלומר כל אחד יכול לראות ולהעתיק את הקוד של המוצר. לבדוק את המעבר לפרטי?"
o = ask(REPO, [("בצע: לבדוק מה נשבר (מומלץ)", "x"), ("להשאיר ציבורי", "y")])
check("a decision heading sharing 3+ words: denied, naming the line", '"deny"' in o and "DECISIONS.md:13" in o and "10" in o, o)
check("...and asked again it passes", ask(REPO, [("בצע: לבדוק מה נשבר (מומלץ)", "x"), ("להשאיר ציבורי", "y")]) == "")
check("two shared words are not enough", ask("לפרסם את הקוד?", [("ציבורי", "")]) == "")
check("an unrelated question of the same day passes", ask("בערך כמה כסף אתה חושב להשקיע בשיווק בהתחלה?", [("עד 2,000", "")]) == "")
# 17/10/2026: a questionnaire about test runs matched the passkeys heading on Supabase, phone, sign-in.
TESTS = "מה כבר בדקת או ביצעת?"
TOPTS = [("C17: כניסה אנונימית בניסוי", "מתג אחד ב-Supabase של פרויקט הניסוי"), ("#1595/#1596 בטלפון", "בדיקות בטלפון אמיתי"), ("לעצור כאן (מומלץ)", "ה-handoff מעודכן")]
check("tools and everyday words do not match a decision (passkeys heading)", ask(TESTS, TOPTS, sid="t2") == "")
import sys, importlib
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".claude", "hooks"))
LC = importlib.import_module("live-check")
check("a stop word with a prefix letter stays a stop word ('מומלץ' is not 'ומלץ')", LC.words("מומלץ בדיקות") == set(), LC.words("מומלץ בדיקות"))
done()
