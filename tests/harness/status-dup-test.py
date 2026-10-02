# STATUS.md holds only open items (CLAUDE.md, lesson 15). 02/10/2026: the item
# "ייבוא יומי מ-Vitre מהשרת" sat open in STATUS while the archive already had it
# as [x], verified (ran 01/10/2026 06:00). A new session would have built it again.
# This test fails when an open item's bold title (up to the first " (") is found
# inside a [x] line of project-files/STATUS-archive.md.
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
S = os.path.join(ROOT, 'STATUS.md')
A = os.path.join(ROOT, 'project-files', 'STATUS-archive.md')
MIN = 13  # "יומן הנאמנים" is 12 characters and matches unrelated archive lines
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def title(line):
    m = re.search(r'\*\*(.+?)\*\*', line)
    if not m: return None
    t = re.sub(r'^[^\w֐-׿"«]+', '', m.group(1))  # leading emoji / symbols
    t = t.split(' (')[0].strip().rstrip('.:')
    return t if len(t) >= MIN else None

def duplicates(status, archive):
    done = [l for l in archive.split('\n') if re.match(r'^\s*- \[x\]', l)]
    out = []
    for l in status.split('\n'):
        if not re.match(r'^\s*- \[ \]', l): continue
        t = title(l)
        if t and any(t in d for d in done): out.append(t)
    return out

real = duplicates(open(S, encoding='utf-8').read(), open(A, encoding='utf-8').read())
check('no open STATUS item is already [x] in the archive', real == [], real)

arch = '- [x] **✅ רץ מ-01/10/2026 (אומת):** **🔄 ייבוא יומי מ-Vitre מהשרת (30/09/2026, מיכאל):** פרטים.\n- [x] **📗 יומן הנאמנים: תיקון אחר (29/09/2026).** x\n'
check('an open item whose title is [x] in the archive is caught',
      duplicates('- [ ] **ייבוא יומי מ-Vitre מהשרת (מיכאל 30/09/2026: «פעם ביום»):** היום רץ רק מהבית.\n', arch) == ['ייבוא יומי מ-Vitre מהשרת'])
check('an open item with a different title passes',
      duplicates('- [ ] **📗 יומן הנאמנים: שגיאת 409 שנשארה על המסך (30/09/2026).** x\n', arch) == [])
check('a short generic title is not matched',
      duplicates('- [ ] **יומן הנאמנים (30/09/2026).** x\n', arch) == [])
check('an item open in both files is not a duplicate (archive line is [ ])',
      duplicates('- [ ] **ייבוא יומי מ-Vitre מהשרת (30/09/2026).** x\n', arch.replace('[x] **✅', '[ ] **✅')) == [])
check('a [x] parent heading in STATUS is skipped',
      duplicates('- [x] **ייבוא יומי מ-Vitre מהשרת (30/09/2026).** x\n', arch) == [])
check('indented open items are checked too',
      duplicates('  - [ ] **ייבוא יומי מ-Vitre מהשרת (30/09/2026).** x\n', arch) == ['ייבוא יומי מ-Vitre מהשרת'])
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
