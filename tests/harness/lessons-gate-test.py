# .github/scripts/lessons-gate.py: a fix PR must carry its lesson.
import importlib.util, os, subprocess, sys
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.github', 'scripts', 'lessons-gate.py')
spec = importlib.util.spec_from_file_location('gate', P); gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

L = gate.LESSONS
ok = lambda t, b, f: gate.check(t, b, f)[0]
check('not a fix PR: ok', ok('Tour screen: due date in one tap', '', ['index.html']))
check('Fix: without lesson: blocked', not ok('Fix: the xlsm opened as damaged', '', ['functions/hazard-file.js']))
check('fix lower case: blocked', not ok('fix rootHasR', '', ['x.js']))
check('Hebrew title: blocked', not ok('תיקון: הקובץ נפתח פגום', '', ['x.js']))
check('Hotfix: blocked', not ok('Hotfix login', '', ['x.js']))
check('"Fixture" is not a fix', ok('Fixtures for the harness', '', ['x.js']))
check('fix with the lessons file: ok', ok('Fix: x', '', ['x.js', L]))
check('fix with no-lesson reason: ok', ok('Fix: typo', 'Some text\nno-lesson: a typo in a comment, nothing to learn', ['x.js']))
check('fix with Hebrew waiver: ok', ok('Fix: typo', 'בלי לקח: שגיאת כתיב בהערה בלבד', ['x.js']))
check('waiver without a reason: blocked', not ok('Fix: typo', 'no-lesson:', ['x.js']))
check('waiver too short: blocked', not ok('Fix: typo', 'no-lesson: no', ['x.js']))
check('waiver inside a sentence does not count', not ok('Fix: x', 'we said no-lesson: maybe later on', ['x.js']))
check('None title/body: ok', ok(None, None, []))

# as the workflow calls it: env + stdin, exit code
def run(title, body, files):
    return subprocess.run([sys.executable, P], input='\n'.join(files), capture_output=True, text=True,
                          env=dict(os.environ, PR_TITLE=title, PR_BODY=body)).returncode
check('CLI: blocked exits 1', run('Fix: x', '', ['a.js']) == 1)
check('CLI: lesson exits 0', run('Fix: x', '', ['a.js', L]) == 0)
check('CLI: shell characters in title are just text', run('Fix: $(touch /tmp/pwned) `id`', '', [L]) == 0 and not os.path.exists('/tmp/pwned'))

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
