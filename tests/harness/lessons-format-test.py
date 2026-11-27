# .claude/skills/tfugen-lessons/SKILL.md stays usable (Michael, 01/10/2026):
# every lesson has its fields, a lesson that recurred is enforced in code or
# says why it cannot be, and the file stays short enough to be read.
# 02/10/2026: lessons already enforced in code move, as one line, to
# project-files/lessons-archive.md; the numbering is shared and continuous
# across both files, and the archive holds only one-line lessons with חזר: 0.
# Since 07/10/2026 (Michael, questionnaire: "3 old lessons to the archive") also a lesson
# enforced in text only that never recurred, so the 16KB file has room.
# Since 11/10/2026 (Michael: "a few lesson files, each in its own field") a lesson of one
# field lives in that field's skill, under DOMAIN_MARK, same format and shared numbering.
import glob, os, re, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'skills', 'tfugen-lessons', 'SKILL.md')
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'project-files', 'lessons-archive.md')
DOMAIN_MARK = '## לקחים בתחום'
SKILLS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'skills')
MAX = 16 * 1024  # 14 until 05/10/2026 (Michael: "approve all"; the file sat 7 bytes under it)
FIELDS = ('מה קרה:', 'הכלל:', 'נאכף:', 'חזר:')
HEAD = re.compile(r'^\*\*(\d+)\. .+ \((\d\d/\d\d/\d{4}|[^)]*\d\d/\d\d/\d{4}[^)]*)(, [^)]*)?\)\.\*\*$')
# Rule 3 (02/10/2026): a lesson already enforced in code shrinks to one line:
# **N. title (date).** הכלל: ...; נאכף: `test`; חזר: 0
SHORT = re.compile(r'^\*\*(\d+)\. .+ \((\d\d/\d\d/\d{4}|[^)]*\d\d/\d\d/\d{4}[^)]*)(, [^)]*)?\)\.\*\* הכלל: .+; נאכף: (?:`[^`]+`|טקסט).*; חזר: (\d+)\b.*$')
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

def domain_part(text):
    i = text.find(DOMAIN_MARK)
    return text[i:] if i >= 0 else ''

def problems(text, archive='', domain='', gaps=True):
    errs = []
    if domain and not lessons(domain): errs.append('a domain lessons section with no lessons')
    if len(text.encode('utf-8')) > MAX: errs.append('file is %d bytes, over %d: prune (rule 3)' % (len(text.encode('utf-8')), MAX))
    ls = lessons(text); nums = []
    if not ls: errs.append('no lessons found')
    for x in lessons(archive):
        s = SHORT.match(x['head'])
        if not s: errs.append('archive: not a one-line lesson (נאכף: `code` or טקסט): ' + x['head'][:60]); continue
        nums.append(int(s.group(1)))
        if x['lines']: errs.append('archive lesson %s has a body' % s.group(1))
        if s.group(4) != '0': errs.append('archive lesson %s recurred (חזר: %s): move it back to the lessons file with a full body' % (s.group(1), s.group(4)))
    for x in ls + lessons(domain):
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
    # gaps=False for the real files: number_problems checks gaps over both forms (a retro bullet fills a number too)
    if gaps and nums and sorted(nums) != list(range(1, max(nums) + 1)): errs.append('lesson numbers have a gap: %s' % sorted(nums))
    return errs

# 27/11/2026 (Michael, retro 23/11/2026 item 1): a lesson number is unique across ALL lesson files, in both
# forms: "**N. title**" and the retro bullet "- **N. title**". Until now only the first form was counted, so
# 65 numbers (171-248) were used twice, and "lesson 210" in a test could mean two different lessons.
NUM = re.compile(r'^(?:- )?\*\*(\d+)\. ')
def all_numbers(texts):
    """texts: {label: text}. Returns {number: [label:line, ...]} over both forms."""
    out = {}
    for label, text in texts.items():
        for i, l in enumerate(text.split('\n'), 1):
            m = NUM.match(l)
            if m: out.setdefault(int(m.group(1)), []).append('%s:%d' % (label, i))
    return out

def number_problems(texts):
    nums = all_numbers(texts); errs = []
    dup = {n: w for n, w in sorted(nums.items()) if len(w) > 1}
    if dup: errs.append('duplicate lesson numbers (both forms, all files): ' + '; '.join('%d at %s' % (n, ', '.join(w)) for n, w in dup.items()))
    if nums and sorted(nums) != list(range(1, max(nums) + 1)):
        errs.append('lesson numbers have a gap: %s' % [n for n in range(1, max(nums) + 1) if n not in nums])
    return errs

def lesson_files():
    """Every lesson file: tfugen-lessons/SKILL.md and the archive whole; the domain section of any other skill's SKILL.md or references/*.md."""
    root = os.path.join(SKILLS, '..', '..')
    t = {os.path.relpath(P, root): open(P, encoding='utf-8').read(), os.path.relpath(A, root): open(A, encoding='utf-8').read()}
    for f in sorted(glob.glob(os.path.join(SKILLS, '*', 'SKILL.md')) + glob.glob(os.path.join(SKILLS, '*', 'references', '*.md'))):
        if os.path.abspath(f) == os.path.abspath(P): continue
        body = open(f, encoding='utf-8').read()
        i = body.find(DOMAIN_MARK)
        if i >= 0: t[os.path.relpath(f, root)] = '\n' * body[:i].count('\n') + body[i:]  # keep real line numbers
    return t

