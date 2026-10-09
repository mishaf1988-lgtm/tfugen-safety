# A Routine id that one file marks as deleted must not be named as live anywhere.
# 09/10/2026 (#1263, #1274): the quotes trigger was replaced; routine-quotes.md said
# "הישן ... נמחק", while STATUS.md still named the old id as the running Routine.
# The same scan found routine-compliance.md naming a deleted id too.
# Deleted = "`trig_X` נמחק" right after the id, or "הישן" just before it and
# "נמחק" later in the same clause with no other trig_ id in between.
import glob, os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ID = re.compile(r'trig_[0-9A-Za-z]{20,}')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def mentions(text):
    out = []
    ms = list(ID.finditer(text))
    for i, m in enumerate(ms):
        before = text[max(0, m.start() - 30):m.start()]
        end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
        after = text[m.end():min(end, m.end() + 90)].split('\n')[0]
        dead = bool(re.match(r'`?\)?\s*נמחק', after)) or ('הישן' in before and 'נמחק' in after)
        out.append((m.group(), dead))
    return out

def stale(files):
    """files: {name: text}. Returns [(id, name)] for live mentions of a deleted id."""
    found = {n: mentions(t) for n, t in files.items()}
    deleted = {i for ms in found.values() for i, d in ms if d}
    return sorted({(i, n) for n, ms in found.items() for i, d in ms if not d and i in deleted})

paths = [os.path.join(ROOT, 'STATUS.md')] + sorted(glob.glob(os.path.join(ROOT, 'project-files', 'routine-*.md')))
real = stale({os.path.relpath(p, ROOT): open(p, encoding='utf-8').read() for p in paths})
check('no deleted Routine id is named as live in STATUS.md or routine-*.md', real == [], real)

A, B = 'trig_01SGfUDNANbo4ecjCdCGTZV2', 'trig_01SogHpEgS3nkMoworDxmfTh'
check('the #1274 case is caught (old id live in STATUS, deleted in the routine file)',
      stale({'S': 'ה-Routine הוקם ואומת (`%s`, #1257).' % A,
             'R': 'חדש `%s`. הטריגר הישן `%s` (שיחה `session_x`) נמחק.' % (B, A)}) == [(A, 'S')])
check('"`id` נמחק" marks the id deleted',
      stale({'S': '`%s` נמחק, בלי חובת אישור.' % A, 'R': 'פעיל: `%s`.' % A}) == [(A, 'R')])
check('"הישן (`id`, ...) נמחק" marks the id deleted',
      stale({'S': 'הישן (`%s`, קרא Excel) נמחק.' % A, 'R': '**ה-Routine:** `%s`, ב-1 לחודש.' % A}) == [(A, 'R')])
check('a new id next to "והישן `old` נמחק" stays live',
      stale({'S': 'הוקם מחדש (`%s`, #1263; והישן `%s` נמחק).' % (B, A)}) == [])
check('"הישנים נמחקו" after a list of new ids does not delete them',
      stale({'S': 'נבו `%s` (3). הישנים נמחקו.' % B, 'R': '`%s` פעיל.' % B}) == [])
check('an id only ever named as deleted passes',
      stale({'S': '`%s` נמחק.' % A, 'R': 'הטריגר הישן `%s` נמחק.' % A}) == [])
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
