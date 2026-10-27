#!/usr/bin/env python3
"""PreToolUse on Bash and Agent (lesson 13, 27/10/2026): the one-line description of every
command is shown to Michael, and it was written in English all day ("Check CI waits for PR
2115"). hebrew-reply.py reads only the chat text and lets a short line pass, so nothing
caught it. Michael: "מה עם כל האנגלית?", and in the questionnaire "בצע: לחסום תיאור באנגלית".

The rule: at least 3 Hebrew letters, and Hebrew at least a third of the Latin letters.
Names (a path, a branch, a file, anything in backticks) are not counted, so
"מחכה לבדיקות של routine/x-2026-10-27" and "מריץ git fetch ו-reset" pass.
A missing description is left alone: the tool itself asks for one.

Test:  python3 tests/harness/desc-hebrew-test.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew; Windows prints cp1255

NAME = re.compile(r"`[^`]*`|\S*[/._]\S*")


def counts(text):
    t = NAME.sub(" ", text or "")
    heb = sum(1 for c in t if "א" <= c <= "ת")
    lat = sum(1 for c in t if c.isascii() and c.isalpha())
    return heb, lat


def ok(text):
    heb, lat = counts(text)
    return heb >= 3 and heb * 3 >= lat


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        print("{}"); return
    desc = (data.get("tool_input") or {}).get("description")
    if not desc or ok(desc):
        print("{}"); return
    heb, lat = counts(desc)
    why = ("desc-hebrew (לקח 13): התיאור של הפעולה מוצג למיכאל, והוא באנגלית (" + str(lat) +
           " אותיות לטיניות, " + str(heb) + " עבריות). לכתוב אותו בעברית, ולהריץ שוב.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                             "permissionDecisionReason": why}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
