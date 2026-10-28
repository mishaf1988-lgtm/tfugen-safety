#!/usr/bin/env python3
"""UserPromptSubmit: a one-line Hebrew reminder at the start of every turn (lesson 13).

Lesson 13 recurred 45 times. hebrew-reply.py (Stop) and hebrew-midturn.py
(PostToolUse) catch an English line only after Michael saw it; no hook can stop
text before it is shown, because it is shown as it is written. What can be done
is to put Hebrew in front of the model before it writes: the English lines of
10/10/2026 came right after an English tool message. Michael: "מאשר".

27/10/2026 (Michael in the questionnaire: "בצע: כרטיס חוקים בכל הודעה", "בצע: מעבר צ'אט
אוטומטי לפי אורך"): the reminder carries the five rules broken most, and when the
transcript passes LONG_BYTES it tells Claude to close the task and open the next main chat
itself, so Michael never has to notice the chat got long.

28/10/2026 (Michael: "כשאתה עובר חשבון, כתוב בשיחה "עובר חשבון""): those words in the
prompt add the account-move procedure (project-files/ACCOUNT-MOVE.md).

Test:  python3 tests/harness/hebrew-prompt-test.py
"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

MSG = ("כרטיס חוקים: (1) כל טקסט למיכאל בעברית, גם הודעת ביניים או המתנה של שורה אחת, "
       "גם אחרי פלט כלי באנגלית (לקח 13). (2) שאלה = שאלון, עכשיו ולא \"אשאל בסוף\". "
       "(3) תאריך = DD/MM/YYYY. (4) לבדוק במסד או בקוד לפני שטוענים \"בוצע\" או \"אין\". "
       "(5) בלי מקף ארוך.")
# A main chat this long costs more each message (the whole history is resent). 27/10/2026:
# this one was 2.3MB after a full task; the previous main chat ran until Michael asked.
LONG_BYTES = 6_000_000
LONG = ("השיחה ארוכה ({mb} MB). לסיים את המשימה הנוכחית (מיזוג), ואז בלי לשאול: handoff "
        "ושיחה ראשית חדשה לפי tfugen-sessions, ולכתוב למיכאל שעברנו ולאן.")
MOVE = ("מיכאל כתב \"עובר חשבון\": לפי project-files/ACCOUNT-MOVE.md, בלי לשאול: לסיים או לרשום "
        "מה באמצע, handoff עם \"מעבר חשבון\" ו\"לחשבון הסוכנים\", למזג, ולכתוב לו מה להדביק בחשבון השני.")

msg = MSG
try:
    data = json.load(sys.stdin)
    if "עובר חשבון" in (data.get("prompt") or ""):
        msg += " " + MOVE
    size = os.path.getsize(data.get("transcript_path") or "")
    if size > LONG_BYTES:
        msg += " " + LONG.format(mb=round(size / 1e6, 1))
except Exception:
    pass
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": msg}}, ensure_ascii=False))
