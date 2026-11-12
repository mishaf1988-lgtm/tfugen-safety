#!/usr/bin/env python3
"""The guard for ideas-lab 12 and lesson 210 (Michael, 11/11/2026, questionnaire: "do it: an automatic guard on the code").

1. server_state is written whole. A write with "merge-duplicates" after a read drops what another agent saved in
   between; stateCas (functions/_cas.js) does not. The 38 old writes are moved one key per PR, so this is a ratchet:
   BASE holds how many are left in each file. A new one fails the test (use stateCas, or put "cas-ok: <why>" on the
   line for a key with one writer); a moved one fails it too until BASE is lowered, so the number only goes down.
2. A freshness window written "now - t >= 0 && now - t < X" treats a stamp a few ms ahead (a retry, another worker,
   the database clock) as stale: the second-check valve reset its count and the fail mail could go out twice
   (11/11/2026). Such a line fails unless it allows a small negative gap, or says "clock-ok: <why>".
"""
import glob, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print("  ✓ " + label)
    else: failed += 1; print("  ✗ " + label + ("  -> " + str(detail)[:400] if detail is not None else ""))

# how many unprotected server_state writes are left, per file. Only ever lower these.
BASE = {
    "functions/api/routine-db.js": 14, "functions/api/wa-hook.js": 8, "functions/_wa.js": 3, "functions/_push.js": 2,
    "functions/_onedrive.js": 1, "functions/api/works.js": 1, "functions/api/codes.js": 1, "functions/api/talk.js": 1,
    "functions/api/trustee-gate.js": 1, "functions/api/wa-morning.js": 1,
}

def unprotected(text):
    """Lines with merge-duplicates whose call (4 lines back) names server_state, minus those marked cas-ok."""
    L = text.split("\n"); out = []
    for i, l in enumerate(L):
        if "resolution=merge-duplicates" not in l: continue
        near = "\n".join(L[max(0, i - 4):i + 1])
        if "server_state" not in near or "cas-ok:" in near: continue
        out.append(i + 1)
    return out

CLOCK = re.compile(r"([\w.]+) - ([\w.()]+) >= 0 && \1 - \2 <")
def stale_clock(text):
    return [i + 1 for i, l in enumerate(text.split("\n")) if CLOCK.search(l) and "clock-ok:" not in l]

files = sorted(glob.glob(os.path.join(ROOT, "functions", "**", "*.js"), recursive=True))
got = {}
clock = {}
for f in files:
    rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
    t = open(f, encoding="utf-8").read()
    u = unprotected(t)
    if u: got[rel] = u
    c = stale_clock(t)
    if c: clock[rel] = c

more = {k: v for k, v in got.items() if len(v) > BASE.get(k, 0)}
less = {k: (BASE[k], len(got.get(k, []))) for k in BASE if len(got.get(k, [])) < BASE[k]}
check("no new server_state write with merge-duplicates (use stateCas from functions/_cas.js, or 'cas-ok: <why>' on the line)", not more, more)
check("BASE is not above what is left: lower it in this PR when a write moves to stateCas (the number only goes down)", not less, less)
check("no freshness window 'now - t >= 0 && now - t < X' (a stamp a few ms ahead is fresh: allow a small negative gap, or 'clock-ok: <why>'; lesson 210)", not clock, clock)

# the detectors themselves, on small samples (a guard that never fires proves nothing)
NEW = "await fetch(url + '/rest/v1/server_state?on_conflict=key', { method: 'POST',\n  headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' } });"
check("detector: a server_state write with merge-duplicates on the next line is found", unprotected(NEW) == [2])
check("detector: the same write marked cas-ok is left alone", unprotected(NEW.replace("{ method", "{ /* cas-ok: one writer */ method")) == [])
check("detector: merge-duplicates on another table is left alone", unprotected("fetch(u + '/rest/v1/push_subs', { headers: { Prefer: 'resolution=merge-duplicates' } })") == [])
check("detector: 'now - t >= 0 && now - t < GAP' is found, the tolerant form and a clock-ok line are not",
      stale_clock("if (t && now - t >= 0 && now - t < GAP) x();") == [1]
      and stale_clock("if (t && now - t >= -60000 && now - t < GAP) x();") == []
      and stale_clock("if (now - t >= 0 && now - t < GAP) x(); // clock-ok: log order") == [])
check("detector: two different subtractions on one line are not taken for a window", stale_clock("if (a - b >= 0 && c - d < 5) x();") == [])

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
