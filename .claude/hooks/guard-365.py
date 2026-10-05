#!/usr/bin/env python3
"""PreToolUse guard for the Microsoft 365 connector (Michael, 05/10/2026, questionnaire):
mail = drafts only, never send; delete = never, not even with approval; files =
written only inside the safety folder; Teams and calendar = read only; every
allowed write needs the word "בצע" from Michael for that exact action.

A rule in a hook runs on every call. The skill (michael-assistant, references/m365.md)
carries the same rules for chat and Cowork, where there are no hooks.

The connector's tool names change between sessions (a UUID prefix, a renamed
server), so the decision is by words in the tool name, not by an exact list:
  deny  : delete / remove / send / reply / forward / move / rename / share /
          any write to Teams, chat or calendar
  ask   : a draft, or a file written inside the safety folder (Michael's "בצע"
          is the answer to the prompt)
  deny  : a file write whose path is outside the safety folder
  pass  : read, search, list, get, find
  ask   : anything else (fail safe)

Test:  echo '{"tool_name":"mcp__Microsoft_365__outlook_send_mail","tool_input":{}}' | python3 .claude/hooks/guard-365.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

SAFETY_FOLDER = "ניהול בטיחות"  # the one OneDrive folder Claude may write in
M365 = re.compile(r"365|outlook|sharepoint|onedrive|teams|graph|mail|calendar|drive", re.I)
READ = re.compile(r"(^|_)(read|search|list|get|find|lookup|me)(_|$)", re.I)
# Whole words between underscores: "share" must not match sharepoint_folder_search.
NEVER = re.compile(r"(^|_)(delete|remove|trash|purge|destroy|send|reply|forward|move|rename|share|permission|invite|cancel)(_|$)", re.I)
PEOPLE_WRITE = re.compile(r"(teams|chat|channel|calendar|event|meeting)", re.I)
WRITE = re.compile(r"create|update|write|upload|put|patch|copy|draft|edit|set|add|append|replace", re.I)
FILEISH = re.compile(r"file|folder|drive|sharepoint|onedrive|upload|item", re.I)


def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": "guard-365: " + reason}}))


def strings(v, acc):
    if isinstance(v, dict):
        for x in v.values(): strings(x, acc)
    elif isinstance(v, list):
        for x in v: strings(x, acc)
    elif isinstance(v, str):
        acc.append(v)
    return acc


def decide(name, ti):
    short = name.split("__")[-1] if "__" in name else name
    if not M365.search(name):
        return None
    if READ.search(short) and not WRITE.search(short) and not NEVER.search(short):
        return None
    if NEVER.search(short):
        return ("deny", "'%s' deletes, sends or moves something in Microsoft 365. Michael (05/10/2026): "
                "never through Claude, not even with approval. A mail is a draft that he sends from Outlook; "
                "a file to remove goes to a 'למחיקה' folder that he empties." % short)
    if PEOPLE_WRITE.search(short) and WRITE.search(short):
        return ("deny", "'%s' writes to Teams or the calendar. Michael (05/10/2026): read only there." % short)
    if WRITE.search(short):
        if FILEISH.search(short) and "draft" not in short.lower():
            vals = strings(ti, [])
            pathy = [s for s in vals if "/" in s or "\\" in s]
            if pathy and not any(SAFETY_FOLDER in s for s in vals):
                return ("deny", "'%s' writes a file outside the safety folder ('%s'). Michael (05/10/2026): "
                        "files are written only there." % (short, SAFETY_FOLDER))
        return ("ask", "'%s' writes to Microsoft 365. Allowed only with Michael's word 'בצע' for this exact "
                "action, after it was shown to him (what, where, to whom). Then log it in the Claude Log sheet." % short)
    return ("ask", "'%s' is not a known read tool of Microsoft 365. Michael's 'בצע' is needed." % short)


if __name__ == "__main__":
    d = json.load(sys.stdin)
    r = decide(str(d.get("tool_name", "")), d.get("tool_input", {}) or {})
    if r:
        out(*r)
    else:
        print("{}")
