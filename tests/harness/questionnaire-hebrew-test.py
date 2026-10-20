#!/usr/bin/env python3
"""questionnaire-hebrew.py: an English questionnaire is denied, every time;
a Hebrew one with English names in it (Opus, Cloudflare, `code`) passes."""
from _common import run, check, done


def ask(q, opts):
    return {"tool_name": "AskUserQuestion", "tool_input": {"questions": [
        {"question": q, "header": "x", "multiSelect": False,
         "options": [{"label": l, "description": d} for l, d in opts]}]}}


ENG = ask("Every WhatsApp message you send already runs in a new, clean session. Should they run on Opus?",
          [("Do it: Opus for messages (recommended)", "Change the model only on the trigger for messages."),
           ("Stay on Sonnet", "No change.")])
HEB = ask("כל הודעת וואטסאפ רצה בשיחה חדשה. היום על Sonnet. להעביר ל-Opus?",
          [("בצע: Opus להודעות (מומלץ)", "שינוי המודל רק בטריגר של ההודעות, `trig_01Tofq`."),
           ("להישאר על Sonnet", "בלי שינוי. ASSISTANT2_FIRE_TOKEN נשאר ב-Cloudflare.")])

out = run("questionnaire-hebrew.py", ENG)
check("English questionnaire: denied with lesson 13", '"deny"' in out and "לקח 13" in out, out)
check("the same English questionnaire again: denied again (no one-time pass)", '"deny"' in run("questionnaire-hebrew.py", ENG))
check("Hebrew with English names: passes", run("questionnaire-hebrew.py", HEB) == "{}", run("questionnaire-hebrew.py", HEB))
check("short English (a few names): passes", run("questionnaire-hebrew.py", ask("Opus?", [("Yes", ""), ("No", "")])) == "{}")
check("bad input: nothing, no crash", run("questionnaire-hebrew.py", {}) == "{}")
done()
