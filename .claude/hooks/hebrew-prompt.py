#!/usr/bin/env python3
"""UserPromptSubmit: a one-line Hebrew reminder at the start of every turn (lesson 13).

Lesson 13 recurred 45 times. hebrew-reply.py (Stop) and hebrew-midturn.py
(PostToolUse) catch an English line only after Michael saw it; no hook can stop
text before it is shown, because it is shown as it is written. What can be done
is to put Hebrew in front of the model before it writes: the English lines of
10/10/2026 came right after an English tool message. Michael: "מאשר".

Test:  python3 tests/harness/hebrew-prompt-test.py
"""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")  # Windows writes cp1255; Claude Code reads UTF-8 (05/10/2026)
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

MSG = ("תזכורת (לקח 13): כל טקסט למיכאל בעברית, גם הודעת ביניים או המתנה של שורה אחת, "
       "גם אחרי פלט כלי באנגלית. שאלה = שאלון. תאריך = DD/MM/YYYY.")

try:
    json.load(sys.stdin)
except Exception:
    pass
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": MSG}}, ensure_ascii=False))
