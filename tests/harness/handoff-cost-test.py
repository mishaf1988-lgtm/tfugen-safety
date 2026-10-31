#!/usr/bin/env python3
"""The newest handoff in the root carries a line with the conversation's cost (31/10/2026).
Two conversations of 30/10/2026 were never measured because nobody wrote their cost down when they ended;
get_session now returns usage.cost_usd. The line starts with the bold label "עלות השיחה:" and holds a
dollar amount, or says the cost was not measured, and why. Only the newest handoff is checked.
A handoff-only PR skips the harness, so this runs in the tests job (workflow tests.yml).

Test:  python3 tests/harness/handoff-cost-test.py
"""
import glob, os, re, sys
from _common import check, done, repo_root

root = repo_root()
files = sorted(glob.glob(os.path.join(root, "handoff-*.md")), key=os.path.getmtime)
check("there is a handoff in the root", len(files) >= 1, files)
if files:
    text = open(files[-1], encoding="utf-8").read()
    line = next((l for l in text.splitlines() if l.startswith("**עלות השיחה:**")), "")
    ok = bool(re.search(r"\d+(\.\d+)?\s*דולר", line)) or ("לא נמדדה" in line and len(line) > 40)
    check("the newest handoff has a cost line: '**עלות השיחה:**' with dollars, or 'לא נמדדה' and a reason (%s)" % os.path.basename(files[-1]), ok, line or "(no such line)")
# The checker itself: a made-up line is judged as expected.
judge = lambda l: bool(re.search(r"\d+(\.\d+)?\s*דולר", l)) or ("לא נמדדה" in l and len(l) > 40)
check("the rule accepts dollars and 'not measured, with a reason'", judge("**עלות השיחה:** 7.28 דולר") and judge("**עלות השיחה:** לא נמדדה, השיחה נסגרה בלי שדה עלות"))
check("the rule refuses an empty or bare line", not judge("**עלות השיחה:**") and not judge("**עלות השיחה:** לא נמדדה"))
done()
