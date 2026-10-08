#!/usr/bin/env python3
"""PreToolUse on AskUserQuestion (lesson 61, recurred 4 times by 08/10/2026):
a plan put to Michael leaned on something "existing" that was not live (the
mail scan off since 27/09, a public bucket that was private, a Routine bound to
another session). The rule in text did not stop it, so the first questionnaire
whose text says a thing already exists or already works is denied once, with
the instruction to check it against the live system (DB, token scopes, Graph,
get_trigger) and then ask again. The same question asked again passes: one
pause per question, never a loop.

Test:  echo '{"tool_name":"AskUserQuestion","session_id":"t","tool_input":{"questions":[{"question":"סריקת המייל הקיימת?","options":[]}]}}' | python3 .claude/hooks/live-check.py
"""
import hashlib, json, os, re, sys, tempfile
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)
sys.stdout.reconfigure(encoding="utf-8")  # the reason is Hebrew; Windows prints cp1255

# "existing", "already exists", "already works/runs/connected" (Hebrew forms).
CLAIM = re.compile(r"(הקיי(ם|מת|מים|מות)\b|כבר (קיי[םמ]|עובד|רץ|רצה|מחובר))")


def text_of(inp):
    parts = []
    for q in (inp or {}).get("questions") or []:
        parts.append(str(q.get("question") or ""))
        for o in q.get("options") or []:
            parts.append(str(o.get("label") or ""))
            parts.append(str(o.get("description") or ""))
    return "\n".join(parts)


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        return
    if d.get("tool_name") != "AskUserQuestion":
        return
    t = text_of(d.get("tool_input"))
    m = CLAIM.search(t)
    if not m:
        return
    key = hashlib.sha1((str(d.get("session_id") or "") + "\n" + t).encode("utf-8")).hexdigest()[:16]
    mark = os.path.join(os.environ.get("LIVE_CHECK_STATE") or tempfile.gettempdir(), "live-check-" + key)
    if os.path.exists(mark):
        return  # asked again after the pause: let it through
    try:
        open(mark, "w").close()
    except OSError:
        return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "live-check (לקח 61): השאלון אומר שמשהו קיים או עובד ('" + m.group(0) + "'). לבדוק מול המערכת החיה (מסד, הרשאות הטוקן, Graph, get_trigger) שזה באמת פעיל, ורק אז לשאול שוב. אותה שאלה בפעם השנייה עוברת."}}, ensure_ascii=False))


main()
