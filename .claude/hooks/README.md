# Hooks - חוקים שנאכפים בקוד ולא בטקסט

חוק ב-`CLAUDE.md` הוא המלצה: המודל יכול לפספס אותו, והוא נעלם אחרי compaction.
חוק ב-hook רץ על **כל** קריאה לכלי. הקבצים פה מחליפים אזהרות
שחזרו ב-`CLAUDE.md` ובכל שיחה.

| קובץ | אירוע | מה עושה |
|---|---|---|
| `guard-sql.py` | PreToolUse על Bash + Supabase MCP | **חוסם** `DELETE FROM` / `TRUNCATE` / `DROP TABLE` על `ncr`, `ncr_ai`, `trustee_reports`. **שואל** (01/10/2026, כי `execute_sql` מותר בלי אישור) על מחיקה, `DROP`, `ALTER ... DROP` ושינוי RLS בכל טבלה. `guard-sql-test.py` |
| `lean-harness.py` | PreToolUse על Bash | `bash tests/harness/run.sh` ירוק מחזיר שורה אחת במקום 90. אדום מחזיר את הלוג המלא. הלוג נשמר בדיסק בכל מקרה |
| `merge-gate.py` | PreToolUse על `mcp__github__merge_pull_request` | **חוסם** מיזוג עד שבדיקת `tests` של GitHub (`.github/workflows/tests.yml`) ירוקה על ה-commit האחרון של ה-PR. קורא את ה-API הציבורי של GitHub; אם אי אפשר לקרוא, חוסם (01/10/2026, המלצה 28) |
| `ci-watch.py` | PostToolUse על `Bash` (`git push`) ועל `mcp__github__create_pull_request` | **מזכיר** את הפקודה להרצה ברקע: `bash .claude/hooks/ci-wait.sh <branch>` (REST; `gh pr checks` עובר דרך GraphQL, שחסום בסשן ועדיין מחזיר 0). היא חוזרת כשהבדיקות נגמרות, ואז ממזגים או מתקנים בלי לחכות לאירוע מ-GitHub (01/10/2026, לקח 25). `ci-watch-test.py` |
| `fresh-main.py` | PreToolUse על Edit/Write | **חוסם** עריכה של קובץ שהשתנה ב-`origin/main` מאז העותק המקומי (fetch לכל היותר פעם בדקה), ואומר מה להריץ. קובץ שלא השתנה ב-main: מותר גם כש-main התקדם. בלי רשת: מותר. עריכה דרך Bash לא עוברת דרכו (01/10/2026, BACKLOG 31). בדיקה: `tests/harness/fresh-main-test.py` |
| `hebrew-reply.py` | Stop | **חוסם** סיום תור כשהתשובה למיכאל באנגלית (מעל 40 אותיות לטיניות ופחות מ-25% עברית, אחרי הסרת קוד, נתיבים וקישורים), ומבקש לכתוב אותה מחדש בעברית. לא חוסם פעמיים ברצף. לקח 13 חזר (01/10/2026). בדיקה: `tests/harness/hebrew-reply-test.py` |
| `raw-hebrew.py` | PostToolUse על Edit/Write | **מזהיר** (לא חוסם) כשעריכה של `index.html` הוסיפה שורות עברית גולמית בתוך `<script>` לעומת HEAD |

## חיווט ב-`.claude/settings.json`

```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash|mcp__Supabase__execute_sql|mcp__Supabase__apply_migration|mcp__supabase__execute_sql|mcp__supabase__apply_migration",
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
