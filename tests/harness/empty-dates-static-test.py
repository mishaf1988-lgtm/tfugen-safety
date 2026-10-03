# CLAUDE.md rule 2 on every date field, not only the four forms empty-dates-test.js
# opens (Michael, 03/10/2026: "approve", on extending it). For each input with
# type="date" in index.html (47 on 03/10/2026, HTML and HTML inside JS strings),
# a record key filled straight from it, key:gv('id') with no ||null after it,
# sends '' when the date is left empty. A date column rejects '' (the whole save
# fails silently in the outbox), a text column stores it and breaks du()/eb().
# ALLOW: a field the save refuses when empty, so '' never leaves; each with why.
import os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ALLOW = {}  # 'input-id': 'why it is safe'
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def date_ids(s):
    return set(re.findall(r'<input[^>]*type="date"[^>]*id="([^"]+)"', s)) | set(re.findall(r'<input[^>]*id="([^"]+)"[^>]*type="date"', s))

def bare(s, ids):
    out = []
    for i in sorted(ids):
        if i in ALLOW: continue
        for m in re.finditer(r"([A-Za-z_0-9]+):gv\('" + re.escape(i) + r"'\)(?!\s*\|\|)", s):
            out.append('%s:gv(%s) line %d' % (m.group(1), i, s.count('\n', 0, m.start()) + 1))
    return out

T = '<input type="date" id="a-d"><input id="b-d" type="date"><input type="text" id="c">'
check('finds date inputs in both attribute orders, not text inputs', date_ids(T) == {'a-d', 'b-d'}, date_ids(T))
check('bare key:gv(id) is flagged', len(bare("r={d:gv('a-d'),n:gv('c')}", {'a-d'})) == 1)
check('gv(id)||null passes', bare("r={d:gv('a-d')||null}", {'a-d'}) == [])
s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
ids = date_ids(s)
check('index.html has date inputs (%d)' % len(ids), len(ids) >= 40, len(ids))
b = bare(s, ids)
check('no date field is saved straight from gv() without ||null', b == [], b)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
