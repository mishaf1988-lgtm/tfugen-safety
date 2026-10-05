# Hooks - חוקים שנאכפים בקוד ולא בטקסט

חוק ב-`CLAUDE.md` הוא המלצה: המודל יכול לפספס אותו, והוא נעלם אחרי compaction.
חוק ב-hook רץ על **כל** קריאה לכלי. הקבצים פה מחליפים אזהרות
שחזרו ב-`CLAUDE.md` ובכל שיחה.

| קובץ | אירוע | מה עושה |
|---|---|---|
| `guard-sql.py` | PreToolUse על Bash + כל כלי `execute_sql` / `apply_migration` (`mcp__.*__`, כי ה-connector מגיע עם קידומת UUID; 05/10/2026) | **חוסם** `DELETE FROM` / `TRUNCATE` / `DROP TABLE` על `ncr`, `ncr_ai`, `trustee_reports`. **שואל** (01/10/2026, כי `execute_sql` מותר בלי אישור) על מחיקה, `DROP`, `ALTER ... DROP` ושינוי RLS בכל טבלה. `guard-sql-test.py` |
| `lean-harness.py` | PreToolUse על Bash | `bash tests/harness/run.sh` ירוק מחזיר שורה אחת במקום 90. אדום מחזיר את הלוג המלא. הלוג נשמר בדיסק בכל מקרה |
| `merge-gate.py` | PreToolUse על `mcp__github__merge_pull_request` | **חוסם** מיזוג עד שבדיקת `tests` של GitHub (`.github/workflows/tests.yml`) ירוקה על ה-commit האחרון של ה-PR. קורא את ה-API הציבורי של GitHub; אם אי אפשר לקרוא, חוסם (01/10/2026, המלצה 28) |
| `ci-watch.py` | PostToolUse על `Bash` (`git push`) ועל `mcp__github__create_pull_request` | **מזכיר** את הפקודה להרצה ברקע: `bash .claude/hooks/ci-wait.sh <branch>` (REST; `gh pr checks` עובר דרך GraphQL, שחסום בסשן ועדיין מחזיר 0). היא חוזרת כשהבדיקות נגמרות, ואז ממזגים או מתקנים בלי לחכות לאירוע מ-GitHub (01/10/2026, לקח 25). `ci-watch-test.py` |
| `fresh-main.py` | PreToolUse על Edit/Write | **חוסם** עריכה של קובץ שהשתנה ב-`origin/main` מאז העותק המקומי (fetch לכל היותר פעם בדקה), ואומר מה להריץ. קובץ שלא השתנה ב-main: מותר גם כש-main התקדם. בלי רשת: מותר. עריכה דרך Bash לא עוברת דרכו (01/10/2026, BACKLOG 31). בדיקה: `tests/harness/fresh-main-test.py` |
| `hebrew-reply.py` | Stop | **חוסם** סיום תור כשהתשובה למיכאל באנגלית (מעל 40 אותיות לטיניות ופחות מ-25% עברית, אחרי הסרת קוד, נתיבים וקישורים), ומבקש לכתוב אותה מחדש בעברית. לא חוסם פעמיים ברצף. לקח 13 חזר (01/10/2026). בדיקה: `tests/harness/hebrew-reply-test.py` |
| `push-gate.py` | PreToolUse (Bash) | לפני `git push`: אם קובץ הלקחים השתנה מול `origin/main`, מריץ את `lessons-format-test.py`; אדום = **חוסם** עם השורות האחרונות (לקח 41, 02/10/2026: הקובץ יצא 170 בייט מעל התקרה ו-CI היה אדום סבב). `push-gate-test.py` |
| `supervisor.py` | Stop | **המפקח** (מיכאל, 01/10/2026: "מפקח שאם אתה עוצר הוא אומר לך להמשיך ללמוד ולעבוד"). **חוסם** סיום תור כשיש שינויים בלי commit, commits שלא ב-`origin/main`, או מיזוג בלי שנפתחה שיחה הבאה (אז: לקח? הפריט הבא או handoff). מותר לעצור כשהתשובה נגמרת בשאלה למיכאל, או כש-`ci-wait.sh` רץ ברקע. לא חוסם פעמיים ברצף. מ-02/10/2026 גם: מיזוג בלי סעיף "הצעות לשדרוג" נחסם, ומ-05/10/2026 רק מיזוג **מאז התשובה האחרונה עם הסעיף** (לא כל תשובה אחרי מיזוג ישן). בדיקה: `tests/harness/supervisor-test.py` |
| `pr-gate.py` | PreToolUse על `mcp__.*__create_pull_request` | **חוסם** פתיחת PR כשבתיאור אין `רטרו:` / `skill:`, כש-skill אומר שנלמד משהו בלי קובץ skill ששונה, או Fix בלי לקח. מריץ את `check()` של `.github/scripts/lessons-gate.py` על `git diff origin/main...HEAD`, כדי לתפוס לפני ה-CI ולא אחריו (05/10/2026). `pr-gate-test.py` |
| `session-start.py` | SessionStart | **מדפיס** לשיחה חדשה: skills לטעון, ה-handoff, הפריטים הפתוחים ב-STATUS, השורה האחרונה ב-METRICS (05/10/2026). `session-start-test.py` |
| `hebrew-midturn.py` | PostToolUse על כל כלי | **מזכיר** (פעם אחת להודעה) כשהודעת הביניים האחרונה באנגלית, באותו מדד של `hebrew-reply.py`. ה-Stop hook תופס רק בסוף התור (לקח 13, 05/10/2026). `hebrew-midturn-test.py` |
| `push-recheck.py` | PostToolUse על Bash (`git push`) | **מזהיר** אם `lessons-format-test.py` אדום אחרי ה-push: `push-gate.py` רץ לפני הפקודה ולא רואה commit שנעשה באותה פקודה (05/10/2026). `push-recheck-test.py` |
| `ci-wait.sh` | (כלי, לא hook) | מחכה לבדיקת `tests` על ה-head של branch. רק הריצה האחרונה של ה-sha קובעת, ו-cancelled לא נספרת (05/10/2026). `ci-wait-test.py` (צריך `jq`) |
| `raw-hebrew.py` | PostToolUse על Edit/Write | **מזהיר** (לא חוסם) כשעריכה של `index.html` הוסיפה שורות עברית גולמית בתוך `<script>` לעומת HEAD |

