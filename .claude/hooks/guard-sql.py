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
    r"\b(DELETE\s+FROM|TRUNCATE(\s+TABLE)?|DROP\s+TABLE(\s+IF\s+EXISTS)?)\s+(ONLY\s+)?"
    r"([\w.]+\s*,\s*)*(public\s*\.\s*)?(ncr|ncr_ai|trustee_reports)\b", re.I)


def plain(q):
    # Comments and double quotes do not change what a statement deletes: "ncr", ONLY ncr,
    # /**/ ncr and a table list ('truncate tasks, ncr') were only asked, not denied (retro 12/10/2026).
    # A comment marker inside a literal is not a comment ('a--b'; delete from ncr), so this walks
    # the text and skips '...', "..." and $tag$...$tag$ instead of a regex over all of it.
    out, i, n = [], 0, len(q)
    while i < n:
        c = q[i]
        if c == "'" or c == '"':
            j = i + 1
            while j < n:
                if q[j] == c:
                    if j + 1 < n and q[j + 1] == c:
                        j += 2; continue
                    break
                j += 1
            out.append(q[i:j + 1] if c == "'" else q[i + 1:j]); i = j + 1
        elif c == "$":
            m = re.match(r"\$\w*\$", q[i:])
            e = q.find(m.group(0), i + len(m.group(0))) if m else -1
            if e < 0:
                out.append(c); i += 1
            else:
                e += len(m.group(0)); out.append(q[i:e]); i = e
        elif q.startswith("--", i):
            j = q.find("\n", i); i = n if j < 0 else j
            out.append(" ")
        elif q.startswith("/*", i):
            j = q.find("*/", i + 2); i = n if j < 0 else j + 2
            out.append(" ")
        else:
            out.append(c); i += 1
    return "".join(out)


# execute_sql is on the allow list (Michael, 01/10/2026: "an approval I give
# automatically"), so reads and ordinary writes run without a prompt. What
# CLAUDE.md says needs his explicit approval every time still stops and asks.
# Only the SQL fields: a Bash command is outside the allow list and asks anyway.
sql = " ".join(str(ti.get(k, "")) for k in ("query", "sql"))
ask = re.compile(
    r"\b(DELETE\s+FROM|TRUNCATE|DROP\s+(TABLE|SCHEMA|COLUMN|POLICY|FUNCTION|TRIGGER|VIEW|INDEX|TYPE)"
    r"|ALTER\s+POLICY|CREATE\s+(OR\s+REPLACE\s+)?POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY"
    r"|NO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY|ALTER\s+TABLE\s+\S+\s+DROP\b)", re.I)
# tfugen-db rule 7a (10/10/2026, recurred 11/10/2026): a ';' inside a quoted
# literal, or a U+05F4 gershayim anywhere, makes the connector hang for 60s and
# the statement never reaches the database. Text alone did not stop it.
def semi_in_literal(q):
    i, n = 0, len(q)
    while i < n:
        if q[i] == "'":
            j = i + 1
            while j < n:
                if q[j] == "'":
                    if j + 1 < n and q[j + 1] == "'":
                        j += 2; continue
                    break
                if q[j] == ';':
                    return True
                j += 1
            i = j + 1
        else:
            i += 1
    return False


m = pat.search(plain(text))
a = None if m else ask.search(plain(sql))
t = None if (m or a) else ("\u05f4" if "\u05f4" in sql else (";" if semi_in_literal(plain(sql)) else None))
# tfugen-db rule 8 (03/10/2026, lesson 45): a DO $$ block hangs the connector the
# same way, in execute_sql and apply_migration alike. Run the statements one by one.
d8 = None if (m or a or t) else re.search(r"\bDO\s+(LANGUAGE\s+\w+\s+)?\$", re.sub(r"'(?:[^']|'')*'", "''", sql), re.I)
if d8:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason":
            "guard-sql (tfugen-db 8): a DO $$ block hangs execute_sql/apply_migration for 60s. "
            "Send the statements as plain SQL, one by one, without DO."}}))
    sys.exit(0)
if t:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason":
            "guard-sql (tfugen-db 7a): %s inside the SQL text hangs execute_sql for 60s and nothing is written. "
            "Use a comma or period instead of ';', and a plain '\"' instead of the Hebrew gershayim." % (
                "a ';' inside a quoted string" if t == ";" else "the Hebrew gershayim (U+05F4)")}}))
elif a:
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
