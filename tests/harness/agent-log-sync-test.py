#!/usr/bin/env python3
"""tools/agent-log-sync.py (retro 12/11/2026): the file is in a public repo, so a report with a mobile number or a
personal address is written with both replaced; the Israeli day follows the real summer-time rule (the Friday before the
last Sunday of March, the last Sunday of October); a line a report did not succeed in starts with the failure mark."""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("als", os.path.join(HERE, "..", "..", "tools", "agent-log-sync.py"))
als = importlib.util.module_from_spec(spec)
spec.loader.exec_module(als)

ok_n = bad_n = 0


def check(label, cond, detail=None):
    global ok_n, bad_n
    if cond:
        ok_n += 1
        print("  ✓ " + label)
    else:
        bad_n += 1
        print("  ✗ " + label + ("  -> " + repr(detail)[:300] if detail is not None else ""))


print("\nthe public file: no personal detail")
out = als.fmt({"at": "2026-11-11T10:00:00Z", "agent": "x", "ok": True,
               "line": "draft to dan@acme.co.il, call 052-1234567 or +972 54 765 4321",
               "learned": "write to yossi.cohen@tapugan.co.il"})
import json as _json
_S = _json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pii-samples.json"), encoding="utf-8"))
check("pii-samples.json: scrub gives the same result as the server's scrubPii (routine-db-test runs the same file)", all(als.scrub(x["in"]) == x["out"] for x in _S), [als.scrub(x["in"]) for x in _S if als.scrub(x["in"]) != x["out"]])
check("a personal address and two mobile numbers are replaced in the line", "@" not in out.split("|")[2] and "052-1234567" not in out and "765 4321" not in out, out)
check("an address in the learned part is replaced too", "@" not in out.split("|")[3], out)
for label, raw in [("a dotted mobile 054.794.0073", "054.794.0073"), ("a mobile with brackets (054)7940073", "(054)7940073"), ("972(0)547940073", "972(0)547940073"),
                   ("a landline 03-1234567", "03-1234567"), ("a landline 09 7654321", "09 7654321"), ("a nine digit ID 032145678", "032145678"),
                   ("an address with a Hebrew local part", "\u05d3\u05df@acme.co.il")]:
    o = als.fmt({"at": "2026-11-11T10:00:00Z", "agent": "x", "ok": True, "line": "call " + raw + " now", "learned": "none"}).split("|")[2]
    check(label + " is replaced", raw not in o and "<" in o, o)
check("a PR number, a date and a size stay", als.fmt({"at": "2026-11-11T10:00:00Z", "agent": "x", "ok": True, "line": "PR 2669 merged 11/11/2026, 4096 bytes, 222 passed", "learned": "none"}).split("|")[2].strip() == "PR 2669 merged 11/11/2026, 4096 bytes, 222 passed")
a = "run finished, 3 findings fixed in the report"
check("a failed report is not the same key as a success with the same opening", als.key("11/11/2026", "x", a) != als.key("11/11/2026", "x", als.FAIL + a))
check("an ordinary line stays as it was", als.fmt({"at": "2026-11-11T10:00:00Z", "agent": "y", "ok": True, "line": "3 findings fixed, PR 2669", "learned": "none"}).split("|")[2].strip() == "3 findings fixed, PR 2669")
check("a report that did not succeed starts with the failure mark", als.fmt({"at": "2026-11-11T10:00:00Z", "agent": "z", "ok": False, "line": "no key"}).split("|")[2].strip().startswith(als.FAIL.strip()))

print("\nthe Israeli day")
check("2026: 26/03 at 23:30 is still winter time (+2)", als.il_day("2026-03-26T21:30:00Z") == "26/03/2026", als.il_day("2026-03-26T21:30:00Z"))
check("2026: 27/03 21:30 UTC is summer time (+3), the next day in Israel", als.il_day("2026-03-27T21:30:00Z") == "28/03/2026", als.il_day("2026-03-27T21:30:00Z"))
check("2028: the Friday before the last Sunday of March is the 24th, not the 31st", als.il_day("2028-03-24T21:30:00Z") == "25/03/2028", als.il_day("2028-03-24T21:30:00Z"))
check("the end: the last Sunday of October 2026 (25/10)", als.il_day("2026-10-25T21:30:00Z") == "25/10/2026", als.il_day("2026-10-25T21:30:00Z"))

print("\n%d passed, %d failed" % (ok_n, bad_n))
sys.exit(1 if bad_n else 0)
