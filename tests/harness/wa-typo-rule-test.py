#!/usr/bin/env python3
"""The WhatsApp assistant reads a near-miss word as a typo (31/10/2026: Michael wrote "מה בימן מחר?",
the assistant searched "בימן" as a name twice, also after "הכוונה ביומן"). The rule sits in
routine-wa-core.md, the file the live trigger reads, next to "לא ברור"."""
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

core = open(os.path.join(ROOT, 'project-files', 'routine-wa-core.md'), encoding='utf-8').read()
i = core.find('**שגיאת הקלדה**')
check('the typo rule is in routine-wa-core.md', i >= 0)
line = core[i:core.find('\n', i)] if i >= 0 else ''
check('it gives the case that happened (בימן / ביומן)', 'בימן' in line and 'ביומן' in line)
check('after a correction ("הכוונה X") the old word is not searched again', 'הכוונה' in line and 'לא מחפשים שוב' in line)
check('it sits right after "לא ברור", where the assistant decides what was asked',
      0 <= core.find('**לא ברור**') < i < core.find('**הבטחה או מעקב**'))
print(f'{passed} passed, {failed} failed')
raise SystemExit(1 if failed else 0)
