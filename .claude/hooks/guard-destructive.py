#!/usr/bin/env python3
"""PreToolUse guard for tools that delete, pause or rebuild infrastructure (Michael, 29/10/2026,
questionnaire after the check of the agent's permissions: "בצע: הוק שחוסם מחיקה והפסקה").

Before this hook only SQL (guard-sql.py) and Microsoft 365 (guard-365.py) were guarded. The agent
also holds the Cloudflare developer connector (D1, KV, R2, Hyperdrive: the site uses none of them),
Supabase management tools (delete a branch, pause or restore the project, deploy an edge function,
write an edge function secret) and GitHub file deletion. Each of these can take the site, the
database or the repository down in one call.

Decision by words in the tool name, not an exact list: the connector's names change between sessions
(a UUID prefix, a renamed server), like in guard-365.py.
  deny: every write in the Cloudflare developer connector (create, delete, update, edit, and query: D1 takes any SQL)
  deny: Supabase delete_branch, pause_project, restore_project, reset_branch, rebase_branch, merge_branch,
        create_project, deploy_edge_function, create_edge_function_secret
  deny: delete_file (any server name)
  pass: everything else (reads, listing, search, the SQL tools which guard-sql.py judges)
Not blocked on purpose: the scheduled-task tools (delete_trigger is part of moving a check between
sessions, tfugen-sessions) and archive_session (the end of a chained session).

Test:  echo '{"tool_name":"mcp__x__d1_database_delete","tool_input":{}}' | python3 .claude/hooks/guard-destructive.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")  # Hebrew in the reason; Windows would write cp1255

CLOUDFLARE_WRITE = re.compile(r"(^|_)(d1_database|kv_namespace|r2_bucket|hyperdrive_config)_(create|delete|update|edit|query)$", re.I)
SUPABASE_INFRA = re.compile(r"(^|_)(delete_branch|pause_project|restore_project|reset_branch|rebase_branch|merge_branch|create_project|deploy_edge_function|create_edge_function_secret)$", re.I)
GITHUB_DELETE = re.compile(r"^mcp__.*(^|__)delete_file$", re.I)


def out(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "guard-destructive: " + reason}}, ensure_ascii=False))


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    name = str(data.get("tool_name") or "")
    if not name.startswith("mcp__"):
        return
    if CLOUDFLARE_WRITE.search(name):
        out("הכלי משנה או מוחק משאב ב-Cloudflare (מסד D1, אחסון R2, מפתחות KV). האתר לא משתמש בהם, ולכן הוא חסום. לשינוי כזה צריך מיכאל, בהוק שהוא מאשר (29/10/2026).")
    elif SUPABASE_INFRA.search(name):
        out("הכלי מוחק, משהה, משחזר או פורס תשתית ב-Supabase (ענף, פרויקט, פונקציה, סוד). חסום. לשינוי כזה צריך מיכאל (29/10/2026). שינוי סכמה עובר דרך apply_migration אחרי גיבוי, ולא דרך כלי הפרויקט.")
    elif GITHUB_DELETE.search(name):
        out("מחיקת קובץ ב-GitHub חסומה. מוחקים קובץ ב-commit רגיל בענף, בתוך PR (29/10/2026).")


main()
