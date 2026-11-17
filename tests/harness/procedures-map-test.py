#!/usr/bin/env python3
"""project-files/assistant/procedures-map.md (Michael, 17/11/2026: "do it: a procedures map for the assistant"):
the map finds the procedure and never answers for it. Every row has a file prefix, a header date and topics; it holds
no numbers that go stale (frequencies, hours, ppm) and no names of people (the repo is public); the assistant's ISO
file sends procedure questions to it."""
import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
res = [0, 0]
def check(label, cond, detail=None):
    res[0 if cond else 1] += 1
    print(("  \u2713 " if cond else "  \u2717 ") + label + ("" if cond or detail is None else "  -> " + repr(detail)[:300]))
txt = open(os.path.join(ROOT, "project-files", "assistant", "procedures-map.md"), encoding="utf-8").read()
tab = txt.split("## \u05d4\u05de\u05e4\u05d4")[1].split("\n## ")[0]
rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in tab.splitlines() if l.startswith("|")][2:]
check("the map has the procedures of the folder (20 rows of 8 columns)", len(rows) == 20 and all(len(r) == 8 for r in rows), [len(r) for r in rows])
check("every row has a file prefix and a header date as DD/MM/YYYY", all(len(r[2]) >= 5 and re.fullmatch(r"\d\d/\d\d/\d{4}", r[3]) for r in rows), [r[:4] for r in rows if not re.fullmatch(r"\d\d/\d\d/\d{4}", r[3])])
check("every row lists at least 3 questions it answers", all(r[5].count(";") >= 2 for r in rows), [r[0] for r in rows if r[5].count(";") < 2])
check("procedure ids are unique", len({r[0] for r in rows}) == 20)
stale = [r[0] for r in rows if re.search(r"\d+\s*(ppm|\u05e9\u05e2\u05d5\u05ea|\u05d3\u05e7\u05d5\u05ea|\u05d7\u05d5\u05d3\u05e9\u05d9\u05dd|\u05d9\u05de\u05d9\u05dd|\u05d9\u05d5\u05dd)", r[4] + r[5])]
check("no value that goes stale in the roles and topics columns (hours, minutes, months, ppm)", not stale, stale)
check("the rule is written: the answer comes from the live file, never from the map", "\u05d4\u05ea\u05e9\u05d5\u05d1\u05d4 \u05ea\u05de\u05d9\u05d3 \u05de\u05d4\u05e7\u05d5\u05d1\u05e5 \u05d4\u05d7\u05d9" in txt)
iso = open(os.path.join(ROOT, "project-files", "assistant", "iso-docs.md"), encoding="utf-8").read()
check("the assistant's ISO file sends procedure questions to the map", "project-files/assistant/procedures-map.md" in iso)
print("\n%d passed, %d failed" % (res[0], res[1]))
sys.exit(1 if res[1] else 0)
