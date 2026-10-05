#!/usr/bin/env python3
"""PreToolUse guard: blocks destructive SQL against the tables CLAUDE.md marks
as never-delete (ncr, ncr_ai, trustee_reports), whether it arrives through
Bash or through the Supabase MCP (execute_sql / apply_migration).

A rule in a hook is enforced on every call; a rule in CLAUDE.md is advice
that can be dropped after context compaction.

Test:  echo '{"tool_input":{"query":"TRUNCATE ncr"}}' | python3 .claude/hooks/guard-sql.py
"""
import json, re, sys
sys.stdin.reconfigure(encoding="utf-8")  # Claude Code sends UTF-8; Windows reads cp1255 (05/10/2026)

d = json.load(sys.stdin)
ti = d.get("tool_input", {}) or {}
text = " ".join(str(ti.get(k, "")) for k in ("command", "query", "sql"))
pat = re.compile(
    r"\b(DELETE\s+FROM|TRUNCATE(\s+TABLE)?|DROP\s+TABLE(\s+IF\s+EXISTS)?)\s+"
    r"(public\.)?(ncr|ncr_ai|trustee_reports)\b", re.I)
# execute_sql is on the allow list (Michael, 01/10/2026: "an approval I give
# automatically"), so reads and ordinary writes run without a prompt. What
# CLAUDE.md says needs his explicit approval every time still stops and asks.
# Only the SQL fields: a Bash command is outside the allow list and asks anyway.
sql = " ".join(str(ti.get(k, "")) for k in ("query", "sql"))
ask = re.compile(
    r"\b(DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|SCHEMA|COLUMN|POLICY|FUNCTION|TRIGGER|VIEW|INDEX|TYPE)"
    r"|ALTER\s+POLICY|CREATE\s+(OR\s+REPLACE\s+)?POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY"
    r"|NO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY|ALTER\s+TABLE\s+\S+\s+DROP\b)", re.I)
m = pat.search(text)
a = None if m else ask.search(sql)
if a:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason":
            "guard-sql: '%s' is destructive or changes RLS. CLAUDE.md: Michael approves this every time." % a.group(0)}}))
elif m:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason":
            "guard-sql: '%s' touches a protected table (ncr / ncr_ai / trustee_reports). "
            "CLAUDE.md forbids deleting rows there even with a general approval. "
            "If Michael explicitly asked for this exact statement, he runs it himself." % m.group(0)}}))
else:
    print("{}")
