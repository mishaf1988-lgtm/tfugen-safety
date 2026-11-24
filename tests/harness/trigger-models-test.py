# tools/trigger-models.py (24/11/2026, Michael in the questionnaire: "do it: a checker for a trigger with no model"):
# a recurring trigger with an empty model runs on the expensive default; a one-shot reminder or a disabled one does not count.
import os, sys, importlib.util
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
spec = importlib.util.spec_from_file_location('tm', os.path.join(ROOT, 'tools', 'trigger-models.py'))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + repr(detail)[:300] if detail is not None else ''))

reg = {'agents': [
    {'id': 'a', 'enabled': True, 'cron': '0 8 * * *', 'model': ''},
    {'id': 'b', 'enabled': True, 'cron': '0 8 * * *', 'model': 'claude-sonnet-5-5'},
    {'id': 'c', 'enabled': False, 'cron': '0 8 * * *', 'model': ''},
    {'id': 'd', 'enabled': True, 'cron': '', 'model': ''},
    {'id': 'e', 'enabled': True, 'cron': '0 8 * * *'},
    {'id': 'f', 'enabled': True, 'cron': '0 8 * * *', 'model': '  '},
    {'id': 'g', 'enabled': True, 'cron': '0 8 * * *', 'model': '', 'persistent': True},
]}
check('a trigger in a standing session is skipped (the session model applies)', 'g' not in [a['id'] for a in tm.missing(reg)])
check('only enabled recurring triggers with an empty or missing model', [a['id'] for a in tm.missing(reg)] == ['a', 'e', 'f'], tm.missing(reg))
check('an empty registry gives nothing', tm.missing({}) == [])
from datetime import datetime, timezone
now = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
check('age in days', abs(tm.age_days('2026-11-22T12:00:00.000Z', now) - 2.0) < 1e-6)
check('no date gives None', tm.age_days('', now) is None)
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
