#!/usr/bin/env python3
"""The WhatsApp assistant picks which accident a request means before drafting (02/11/2026: Michael asked for an
investigation request about "the worker who hurt her hand", the assistant drafted on the 29/10 accident from a mail,
and Michael corrected: "the last accident in the table", 20/10). A judgment error the server cannot see in text, so
the rule sits in routine-wa-core.md (the file the live trigger reads), and in the full procedure and the accidents
procedure. The ordinary case must still pass without a question: a request with a date or a worker name."""
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
def read(*p): return open(os.path.join(ROOT, *p), encoding='utf-8').read()

for name in ('routine-wa-core.md', 'routine-wa-assistant.md'):
    s = read('project-files', name)
    i = s.find('**איזה אירוע**')
    check(name + ': the rule is there', i >= 0)
    line = s[i:s.find('\n', i)] if i >= 0 else ''
    check(name + ': reads the accidents table first, newest first', '"table":"inc"' in line and 'order=dt.desc' in line)
    check(name + ': shows Michael which one (date and description) before a draft', 'הבנתי: התאונה מ-DD/MM' in line and 'לפני כל טיוטה' in line)
    check(name + ': several events (also in one mail) = a question with choices', 'כמה אירועים' in line and '`choices`' in line)
    check(name + ': a date or a worker name passes without a question', 'תאריך או שם עובד מפורש' in line and 'בלי שאלה' in line)
    check(name + ': no long dash', '—' not in line)
core = read('project-files', 'routine-wa-core.md')
check('core: sits after the typo rule, before promises',
      0 <= core.find('**שגיאת הקלדה**') < core.find('**איזה אירוע**') < core.find('**הבטחה או מעקב**'))
acc = read('project-files', 'assistant', 'accidents.md')
check('accidents.md: lesson 16 points to the core rule', '16. **איזו תאונה**' in acc and 'איזה אירוע' in acc)
print(f'{passed} passed, {failed} failed')
raise SystemExit(1 if failed else 0)
