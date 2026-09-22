#!/usr/bin/env python3
"""PreToolUse guard: blocks destructive SQL against the tables CLAUDE.md marks
as never-delete (ncr, ncr_ai, trustee_reports), whether it arrives through
Bash or through the Supabase MCP (execute_sql / apply_migration).

A rule in a hook is enforced on every call; a rule in CLAUDE.md is advice
that can be dropped after context compaction.

Test:  echo '{"tool_input":{"query":"TRUNCATE ncr"}}' | python3 .claude/hooks/guard-sql.py
"""
import json, re, sys

d = json.load(sys.stdin)
ti = d.get("tool_input", {}) or {}
text = " ".join(str(ti.get(k, "")) for k in ("command", "query", "sql"))
pat = re.compile(
    r"\b(DELETE\s+FROM|TRUNCATE(\s+TABLE)?|DROP\s+TABLE(\s+IF\s+EXISTS)?)\s+"
    r"(public\.)?(ncr|ncr_ai|trustee_reports)\b", re.I)
m = pat.search(text)
if m:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason":
            "guard-sql: '%s' touches a protected table (ncr / ncr_ai / trustee_reports). "
            "CLAUDE.md forbids deleting rows there even with a general approval. "
            "If Michael explicitly asked for this exact statement, he runs it himself." % m.group(0)}}))
else:
    print("{}")
