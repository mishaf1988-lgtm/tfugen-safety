#!/usr/bin/env python3
"""CLAUDE.md rule 7: no [x] without proof that it ran. A migration, RLS policy
or Storage change is marked done only after the run was verified. Until now
the rule was text (a hook idea from 02/10/2026 that a cloud session cannot
install), so this runs in CI instead, on the PR diff only: the archive holds
60 older [x] lines from before the rule, and they stay as they are.

A line added to STATUS.md or project-files/STATUS-archive.md that is marked
[x], names a migration file (YYYY-MM-DD_name.sql) and does not say it was
verified ("אומת" / "verified") fails.

Input: `git diff -U0 BASE HEAD -- STATUS.md project-files/STATUS-archive.md` on stdin.
Exit 0 = ok, 1 = a line to fix. Test: tests/harness/rule7-gate-test.py
"""
import re, sys

DONE = re.compile(r"^\+\s*- \[x\]")
MIG = re.compile(r"\d{4}-\d{2}-\d{2}_[A-Za-z0-9_]+\.sql")
OK = re.compile(r"אומת|verified", re.I)


def bad_lines(diff):
    return [l[1:].strip()[:160] for l in diff.split("\n")
            if DONE.match(l) and MIG.search(l) and not OK.search(l)]


if __name__ == "__main__":
    bad = bad_lines(sys.stdin.read())
    for b in bad:
        print("rule 7: [x] on a migration without 'אומת': " + b)
    if bad:
        print("CLAUDE.md rule 7: write how it was verified (\"הורץ ואומת דרך Supabase MCP ב-DD/MM/YYYY\"), or leave it [ ].")
    sys.exit(1 if bad else 0)
