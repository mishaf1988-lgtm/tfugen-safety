# Hooks - חוקים שנאכפים בקוד ולא בטקסט

חוק ב-`CLAUDE.md` הוא המלצה: המודל יכול לפספס אותו, והוא נעלם אחרי compaction.
חוק ב-hook רץ על **כל** קריאה לכלי. שלושת הקבצים פה מחליפים שלוש אזהרות
שחזרו ב-`CLAUDE.md` ובכל שיחה.

| קובץ | אירוע | מה עושה |
|---|---|---|
| `guard-sql.py` | PreToolUse על Bash + Supabase MCP | **חוסם** `DELETE FROM` / `TRUNCATE` / `DROP TABLE` על `ncr`, `ncr_ai`, `trustee_reports` |
| `lean-harness.py` | PreToolUse על Bash | `bash tests/harness/run.sh` ירוק מחזיר שורה אחת במקום 90. אדום מחזיר את הלוג המלא. הלוג נשמר בדיסק בכל מקרה |
| `raw-hebrew.py` | PostToolUse על Edit/Write | **מזהיר** (לא חוסם) כשעריכה של `index.html` הוסיפה שורות עברית גולמית בתוך `<script>` לעומת HEAD |

## חיווט ב-`.claude/settings.json`

```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Bash|mcp__Supabase__execute_sql|mcp__Supabase__apply_migration|mcp__supabase__execute_sql|mcp__supabase__apply_migration",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-sql.py" } ] },
    { "matcher": "Bash",
      "hooks": [ { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lean-harness.py" } ] }
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
