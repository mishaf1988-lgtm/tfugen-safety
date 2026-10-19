#!/usr/bin/env python3
"""No mobile number and no personal email address in the .md files of the public repo (13/10/2026, BACKLOG 13.17).

The repo is public. A security scan (10/10/2026) found Michael's mobile number in DECISIONS and
STATUS-archive, another mobile number in STATUS-archive, and about 10 email addresses of
employees and outside contacts in the routine and flow docs. They were replaced by a plain
description ("הנייד של מיכאל", "<geny>"). This test fails on a new one, in any tracked .md file.
  - mobile: an Israeli mobile number (05X, 9725X, +9725X, with or without dashes or spaces);
  - email: any full address, except role mailboxes and addresses that are public by design (ALLOWED)
    and test or example domains (ALLOWED_DOMAINS).
Not scanned: migrations (.sql, already run, BACKLOG 13.17 leaves the trustee names there),
code and tests (the WhatsApp placeholder in index.html and test fixtures are not .md), and git history.
A number found here: write who it belongs to instead ("הנייד של מיכאל"), and the full number only
where it is used (Supabase, the flow itself).
"""
import os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0
MOBILE = re.compile(r'(?<![\d.])(?:\+?972[- ]?|0)5\d(?:[- ]?\d){7}(?![\d])')
EMAIL = re.compile(r'[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}')
ALLOWED = {
    'sviva@tapugan.co.il',  # the environment and safety mailbox, the app sends from and to it
    'mishaf1988@gmail.com',  # Michael's own, published on privacy.html and user-data-deletion.html
    'hr-tap@tapugan.co.il', 'prod@tapugan.co.il', 'safety@tapugan.co.il', 'noreply@tapugan.co.il',
    'safety@send.tapugan.co.il', 'odoo@k-t.co.il', 'info@vitre.io',
    'onboarding@resend.dev', 'powerautomatenoreply@microsoft.com',
    'coa@il.mxns.com',  # the lab's certificate mailbox (routine-coa.md, 18/10/2026), a role address
}
ALLOWED_DOMAINS = ('tfugen.local', 'evil.com', 'example.com', 'b.c')


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


def scan(text):
    out = [m.group(0) for m in MOBILE.finditer(text)]
    for m in EMAIL.finditer(text):
        a = m.group(0).lower()
        if a in ALLOWED or a.split('@')[1].endswith(ALLOWED_DOMAINS): continue
        out.append(a)
    return out


print('the scanner itself')
check('catches a mobile number in every way it was written', all(scan(x) for x in ['(054-7940073)', '‎972547940073', '+972547940073', '052-5750933', '054 794 0073', '0547940073']))
check('dates, ids, sizes and money are not phone numbers', not scan('260012-3, 05/10/2026, 1,710 מיילים, 177677, 2026-10-05, 0.5123456789, ext_id 599, 9725XXXXXXXX'))
check('catches a personal address, not a role mailbox or a test one', scan('Hedva@tapugan.co.il') and scan('tamar@gafir-sys.com') and not scan('sviva@tapugan.co.il, user1@tfugen.local, rtmgr@evil.com, a@b.c'))

print('\nthe repo (every tracked .md file)')
files = [f for f in subprocess.run(['git', 'ls-files', '*.md'], cwd=ROOT, capture_output=True, text=True).stdout.split('\n') if f]
check('git ls-files works', len(files) > 50, len(files))
found = []
for f in files:
    try: t = open(os.path.join(ROOT, f), encoding='utf-8').read()
    except Exception: continue
    for x in scan(t): found.append(f + ': ' + x)
check('no mobile number and no personal address in any .md file', not found, found[:10])
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
