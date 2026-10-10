#!/usr/bin/env python3
"""Microsoft 365 writes from the SERVER (functions/), 05/10/2026.

guard-365.py and the assistant's m365.md govern Claude's own tool calls. The Pages
Functions write to 365 with the connected account's token, outside any hook: they send
mail (the weekly digest, the department report, the trustee notification, "closed" to a
reporter) and delete OneDrive items (backup pruning, old copies in 'הוחלפו'). Michael
approved each of those when it was built. A NEW call site that sends or deletes fails
here until Michael approves it and it is added below, with the date.
"""
import os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ok = bad = 0


def check(label, cond, detail=None):
    global ok, bad
    if cond: ok += 1; print('  ✓ ' + label)
    else: bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


# Approved call sites, by file and the function or method used. Michael, dates in DECISIONS.
APPROVED_SEND = {
    'functions/_onedrive.js': 4,       # sendMail + sendMailTo: the two helpers, each with its Graph url
    'functions/_watchdog.js': 1,       # the watchdog mail to Michael: a server task that stopped running (30/09/2026)
    'functions/api/close-hazard.js': 1,  # "closed" mail to the reporter (28/09/2026)
    'functions/api/mail-inbox.js': 1,    # "closed" reply to a mail reporter (29/09/2026)
    'functions/api/trustee-notify.js': 1,  # trustee finding notification (22/09/2026)
    'functions/api/weekly-digest.js': 1,   # the weekly mail (28/09/2026)
    'functions/api/hazard-report.js': 1,   # the department report (28/09/2026)
    'functions/api/talk.js': 1,   # signed new-worker induction form to Michael and hr-tap@ (questionnaire 10/10/2026)
}
APPROVED_DELETE = {
    'functions/api/backup-od.js': 1,   # prune old daily backups in _Backups (01/10/2026)
    'functions/api/hazard-file.js': 1,  # prune old copies in 'הוחלפו' after KEEP_DAYS (29/09/2026)
}
SEND = re.compile(r"\bsendMail(To)?\s*\(|/me/sendMail")
# A Graph DELETE: method DELETE on a fetch whose url is Graph (same statement or a GRAPH constant).
DELETE = re.compile(r"method:\s*'DELETE'")
GRAPHY = re.compile(r"graph\.microsoft\.com|\bGRAPH\b|\bG\b\s*\+")


def scan():
    sends, deletes = {}, {}
    for d, _, files in os.walk(os.path.join(ROOT, 'functions')):
        for f in files:
            if not f.endswith('.js'): continue
            p = os.path.join(d, f); rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
            src = open(p, encoding='utf-8').read()
            n = len([m for m in SEND.finditer(src) if not re.search(r"^\s*//|^\s*\*", src[src.rfind('\n', 0, m.start()) + 1:m.start()])])
            if n: sends[rel] = n
            for m in DELETE.finditer(src):
                line_start = src.rfind('\n', 0, m.start()) + 1
                ctx = src[max(0, line_start - 400):m.end()]
                if GRAPHY.search(ctx) and '/rest/v1' not in src[line_start:m.end()] and '/auth/v1' not in src[line_start:m.end()]:
                    deletes[rel] = deletes.get(rel, 0) + 1
    return sends, deletes


sends, deletes = scan()
check('every mail send in functions/ is an approved call site', sends == APPROVED_SEND, {'found': sends, 'approved': APPROVED_SEND})
check('every Graph DELETE in functions/ is an approved call site', deletes == APPROVED_DELETE, {'found': deletes, 'approved': APPROVED_DELETE})
check('the hook file exists and is wired', os.path.exists(os.path.join(ROOT, '.claude', 'hooks', 'guard-365.py'))
      and 'guard-365.py' in open(os.path.join(ROOT, '.claude', 'settings.json'), encoding='utf-8').read())
check('CLAUDE.md points to the rules for all the interfaces (michael-skills since 07/10/2026)', 'michael-skills' in open(os.path.join(ROOT, 'CLAUDE.md'), encoding='utf-8').read() and 'references/m365.md' in open(os.path.join(ROOT, 'CLAUDE.md'), encoding='utf-8').read())
print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
