#!/usr/bin/env python3
"""Is every name the SQL tools arrive under covered by the guard-sql.py matcher
in .claude/settings.json? 02/10/2026: the Supabase connector came with a UUID
prefix (mcp__ea272696-...__execute_sql) and the matcher lists only
mcp__Supabase__*, so DELETE on ncr would not have been stopped by the hook.
Fixed on Michael's computer 05/10/2026 (matcher mcp__.*__execute_sql), so a
name that is not covered now fails the check (exit 1) instead of warning.
Test: tests/harness/hook-coverage-test.py
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
NAMES = ["mcp__Supabase__execute_sql", "mcp__Supabase__apply_migration",
         "mcp__ea272696-c3b4-4b3b-bbcf-628f340e74ab__execute_sql",
         "mcp__ea272696-c3b4-4b3b-bbcf-628f340e74ab__apply_migration"]


def uncovered(settings, hook="guard-sql.py", names=NAMES):
    ms = [h.get("matcher") or "" for h in settings.get("hooks", {}).get("PreToolUse", [])
          if any(hook in (x.get("command") or "") for x in h.get("hooks", []))]
    return [n for n in names if not any(re.fullmatch(m, n) for m in ms)]


if __name__ == "__main__":
    s = json.load(open(os.path.join(ROOT, ".claude", "settings.json"), encoding="utf-8"))
    miss = uncovered(s)
    if miss:
        print("::error title=guard-sql does not cover::" + ", ".join(miss) +
              ". Fix the guard-sql matcher in .claude/settings.json (a cloud session cannot, lesson 42).")
        sys.exit(1)
    print("guard-sql covers every SQL tool name")
    sys.exit(0)