real = open(P, encoding='utf-8').read()
real_a = open(A, encoding='utf-8').read()
real_d = {f: domain_part(open(f, encoding='utf-8').read()) for f in sorted(glob.glob(os.path.join(SKILLS, '*', 'SKILL.md')) + glob.glob(os.path.join(SKILLS, '*', 'references', '*.md'))) if os.path.abspath(f) != os.path.abspath(P)}
real_d = {f: t for f, t in real_d.items() if t}
real_dt = '\n'.join(real_d.values())
check('the real files have no problems', problems(real, real_a, real_dt, gaps=False) == [], problems(real, real_a, real_dt, gaps=False))
check('domain lessons live in tfugen-dev (references/lessons.md, from 27/10/2026) and tfugen-db (references/lessons.md, from 28/10/2026)', sorted(os.path.relpath(f, SKILLS) for f in real_d if 'tfugen-dev' in f or 'tfugen-db' in f) == ['tfugen-db/references/lessons.md', 'tfugen-dev/references/lessons.md'], list(real_d))
real_t = lesson_files()
check('every lesson number is unique across all lesson files, in both forms (27/11/2026)', number_problems(real_t) == [], number_problems(real_t))
check('the lesson files read include the archive, tfugen-dev and tfugen-db', all(any(k.endswith(s) for k in real_t) for s in ('lessons-archive.md', 'tfugen-dev/references/lessons.md', 'tfugen-db/references/lessons.md')), list(real_t))
check('the real files have retro bullets too (the form that was missed)', any(re.match(r'^- \*\*\d+\. ', l) for t in real_t.values() for l in t.split('\n')))
check('a bullet "- **N." that repeats a "**N." elsewhere fails', number_problems({'a': '**1. x**', 'b': '- **1. y**'}) != [])
check('two bullets with one number in one file fail', number_problems({'a': '- **1. x**\n- **1. y**'}) != [])
check('distinct numbers in both forms pass', number_problems({'a': '**1. x**', 'b': '- **2. y**'}) == [], number_problems({'a': '**1. x**', 'b': '- **2. y**'}))
check('a gap across both forms fails', number_problems({'a': '**1. x**', 'b': '- **3. y**'}) != [])
check('a bold numbered line that is not at the line start is not a lesson', number_problems({'a': '**1. x**', 'b': 'see **1. x**'}) == [])
check('the duplicate message names both places', '1 at a:1, b:2' in ' '.join(number_problems({'a': '**1. x**', 'b': '\n- **1. y**'})), number_problems({'a': '**1. x**', 'b': '\n- **1. y**'}))
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
check('a one-line lesson enforced by text that never recurred passes (07/10/2026)', problems(short.replace('`x-test.js`', 'טקסט בלבד')) == [], problems(short.replace('`x-test.js`', 'טקסט בלבד')))
check('...but not with no enforcement at all', problems(short.replace('`x-test.js`', 'כלום')) != [])
check('a one-line lesson with a body fails', problems(short + 'מה קרה: a\n') != [])
check('a one-line lesson that recurred is still a lesson (number counted)', problems(short + '\n' + ok.replace('**1.', '**2.')) == [])
arch2 = short.replace('**1.', '**2.')
check('an archived one-line lesson fills the gap', problems(ok, arch2) == [], problems(ok, arch2))
check('the same number in both files fails', problems(ok, short) != [])
check('an archive number that leaves a gap fails', problems(ok, short.replace('**1.', '**3.')) != [])
check('an archive lesson with a body fails', problems(ok, arch2 + 'מה קרה: a\n') != [])
check('an archive lesson that recurred fails', problems(ok, arch2.replace('חזר: 0', 'חזר: 1')) != [])
check('an archive lesson enforced by text that never recurred passes (07/10/2026)', problems(ok, arch2.replace('`x-test.js`', 'טקסט בלבד')) == [], problems(ok, arch2.replace('`x-test.js`', 'טקסט בלבד')))
check('...and one enforced by text that recurred fails', problems(ok, arch2.replace('`x-test.js`', 'טקסט בלבד').replace('חזר: 0', 'חזר: 1')) != [])
check('a full-body lesson in the archive fails', problems(short, ok.replace('**1.', '**2.')) != [])

dom = DOMAIN_MARK + '\n\n' + ok.replace('**1.', '**2.')
check('a domain lesson fills the gap (11/10/2026)', problems(ok, '', dom) == [], problems(ok, '', dom))
check('a domain lesson missing a field fails', problems(ok, '', dom.replace('הכלל: b\n', '')) != [])
check('the same number in the lessons file and a domain file fails', problems(ok, '', DOMAIN_MARK + '\n\n' + ok) != [])
check('a lesson moved out without its domain copy leaves a gap', problems(ok + '\n' + ok.replace('**1.', '**3.')) != [])
check('the domain text does not count toward the 16KB cap', problems(ok, '', dom + 'x' * MAX) == [])
check('domain_part keeps only the section', domain_part('# a\n**1. x (01/10/2026).**\n' + DOMAIN_MARK + '\nz') == DOMAIN_MARK + '\nz')

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