**במחשב של מיכאל (05/10/2026):** `python3` הוא ה-stub של Microsoft Store (exit 49 = שגיאה לא חוסמת), ולכן ה-hooks לא רצים שם עד שיש `python3` אמיתי ב-PATH. לבדוק `python3 --version`.

## חיווט ב-`.claude/settings.json`

קטע מייצג; החיווט המלא (כולל Stop, SessionStart וה-hooks של 05/10/2026) ב-`.claude/settings.json`, ו-`settings-test.py` בודק אותו.

```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash|mcp__.*__execute_sql|mcp__.*__apply_migration",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-sql.py" } ] },
    { "matcher": "Bash",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lean-harness.py" } ] },
    { "matcher": "Edit|Write|MultiEdit",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/fresh-main.py" } ] },
    { "matcher": "mcp__github__merge_pull_request",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/merge-gate.py" } ] }
  ],
  "PostToolUse": [
    { "matcher": "Edit|Write|MultiEdit",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/raw-hebrew.py" } ] }
  ]
}
```

## בדיקה ידנית

```bash
echo '{"tool_input":{"query":"TRUNCATE ncr"}}'            | python3 .claude/hooks/guard-sql.py     # deny
echo '{"tool_input":{"query":"select count(*) from ncr"}}' | python3 .claude/hooks/guard-sql.py     # {}
echo '{"tool_input":{"command":"bash tests/harness/run.sh"}}' | python3 .claude/hooks/lean-harness.py  # rewrite
```

בדיקה של ה-hook עצמו: מוסיפים שורת `var x='שלום';` ל-`index.html`, מריצים את
`raw-hebrew.py` עם הנתיב, ומקבלים אזהרה עם `+1`. `git checkout index.html` מחזיר.
