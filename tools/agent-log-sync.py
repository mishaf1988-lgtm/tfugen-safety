#!/usr/bin/env python3
"""Write the agents' reports that are missing from project-files/agent-log.md.

11/11/2026 (Michael in the questionnaire: "do it: complete the agents' log"; DECISIONS 11/11/2026
"four upgrades"): the server keeps only ~200 rows in agent_log (about 3 days), and the file got them only
when the retro pushed, so 109 reports never reached it. Since then every agent_report is also a permanent
row in notifications_log, and this script reads both:
  - agent_log_since (the permanent rows, from the last day in the file, or --since)
  - state_get agent_log (the last ~200, also the ones from before the permanent rows existed)
and appends each report that is not in the file yet, oldest first, in the file's format:
  DD/MM/YYYY | <agent> | [(נכשל) ]<line> | למדתי: <learned or אין>
A report is "in the file" when a line with the same date and agent starts its text with the same 60
characters, so a line the retro wrote by hand is not added twice.

Usage: python3 tools/agent-log-sync.py [--since YYYY-MM-DD] [--dry]
Exit 0 = done (prints how many were added), 3 = no ROUTINE_KEY, 4 = the server did not answer.
Who runs it: the retro (step 0), and any session or agent that opens a PR and wants the file current.
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, 'project-files', 'agent-log.md')
DB = os.path.join(ROOT, 'project-files', 'routine-db.sh')
FAIL = '(נכשל) '
LEARNED = 'למדתי: '
NONE = 'אין'
DATED = re.compile(r'^(\d\d)/(\d\d)/(\d{4}) \| ')


def call(body):
    p = subprocess.run(['bash', DB, json.dumps(body, ensure_ascii=False)], capture_output=True, text=True)
    if p.returncode != 0:
        return p.returncode, None
    try:
        return 0, json.loads(p.stdout)
    except ValueError:
        return 4, None


def clean(s):
    return re.sub(r'\s+', ' ', str(s or '')).replace('|', '/').strip()


def il_day(iso):
    t = datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    # Israel time without tzdata: +2 in winter, +3 in summer (the Friday before the last Sunday of March to the last Sunday of October)
    y = t.year
    mar = max(d for d in range(25, 32) if datetime(y, 3, d).weekday() == 6) - 2  # the Friday before the last Sunday of March
    octo = max(d for d in range(25, 32) if datetime(y, 10, d).weekday() == 6)
    summer = datetime(y, 3, mar, tzinfo=timezone.utc) <= t < datetime(y, 10, octo, tzinfo=timezone.utc)
    return (t + timedelta(hours=3 if summer else 2)).strftime('%d/%m/%Y')


# The file is in a public repo and pii-md-test fails the PR on a mobile number or a personal address (retro 12/11/2026:
# the same line would be written again on every run), so they are replaced before the line is written.
MOBILE = re.compile(r'(?<![\d.])(?:\+?972[- ]?|0)5\d(?:[- ]?\d){7}(?![\d])')
EMAIL = re.compile(r'[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}')


def scrub(t):
    return MOBILE.sub('<\u05e0\u05d9\u05d9\u05d3>', EMAIL.sub('<\u05db\u05ea\u05d5\u05d1\u05ea>', t))


def key(day, agent, text):
    return (day, agent.strip(), clean(text).replace(FAIL, '')[:60])


def fmt(e):
    line = scrub(clean(e.get('line')) or clean(e.get('for_michael')))
    if e.get('ok') is not True:
        line = FAIL + line
    return '%s | %s | %s | %s%s' % (il_day(e['at']), e['agent'], line, LEARNED, scrub(clean(e.get('learned'))) or NONE)


def main(argv):
    dry = '--dry' in argv
    since = argv[argv.index('--since') + 1] if '--since' in argv else None
    text = open(LOG, encoding='utf-8').read()
    have = set()
    last = None
    for ln in text.splitlines():
        m = re.match(r'^(\d\d/\d\d/\d{4}) \| ([^|]+?) \| (.*?)(?: \| ' + LEARNED + '|$)', ln)
        if m:
            have.add(key(m.group(1), m.group(2), m.group(3)))
            last = m.group(1)
    if not since:
        since = (datetime.strptime(last, '%d/%m/%Y') - timedelta(days=1)).strftime('%Y-%m-%d') if last else '2026-10-09'
    got = {}
    perm, cur = [], since
    for _ in range(50):  # pages of 1000, oldest first; "more" = there may be another page after the last row
        rc, a = call({'op': 'agent_log_since', 'since': cur, 'limit': 1000})
        if rc == 3:
            print('ROUTINE_KEY missing', file=sys.stderr)
            return 3
        if rc != 0 or not a:
            break
        page = a.get('rows', [])
        perm += page
        if not a.get('more') or not page:
            break
        cur = page[-1]['at']
    rc2, b = call({'op': 'state_get', 'keys': ['agent_log']})
    recent = []
    if rc2 == 0 and b:
        for r in b.get('rows', []):
            if r.get('key') == 'agent_log':
                try:
                    recent = json.loads(r.get('value') or '[]')
                except ValueError:
                    recent = []
    if rc != 0 and rc2 != 0:
        print('the server did not answer', file=sys.stderr)
        return 4
    for e in perm + recent:
        if isinstance(e, dict) and e.get('agent') and e.get('at') and e['at'][:10] >= since:
            got[(e['at'], e['agent'])] = e
    add = []
    for e in sorted(got.values(), key=lambda x: x['at']):
        ln = fmt(e)
        m = re.match(r'^(\d\d/\d\d/\d{4}) \| ([^|]+?) \| (.*?) \| ', ln)
        k = key(m.group(1), m.group(2), m.group(3))
        if k in have:
            continue
        have.add(k)
        add.append(ln)
    if add and not dry:
        # by date, oldest first (stable): agents read their last 5 lines with grep | tail, so a late
        # report of 26/10 must not land after the lines of 11/11
        lines = text.splitlines()
        first = next((i for i, l in enumerate(lines) if DATED.match(l)), len(lines))
        rows = [l for l in lines[first:] if l.strip()] + add
        rows.sort(key=lambda l: (lambda m: (m.group(3), m.group(2), m.group(1)) if m else ('9999', '99', '99'))(DATED.match(l)))
        with open(LOG, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines[:first] + rows) + '\n')
    print('agent-log: %d added (since %s; permanent %s, recent %d)%s' % (len(add), since, len(perm) if rc == 0 else 'unread', len(recent), ' [dry]' if dry else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
