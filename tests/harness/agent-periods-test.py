#!/usr/bin/env python3
"""Every Routine that reports with agent_report is on the weekly mail's list (11/10/2026).

weekly-digest.js AGENT_PERIODS decides when a silent agent turns red. Two agents
(routine-validity, routine-mail-filing) were set up without being added, so if they had
stopped, nothing in the mail would have shown it. The name comes from "שם הסוכן: <name>" in
project-files/routine-*.md and retro-prompt.md. NOT_RECURRING: Routines that do not run on a
schedule, with the reason.
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0
NOT_RECURRING = {'routine-night': 'one night run (10/10/2026), no schedule'}


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


js = open(os.path.join(ROOT, 'functions/api/weekly-digest.js'), encoding='utf-8').read()
m = re.search(r'export const AGENT_PERIODS = \{([^}]*)\}', js)
check('AGENT_PERIODS found', bool(m))
listed = set(re.findall(r"'?([a-z][a-z0-9-]*)'?\s*:\s*\d+", m.group(1) if m else ''))
files = glob.glob(os.path.join(ROOT, 'project-files/routine-*.md')) + [os.path.join(ROOT, 'project-files/retro-prompt.md')]
names = {}
for f in files:
    if not os.path.exists(f): continue
    for n in re.findall(r'שם הסוכן: ([a-z0-9-]+)', open(f, encoding='utf-8').read()):
        names[n] = os.path.basename(f)
check('agent names found in the Routine files', len(names) >= 8, sorted(names))
for n, f in sorted(names.items()):
    if n in NOT_RECURRING: continue
    check(n + ' (' + f + ') is on AGENT_PERIODS', n in listed)
for n in sorted(listed):
    check(n + ' on AGENT_PERIODS has a Routine file', n in names)
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
