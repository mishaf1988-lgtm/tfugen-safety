# tools/retro-prep.py (25/11/2026, Michael in the questionnaire: "do it: one action for the daily retro"): the retro's git work
# in one call, the diff in a file and never printed. Runs against a throw-away repo.
import os, subprocess, sys, tempfile, importlib.util
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
spec = importlib.util.spec_from_file_location('rp', os.path.join(ROOT, 'tools', 'retro-prep.py'))
rp = importlib.util.module_from_spec(spec); spec.loader.exec_module(rp)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + repr(detail)[:300] if detail is not None else ''))
def sh(cwd, *a):
    return subprocess.run(a, cwd=cwd, capture_output=True, text=True, check=True).stdout

from datetime import datetime
from zoneinfo import ZoneInfo
check('Sunday looks back 3 days', rp.window_days(datetime(2026, 11, 22, 8, 0, tzinfo=ZoneInfo('Asia/Jerusalem'))) == 3)
check('a weekday looks back 1 day', rp.window_days(datetime(2026, 11, 24, 8, 0, tzinfo=ZoneInfo('Asia/Jerusalem'))) == 1)

with tempfile.TemporaryDirectory() as t:
    origin = os.path.join(t, 'o.git'); work = os.path.join(t, 'w')
    sh(t, 'git', 'init', '-q', '--bare', '-b', 'main', origin)
    sh(t, 'git', 'clone', '-q', origin, work)
    for k, v in (('user.email', 'a@b.c'), ('user.name', 'x')): sh(work, 'git', 'config', k, v)
    def commit(name, text, msg):
        os.makedirs(os.path.dirname(os.path.join(work, name)) or work, exist_ok=True)
        open(os.path.join(work, name), 'a', encoding='utf-8').write(text)
        sh(work, 'git', 'add', '-A'); sh(work, 'git', 'commit', '-q', '-m', msg)
    commit('a.txt', 'one\n', 'first')
    commit('index.html', '<p>HUGE-HTML-BODY</p>\n' * 50, 'page change')
    commit('m.txt', 'x\n', 'Monthly metrics 2026-11')
    sh(work, 'git', 'push', '-q', 'origin', 'HEAD:main')
    out = os.path.join(t, 'bundle.md')
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'retro-prep.py'), '--repo', work, '--out', out, '--days', '1'], capture_output=True, text=True)
    check('exit 0 and the path is printed, not the diff', r.returncode == 0 and out in r.stdout and 'HUGE-HTML-BODY' not in r.stdout, (r.returncode, r.stdout, r.stderr))
    b = open(out, encoding='utf-8').read()
    check('two commits listed, Monthly metrics left out', '2 commits' in r.stdout and 'Monthly metrics' not in b, r.stdout)
    check('index.html appears as a stat line only', 'HUGE-HTML-BODY' not in b and '[index.html changed:' in b, b[:400])
    check('a normal file shows its hunk', '+one' in b)
    check('it ends on the retro-work branch at origin/main', sh(work, 'git', 'rev-parse', '--abbrev-ref', 'HEAD').strip() == 'retro-work')
    open(os.path.join(work, 'dirty.txt'), 'w').write('wip')
    r2 = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'retro-prep.py'), '--repo', work, '--out', out, '--days', '1'], capture_output=True, text=True)
    check('a dirty tree is stashed and said so', 'stashed' in r2.stdout and not os.path.exists(os.path.join(work, 'dirty.txt')), r2.stdout)
    o2 = os.path.join(t, 'o2.git'); w2 = os.path.join(t, 'w2')
    sh(t, 'git', 'init', '-q', '--bare', '-b', 'main', o2); sh(t, 'git', 'clone', '-q', o2, w2)
    for k, v in (('user.email', 'a@b.c'), ('user.name', 'x')): sh(w2, 'git', 'config', k, v)
    open(os.path.join(w2, 'm.txt'), 'w').write('x'); sh(w2, 'git', 'add', '-A'); sh(w2, 'git', 'commit', '-q', '-m', 'Monthly metrics 2026-11'); sh(w2, 'git', 'push', '-q', 'origin', 'HEAD:main')
    r3 = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'retro-prep.py'), '--repo', w2, '--out', out, '--days', '1'], capture_output=True, text=True)
    check('only Monthly metrics in the window gives exit 2', r3.returncode == 2 and 'nothing new' in r3.stdout, (r3.returncode, r3.stdout))
    r4 = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'retro-prep.py'), '--repo', os.path.join(t, 'nope')], capture_output=True, text=True)
    check('a git failure gives exit 4', r4.returncode == 4, (r4.returncode, r4.stderr))
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
