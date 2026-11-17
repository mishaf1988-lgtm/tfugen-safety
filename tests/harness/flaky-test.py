#!/usr/bin/env python3
"""tests/harness/flaky.md (Michael, 17/11/2026, four test rules, rule 3): every row names a test, the date it was
written, what failed, a state and what was done. An open row older than 14 days is red: fix the test or delete it
with a reason, never leave it and run again. FLAKY_FILE / FLAKY_TODAY replace the file and the date in the checks below."""
import datetime, os, re, subprocess, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
STATES = ("\u05e4\u05ea\u05d5\u05d7\u05d4", "\u05ea\u05d5\u05e7\u05e0\u05d4", "\u05e0\u05de\u05d7\u05e7\u05d4")


def problems(text, today, exists):
    out, rows = [], [l for l in text.splitlines() if l.startswith("|")][2:]
    for l in rows:
        c = [x.strip().strip("`") for x in l.strip().strip("|").split("|")]
        if len(c) != 5:
            out.append("not 5 columns: " + l[:60]); continue
        name, when, what, state, done_ = c
        m = re.fullmatch(r"(\d\d)/(\d\d)/(\d{4})", when)
        if not m:
            out.append(name + ": date is not DD/MM/YYYY"); continue
        d = datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if state not in STATES:
            out.append(name + ": state is not one of the three"); continue
        if len(what) < 5:
            out.append(name + ": what failed is empty")
        if state == STATES[2]:
            if exists(name):
                out.append(name + ": marked deleted but the file is still here")
            if len(done_) < 10:
                out.append(name + ": deleted without a reason")
        else:
            if not exists(name):
                out.append(name + ": no such test in tests/harness")
            if state == STATES[1] and not re.search(r"#\d+", done_):
                out.append(name + ": fixed without the PR number")
            if state == STATES[0] and (today - d).days > 14:
                out.append(name + ": open for more than 14 days, fix it or delete it with a reason")
    return out


if __name__ == "__main__":
    res = [0, 0]
    def check(label, cond, detail=None):
        res[0 if cond else 1] += 1
        print(("  \u2713 " if cond else "  \u2717 ") + label + ("" if cond or detail is None else "  -> " + repr(detail)[:300]))
    real = lambda n: os.path.exists(os.path.join(HERE, n))
    txt = open(os.path.join(HERE, "flaky.md"), encoding="utf-8").read()
    p = problems(txt, datetime.date.today(), real)
    check("flaky.md: every row is complete, and nothing is open for more than 14 days", not p, p)
    check("flaky.md says no re-run until green", "\u05d0\u05e1\u05d5\u05e8 \u05dc\u05d4\u05e8\u05d9\u05e5 \u05e9\u05d5\u05d1" in txt)
    # the checker itself, on rows that must and must not pass
    H = "| a | b | c | d | e |\n|---|---|---|---|---|\n"
    T = datetime.date(2026, 11, 17); ex = lambda n: n == "a-test.js"
    row = lambda *c: problems(H + "| " + " | ".join(c) + " |\n", T, ex)
    check("an open row of today on a real test: fine", row("`a-test.js`", "17/11/2026", "timeout in step 3", STATES[0], "") == [])
    check("...open for 15 days: red", row("a-test.js", "02/11/2026", "timeout in step 3", STATES[0], "") != [])
    check("...a test that does not exist: red", row("zz-test.js", "17/11/2026", "timeout in step 3", STATES[0], "") != [])
    check("fixed with a PR number: fine; without: red", row("a-test.js", "01/10/2026", "timeout in step 3", STATES[1], "#2900 fixed wait") == [] and row("a-test.js", "01/10/2026", "timeout in step 3", STATES[1], "fixed") != [])
    check("deleted with a reason: fine; while the file is still here, or with no reason: red", row("gone-test.js", "01/10/2026", "timeout in step 3", STATES[2], "covered by a-test.js step 4") == [] and row("a-test.js", "01/10/2026", "timeout in step 3", STATES[2], "covered by a-test.js step 4") != [] and row("gone-test.js", "01/10/2026", "timeout in step 3", STATES[2], "") != [])
    check("a date as YYYY-MM-DD, an unknown state, a missing column: red", row("a-test.js", "2026-11-17", "timeout", STATES[0], "") != [] and row("a-test.js", "17/11/2026", "timeout", "maybe", "") != [] and problems(H + "| a-test.js | 17/11/2026 |\n", T, ex) != [])
    print("\n%d passed, %d failed" % (res[0], res[1]))
    sys.exit(1 if res[1] else 0)
