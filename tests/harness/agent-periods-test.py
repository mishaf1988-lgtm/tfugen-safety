#!/usr/bin/env python3
"""Every Routine that reports with agent_report is on the weekly mail's list (11/10/2026).

SITE.agentPeriods (functions/_site.js, read by weekly-digest.js as AGENT_PERIODS) decides when a
silent agent turns red. Two agents
(routine-validity, routine-mail-filing) were set up without being added, so if they had
stopped, nothing in the mail would have shown it. The name comes from "שם הסוכן: <name>" in
project-files/routine-*.md and retro-prompt.md. NOT_RECURRING: Routines that do not run on a
schedule, with the reason. The product template (tools/platform/_site.js) is checked the same
way against tools/platform/agents/*.md (17/10/2026).
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0
NOT_RECURRING = {'routine-night': 'one night run (10/10/2026), no schedule',
                 'dev-fire': 'fired by the server per dev request (21/10/2026), silence is normal',
                 'worker-now': 'fired by the server per worker task (21/10/2026), silence is normal'}


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


js = open(os.path.join(ROOT, 'functions/api/weekly-digest.js'), encoding='utf-8').read()
check('weekly-digest.js reads AGENT_PERIODS from SITE', 'export const AGENT_PERIODS = SITE.agentPeriods;' in js)


def periods(site):
    m = re.search(r'agentPeriods: \{([^}]*)\}', open(os.path.join(ROOT, site), encoding='utf-8').read())
    check(site + ': agentPeriods found', bool(m))
    return set(re.findall(r"'?([a-z][a-z0-9-]*)'?\s*:\s*\d+", m.group(1) if m else ''))


def names_in(files, least):
    names = {}
    for f in files:
        if not os.path.exists(f): continue
        for n in re.findall(r'שם הסוכן: ([a-z0-9-]+)', open(f, encoding='utf-8').read()):
            names[n] = os.path.basename(f)
    check('agent names found (' + str(least) + '+)', len(names) >= least, sorted(names))
    return names


def match(site, files, least):
    listed, names = periods(site), names_in(files, least)
    for n, f in sorted(names.items()):
        if n in NOT_RECURRING: continue
        check(n + ' (' + f + ') is on agentPeriods of ' + site, n in listed)
    for n in sorted(listed):
        check(n + ' on agentPeriods of ' + site + ' has a Routine file', n in names)


match('functions/_site.js', glob.glob(os.path.join(ROOT, 'project-files/routine-*.md')) + [os.path.join(ROOT, 'project-files/retro-prompt.md')], 8)
match('tools/platform/_site.js', glob.glob(os.path.join(ROOT, 'tools/platform/agents/*.md')), 4)
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
