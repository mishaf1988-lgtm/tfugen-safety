# .claude/skills/tfugen-lessons/SKILL.md stays usable (Michael, 01/10/2026):
# every lesson has its fields, a lesson that recurred is enforced in code or
# says why it cannot be, and the file stays short enough to be read.
import os, re, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'skills', 'tfugen-lessons', 'SKILL.md')
MAX = 14 * 1024
FIELDS = ('מה קרה:', 'הכלל:', 'נאכף:', 'חזר:')
HEAD = re.compile(r'^\*\*(\d+)\. .+ \((\d\d/\d\d/\d{4}|[^)]*\d\d/\d\d/\d{4}[^)]*)(, [^)]*)?\)\.\*\*$')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def lessons(text):
    out, cur = [], None
    for l in text.split('\n'):
        if l.startswith('**') and re.match(r'^\*\*\d+\. ', l):
            cur = {'head': l, 'lines': []}; out.append(cur)
        elif l.startswith('#'):
            cur = None
        elif cur is not None and l.strip():
            cur['lines'].append(l)
    return out

def problems(text):
    errs = []
    if len(text.encode('utf-8')) > MAX: errs.append('file is %d bytes, over %d: prune (rule 3)' % (len(text.encode('utf-8')), MAX))
    ls = lessons(text); nums = []
    if not ls: errs.append('no lessons found')
    for x in ls:
        m = HEAD.match(x['head'])
        if not m: errs.append('bad heading: ' + x['head'][:60]); continue
        n = int(m.group(1)); nums.append(n)
        got = {f: [l for l in x['lines'] if l.startswith(f)] for f in FIELDS}
        for f in FIELDS:
            if len(got[f]) != 1: errs.append('lesson %d: %s x%d' % (n, f, len(got[f])))
        if got['חזר:']:
            r = re.match(r'^חזר: (\d+)\b', got['חזר:'][0])
            if not r: errs.append('lesson %d: חזר is not a number' % n)
            elif int(r.group(1)) >= 1 and got['נאכף:']:
                e = got['נאכף:'][0]
                if e.startswith('נאכף: טקסט') and 'אין דרך בקוד' not in e:
                    errs.append('lesson %d recurred and is text only: add a hook/test or say why not (rule 2)' % n)
    if len(nums) != len(set(nums)): errs.append('duplicate lesson numbers')
    if nums and sorted(nums) != list(range(1, max(nums) + 1)): errs.append('lesson numbers have a gap: %s' % sorted(nums))
    return errs

real = open(P, encoding='utf-8').read()
check('the real file has no problems', problems(real) == [], problems(real))
check('the real file has lessons', len(lessons(real)) >= 10, len(lessons(real)))

ok = '**1. x (01/10/2026, #1).**\nמה קרה: a\nהכלל: b\nנאכף: טקסט בלבד.\nחזר: 0\n'
check('a valid lesson passes', problems(ok) == [], problems(ok))
check('missing field fails', problems(ok.replace('הכלל: b\n', '')) != [])
check('bad heading fails', problems(ok.replace('(01/10/2026, #1)', '(yesterday)')) != [])
check('recurred + text only fails', problems(ok.replace('חזר: 0', 'חזר: 1')) != [])
check('recurred + reason passes', problems(ok.replace('חזר: 0', 'חזר: 1').replace('טקסט בלבד.', 'טקסט (אין דרך בקוד: טקסט חופשי).')) == [])
check('recurred + hook passes', problems(ok.replace('חזר: 0', 'חזר: 2').replace('טקסט בלבד.', '`x.py` חוסם.')) == [])
check('non-number חזר fails', problems(ok.replace('חזר: 0', 'חזר: הרבה')) != [])
check('duplicate number fails', problems(ok + '\n' + ok) != [])
check('gap in numbers fails', problems(ok + '\n' + ok.replace('**1.', '**3.')) != [])
check('over the size cap fails', problems(ok + 'x' * MAX) != [])

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
