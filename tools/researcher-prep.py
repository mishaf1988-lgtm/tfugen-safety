#!/usr/bin/env python3
"""One call that decides what the assistant's researcher does today (25/11/2026, Michael in the questionnaire: "do it: one action
for the assistant's researcher"; Code Mode principle, DECISIONS 25/11/2026). The last run (13 tool calls, $0.52) walked through
steps 1, 1a, 1b, 1c of routine-researcher.md one check at a time, two repositories, before it reached the day's item. This script
makes the same decision from the same sources and prints it with the first open item.

Order (as in routine-researcher.md, only one of them per day):
  monthly - no line of the current month containing the word "monthly" (Hebrew) under "נסגר" in research-queue.md
  scout   - no routine-researcher line with the word "scout" (Hebrew) in agent-log.md in the last 7 days
  event   - no routine-researcher line with the word "branch event" (Hebrew) in agent-log.md in the current month
  exam    - no row of the current month under "תוצאות" in exam.md
  item    - otherwise: the first numbered item under "פתוח" in research-queue.md (text cut to 700 characters)
It prints `mode: <name>`, a `why:` line, and for `item` the first open item; the researcher still reads the files its mode needs.
Read-only.

Usage: python3 tools/researcher-prep.py --skills <michael-skills>/plugins/michael/skills/michael-assistant/references
       [--log project-files/agent-log.md] [--today YYYY-MM-DD]
Exit 0 = decided, 2 = a file could not be read (message printed; the researcher then follows the steps by hand).
"""
import argparse
import os
import re
import sys
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W_MONTHLY, W_SCOUT, W_EVENT = 'חודשי', 'סקאוט', 'ענף'
H_OPEN, H_CLOSED, H_RESULTS = 'פתוח', 'נסגר', 'תוצאות'
LOG_LINE = re.compile(r'^(\d\d)/(\d\d)/(\d{4}) \| routine-researcher \| (.*)$')
CLOSED_LINE = re.compile(r'^- (\d\d)/(\d\d)/(\d{4})\b(.*)$')


def sections(text):
    """{heading: [lines]} for the '## ' headings."""
    out, cur = {}, None
    for line in text.split('\n'):
        if line.startswith('## '):
            cur = line[3:].strip()
            out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return out


def section(secs, word):
    for k, v in secs.items():
        if k.startswith(word):
            return v
    return []


def researcher_log(text):
    """[(date, line text)] of the researcher's lines in agent-log.md."""
    rows = []
    for line in text.split('\n'):
        m = LOG_LINE.match(line)
        if m:
            rows.append((date(int(m.group(3)), int(m.group(2)), int(m.group(1))), m.group(4)))
    return rows


def decide(queue_text, exam_text, log_text, today):
    q = sections(queue_text)
    month = (today.year, today.month)
    closed = [m for m in (CLOSED_LINE.match(l) for l in section(q, H_CLOSED)) if m]
    if not any((int(m.group(3)), int(m.group(2))) == month and W_MONTHLY in m.group(4) for m in closed):
        return 'monthly', 'no line of this month with the monthly word under the closed items', None
    log = researcher_log(log_text)
    week = today - timedelta(days=7)
    if not any(d > week and W_SCOUT in t for d, t in log):
        return 'scout', 'no scout line in the last 7 days in agent-log.md', None
    if not any((d.year, d.month) == month and W_EVENT in t for d, t in log):
        return 'event', 'no branch-event line this month in agent-log.md', None
    rows = [l for l in section(sections(exam_text), H_RESULTS) if re.match(r'^\|\s*\d\d/\d{4}\b', l)]
    if not any(re.match(r'^\|\s*%02d/%d\b' % (today.month, today.year), l) for l in rows):
        return 'exam', 'no row of this month under the results in exam.md', None
    for l in section(q, H_OPEN):
        if re.match(r'^\d+\. ', l):
            return 'item', 'the first numbered open item', l[:700]
    return 'item', 'no numbered open item: take the first gap of knowledge-map.md', None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skills', required=True)
    ap.add_argument('--log', default=os.path.join(ROOT, 'project-files', 'agent-log.md'))
    ap.add_argument('--today')
    a = ap.parse_args()
    today = datetime.strptime(a.today, '%Y-%m-%d').date() if a.today else datetime.now().date()
    try:
        rd = lambda p: open(p, encoding='utf-8').read()
        mode, why, item = decide(rd(os.path.join(a.skills, 'research-queue.md')), rd(os.path.join(a.skills, 'exam.md')), rd(a.log), today)
    except OSError as e:
        print('cannot read: %s' % e, file=sys.stderr)
        return 2
    print('mode: %s' % mode)
    print('why: %s' % why)
    if item:
        print('first_open: %s' % item)
    return 0


if __name__ == '__main__':
    sys.exit(main())
