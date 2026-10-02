#!/usr/bin/env python3
"""Is every name the SQL tools arrive under covered by the guard-sql.py matcher
in .claude/settings.json? 02/10/2026: the Supabase connector came with a UUID
prefix (mcp__ea272696-...__execute_sql) and the matcher lists only
mcp__Supabase__*, so DELETE on ncr would not have been stopped by the hook.
A cloud session cannot change settings.json (lesson 42), so this only warns:
a ::warning:: on every PR until a session on Michael's computer fixes it.
Exit 0 always. Test: tests/harness/hook-coverage-test.py
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
        print("::warning title=guard-sql does not cover::" + ", ".join(miss) +
              ". Fix the matcher in .claude/settings.json on Michael's computer (handoff, lesson 42).")
    else:
        print("guard-sql covers every SQL tool name")
    sys.exit(0)
