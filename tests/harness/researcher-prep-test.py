# tools/researcher-prep.py (25/11/2026, Michael in the questionnaire: "do it: one action for the assistant's researcher"):
# the day's mode in one call, from the same sources as steps 1, 1a, 1b, 1c of routine-researcher.md.
import os, sys, importlib.util, subprocess, tempfile
from datetime import date
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
spec = importlib.util.spec_from_file_location('rp', os.path.join(ROOT, 'tools', 'researcher-prep.py'))
rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + repr(detail)[:300] if detail is not None else ''))

M, S, E = rp.W_MONTHLY, rp.W_SCOUT, rp.W_EVENT
QUEUE = '# q\n\n## פתוח\n### מהמפה\n1. **ראשון:** פריט ראשון\n2. **שני:** פריט שני\n\n## פעם בחודש\nx\n\n## נסגר\n- 20/11/2026, %s: נעשה\n- 10/10/2026, משהו\n' % M
EXAM = '## תוצאות\n| חודש | ציון |\n|---|---|\n| 11/2026 (04/11/2026) | 75 |\n'
LOG = '18/11/2026 | routine-researcher | %s 18/11: שיטה\n05/11/2026 | routine-researcher | אירוע מה%s: משהו\n' % (S, E)
today = date(2026, 11, 24)
check('everything done this month and week: the first open item', rp.decide(QUEUE, EXAM, LOG, today)[0:2] == ('item', 'the first numbered open item') and rp.decide(QUEUE, EXAM, LOG, today)[2].startswith('1. '), rp.decide(QUEUE, EXAM, LOG, today))
check('no monthly line this month gives monthly first', rp.decide(QUEUE.replace('20/11/2026', '20/10/2026'), EXAM, LOG, today)[0] == 'monthly')
check('a scout 7 days ago or more is due again, 6 days ago is not', rp.decide(QUEUE, EXAM, LOG, date(2026, 11, 25))[0] == 'scout' and rp.decide(QUEUE, EXAM, LOG, date(2026, 11, 24))[0] == 'item')
check('no branch event this month gives event', rp.decide(QUEUE, EXAM, LOG.replace('05/11/2026', '05/10/2026'), today)[0] == 'event')
check('no exam row this month gives exam', rp.decide(QUEUE, EXAM.replace('11/2026', '10/2026'), LOG, today)[0] == 'exam')
check('a line of another agent does not count as a scout', rp.decide(QUEUE, EXAM, LOG.replace('routine-researcher', 'routine-quality'), date(2026, 11, 24))[0] == 'scout')
check('priority: monthly before scout', rp.decide(QUEUE.replace('20/11/2026', '20/10/2026'), EXAM, '', today)[0] == 'monthly')
check('the open item is cut to 700 characters', len(rp.decide(QUEUE.replace('פריט ראשון', 'x' * 2000), EXAM, LOG, today)[2]) == 700)
with tempfile.TemporaryDirectory() as t:
    open(os.path.join(t, 'research-queue.md'), 'w', encoding='utf-8').write(QUEUE)
    open(os.path.join(t, 'exam.md'), 'w', encoding='utf-8').write(EXAM)
    lg = os.path.join(t, 'log.md'); open(lg, 'w', encoding='utf-8').write(LOG)
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'researcher-prep.py'), '--skills', t, '--log', lg, '--today', '2026-11-24'], capture_output=True, text=True)
    check('the script prints mode, why and the open item, exit 0', r.returncode == 0 and 'mode: item' in r.stdout and 'first_open: 1. ' in r.stdout, (r.returncode, r.stdout, r.stderr))
    r2 = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'researcher-prep.py'), '--skills', os.path.join(t, 'nope'), '--log', lg], capture_output=True, text=True)
    check('a missing file gives exit 2', r2.returncode == 2, (r2.returncode, r2.stderr))
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
