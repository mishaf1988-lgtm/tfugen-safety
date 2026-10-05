# .claude/skills/tfugen-lessons/SKILL.md stays usable (Michael, 01/10/2026):
# every lesson has its fields, a lesson that recurred is enforced in code or
# says why it cannot be, and the file stays short enough to be read.
# 02/10/2026: lessons already enforced in code move, as one line, to
# project-files/lessons-archive.md; the numbering is shared and continuous
# across both files, and the archive holds only one-line lessons with חזר: 0.
import os, re, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'skills', 'tfugen-lessons', 'SKILL.md')
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'project-files', 'lessons-archive.md')
MAX = 16 * 1024  # 14 until 05/10/2026 (Michael: "approve all"; the file sat 7 bytes under it)
FIELDS = ('מה קרה:', 'הכלל:', 'נאכף:', 'חזר:')
HEAD = re.compile(r'^\*\*(\d+)\. .+ \((\d\d/\d\d/\d{4}|[^)]*\d\d/\d\d/\d{4}[^)]*)(, [^)]*)?\)\.\*\*$')
# Rule 3 (02/10/2026): a lesson already enforced in code shrinks to one line:
# **N. title (date).** הכלל: ...; נאכף: `test`; חזר: 0
SHORT = re.compile(r'^\*\*(\d+)\. .+ \((\d\d/\d\d/\d{4}|[^)]*\d\d/\d\d/\d{4}[^)]*)(, [^)]*)?\)\.\*\* הכלל: .+; נאכף: `[^`]+`.*; חזר: (\d+)\b.*$')
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

def problems(text, archive=''):
    errs = []
    if len(text.encode('utf-8')) > MAX: errs.append('file is %d bytes, over %d: prune (rule 3)' % (len(text.encode('utf-8')), MAX))
    ls = lessons(text); nums = []
    if not ls: errs.append('no lessons found')
    for x in lessons(archive):
        s = SHORT.match(x['head'])
        if not s: errs.append('archive: not a one-line lesson enforced in code: ' + x['head'][:60]); continue
        nums.append(int(s.group(1)))
        if x['lines']: errs.append('archive lesson %s has a body' % s.group(1))
        if s.group(4) != '0': errs.append('archive lesson %s recurred (חזר: %s): move it back to the lessons file with a full body' % (s.group(1), s.group(4)))
    for x in ls:
        s = SHORT.match(x['head'])
        if s:
            nums.append(int(s.group(1)))
            if x['lines']: errs.append('lesson %s: a one-line lesson has no body' % s.group(1))
            continue
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
real_a = open(A, encoding='utf-8').read()
check('the real files have no problems', problems(real, real_a) == [], problems(real, real_a))
check('the real file has lessons', len(lessons(real)) >= 10, len(lessons(real)))
check('the archive has lessons', len(lessons(real_a)) >= 1, len(lessons(real_a)))
check('the archive alone has a gap (numbers are shared with the lessons file)', problems(real_a) != [])

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
short = '**1. x (01/10/2026, #1).** הכלל: b; נאכף: `x-test.js`; חזר: 0\n'
check('a one-line lesson enforced in code passes', problems(short) == [], problems(short))
check('a one-line lesson enforced by text only fails', problems(short.replace('`x-test.js`', 'טקסט')) != [])
check('a one-line lesson with a body fails', problems(short + 'מה קרה: a\n') != [])
check('a one-line lesson that recurred is still a lesson (number counted)', problems(short + '\n' + ok.replace('**1.', '**2.')) == [])
arch2 = short.replace('**1.', '**2.')
check('an archived one-line lesson fills the gap', problems(ok, arch2) == [], problems(ok, arch2))
check('the same number in both files fails', problems(ok, short) != [])
check('an archive number that leaves a gap fails', problems(ok, short.replace('**1.', '**3.')) != [])
check('an archive lesson with a body fails', problems(ok, arch2 + 'מה קרה: a\n') != [])
check('an archive lesson that recurred fails', problems(ok, arch2.replace('חזר: 0', 'חזר: 1')) != [])
check('an archive lesson enforced by text only fails', problems(ok, arch2.replace('`x-test.js`', 'טקסט')) != [])
check('a full-body lesson in the archive fails', problems(short, ok.replace('**1.', '**2.')) != [])

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
