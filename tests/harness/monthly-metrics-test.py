# .github/scripts/monthly-metrics.py: the monthly learning metrics. Pure functions only, no network.
import datetime, importlib.util, os, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.github', 'scripts', 'monthly-metrics.py')
spec = importlib.util.spec_from_file_location('mm', P); mm = importlib.util.module_from_spec(spec); spec.loader.exec_module(mm)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

# rounds until green: the #1006 shape (three failures, then green) as GitHub returned it on 01/10/2026
check('#1006: failed first, 4 rounds', mm.rounds_until_green(['failure', 'failure', 'failure', 'success']) == (True, 4))
check('green on first try', mm.rounds_until_green(['success']) == (False, 1))
check('commits without a run are not rounds', mm.rounds_until_green([None, 'failure', None, 'success']) == (True, 2))
check('never green', mm.rounds_until_green(['failure', 'failure']) == (True, None))
check('no runs at all', mm.rounds_until_green([None]) == (False, None))

check('previous month of 01/10/2026 is 2026-09', mm.previous_month(datetime.date(2026, 10, 1)) == '2026-09')
check('previous month of January is December', mm.previous_month(datetime.date(2027, 1, 1)) == '2026-12')
s, e = mm.month_range('2026-12')
check('December ends on 01/01 next year', e == datetime.datetime(2027, 1, 1, tzinfo=datetime.timezone.utc) and s.month == 12)

check('retro "אין" found nothing', not mm.retro_found('x\nרטרו: אין'))
check('retro with text found something', mm.retro_found('רטרו: playwright שונה ב-GitHub'))
check('no retro line found nothing', not mm.retro_found('just text'))

LES = '''**1. a (01/10/2026, #994).**
חזר: 0
**2. b (30/09/2026).**
חזר: 2
**3. c (05/10/2026, #1020).**
חזר: 1
'''
check('lessons: new counts by month', mm.lesson_stats(LES, '2026-10')[0] == 2 and mm.lesson_stats(LES, '2026-09')[0] == 1, mm.lesson_stats(LES, '2026-10'))
check('lessons: recurred counts entries above 0', mm.lesson_stats(LES, '2026-10')[1] == 2)
real = open(mm.LESSONS, encoding='utf-8').read()
import re
heads = re.findall(r'^\*\*\d+\. .*$', real, re.M)
months = sorted({'%s-%s' % (d.group(2), d.group(1)) for d in (re.search(r'\b\d\d/(\d\d)/(\d{4})\b', h) for h in heads) if d})
check('the real lessons file: every lesson counted in some month', len(heads) >= 16 and sum(mm.lesson_stats(real, m)[0] for m in months) == len(heads), (len(heads), months))

prs = [
    {'number': 1006, 'title': 'Tests on GitHub', 'body': 'רטרו: שלושה הבדלי סביבה', 'conclusions': ['failure', 'failure', 'failure', 'success']},
    {'number': 1012, 'title': 'Lessons enforced', 'body': 'רטרו: אין', 'conclusions': ['success']},
    {'number': 1008, 'title': 'Fix: xlsm', 'body': '', 'conclusions': ['success', 'success']},
]
row, detail = mm.summarize(prs, LES, '2026-10')
cells = [c.strip() for c in row.split('|')[1:-1]]
check('row: month as MM/YYYY', cells[0] == '10/2026', cells)
check('row: 3 merged, 1 failed first (33%)', cells[1] == '3' and cells[2] == '1/3 (33%)', cells)
check('row: average rounds (4+1+1)/3 = 2.0', cells[3] == '2.0', cells)
check('row: 1 fix PR, 1 retro finding', cells[4] == '1' and cells[5] == '1', cells)
check('detail lists #1006 with 4 rounds', len(detail) == 1 and '#1006' in detail[0] and '4' in detail[0], detail)
row_old, _ = mm.summarize(prs + [{'number': 990, 'title': 'before tests existed', 'body': '', 'conclusions': [None, None]}], LES, '2026-10')
check('PRs from before `tests` existed are not in the percent', [c.strip() for c in row_old.split('|')[1:-1]][1:3] == ['4', '1/3 (33%)'], row_old)
check('empty month: no division by zero', mm.summarize([], '', '2026-11')[0].startswith('| 11/2026 | 0 | - | - |'))

now = datetime.datetime(2026, 11, 1, 5, 0, tzinfo=datetime.timezone.utc)
doc = mm.render('', row, detail, '2026-10', now)
check('render: header and row present', mm.HEADER in doc and row in doc)
check('render: Israel time DD/MM/YYYY (05:00 UTC = 07:00 in November)', '01/11/2026 07:00' in doc, doc[:400])
check('render: no long dash', '—' not in doc)
row9 = mm.summarize(prs[:1], LES, '2026-09')[0]
doc2 = mm.render(doc, row9, [], '2026-09', now)
check('render: second month added, newest first', doc2.index('| 10/2026') < doc2.index('| 09/2026'))
row10b = mm.summarize(prs[1:], LES, '2026-10')[0]
doc3 = mm.render(doc2, row10b, [], '2026-10', now)
check('render: same month replaced, not duplicated', doc3.count('| 10/2026') == 1 and row10b in doc3 and doc3.count('| 09/2026') == 1)
row12 = mm.summarize([], LES, '2026-12')[0]
row01 = mm.summarize([], LES, '2027-01')[0]
doc4 = mm.render(mm.render(doc3, row12, [], '2026-12', now), row01, [], '2027-01', now)
check('render: year boundary sorts 01/2027 before 12/2026', doc4.index('| 01/2027') < doc4.index('| 12/2026') < doc4.index('| 10/2026'))
check('render: detail block replaced, not appended', doc4.count(mm.DETAIL_START) == 1)

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
