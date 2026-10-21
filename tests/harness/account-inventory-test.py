#!/usr/bin/env python3
"""ACCOUNT-INVENTORY.md lists what lives outside the repo (11/10/2026, Michael: "if I move the
whole activity off this account, it must be documented in GitHub").

Checks: every Routine instructions file (project-files/routine-*.md, retro-prompt.md) is named in
the inventory, the inventory lists the triggers (stale-trigger-test catches a deleted id in any .md),
no secret value is written in it (only names), and each
instructions file carries the active trigger id from the table (20/10/2026).
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0
NOT_LISTED = {'routine-night.md': 'one night run, no schedule', 'routine-db-columns.md': 'moved into pg_cron db-columns-check (03/10/2026)'}


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


inv_p = os.path.join(ROOT, 'project-files/ACCOUNT-INVENTORY.md')
check('ACCOUNT-INVENTORY.md exists', os.path.exists(inv_p))
inv = open(inv_p, encoding='utf-8').read() if os.path.exists(inv_p) else ''
for f in sorted(glob.glob(os.path.join(ROOT, 'project-files/routine-*.md')) + [os.path.join(ROOT, 'project-files/retro-prompt.md')]):
    n = os.path.basename(f)
    if n in NOT_LISTED: continue
    check(n + ' is in the inventory', '`' + n + '`' in inv)
ids = set(re.findall(r'trig_[A-Za-z0-9]{20,}', inv))
check('the inventory lists triggers', len(ids) >= 10, len(ids))
# 20/10/2026 (Michael in the questionnaire: "בצע: בדיקת מזהי הסוכנים"): the COA trigger was fired by
# the id in routine-coa.md, which was a disabled one. Every live row of the table names its file, and
# that file must carry the active id; a retired row says "כבוי" in its name.
rows = re.findall(r'^\| `(trig_[A-Za-z0-9]+)` \| ([^|]*)\|[^|]*\| `((?:routine-[\w-]+|retro-prompt)\.md)` \|', inv, re.M)
check('the table rows with an instructions file are read', len(rows) >= 15, len(rows))
for t, name, f in rows:
    if '\u05db\u05d1\u05d5\u05d9' in name: continue
    fp = os.path.join(ROOT, 'project-files', f)
    body = open(fp, encoding='utf-8').read() if os.path.exists(fp) else ''
    check(f + ' names its active trigger ' + t, t in body)
check('no secret values (keys, tokens, passwords)', not re.search(r'(sk-ant-|eyJ[A-Za-z0-9_-]{20,}|sb_secret_|ghp_|github_pat_|MANUAL_KEY\s*\|\s*`[a-z0-9]{20,})', inv))
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
