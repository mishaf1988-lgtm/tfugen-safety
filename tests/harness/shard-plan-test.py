#!/usr/bin/env python3
"""The CI shards (25/10/2026): .github/scripts/shard-plan.py splits the harness by measured time.
Every file runs in exactly one shard, the plan is the same on every runner, and no shard is
left with two slow suites while another is nearly empty (shard 0 had 158s, shard 6 had 37s)."""
import glob, importlib.util, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = os.path.join(HERE, '..', '..', '.github', 'scripts', 'shard-plan.py')
spec = importlib.util.spec_from_file_location('shard_plan', PLAN)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

passed = failed = 0
def check(label, ok, detail=''):
    global passed, failed
    if ok: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail)[:300] if detail != '' else ''))

files = sorted(os.path.basename(f) for g in ('*.js', '*.mjs', '*.py') for f in glob.glob(os.path.join(HERE, g)))
for n in (4, 8):
    out, load = m.plan(n, files)
    flat = [f for s in out for f in s]
    check('n=%d: every file in exactly one shard' % n, sorted(flat) == files and len(flat) == len(set(flat)), len(flat))
    heavy = max(m.SLOW.values())
    check('n=%d: the fullest shard is at most the slowest suite or 15%% over an even share' % n,
          max(load) <= max(heavy, sum(load) / n * 1.15) + 0.01, [round(x) for x in load])
    big = [f for f in m.SLOW if m.SLOW[f] >= 19 and f in files]
    where = [next(i for i, s in enumerate(out) if f in s) for f in big]
    check('n=%d: the suites of 19s and more are each in a shard of their own kind (no two together)' % n,
          n < len(big) or len(set(where)) == len(where), dict(zip(big, where)))
# the command line, as run.sh calls it: same files, same answer on every runner
a = subprocess.run([sys.executable, PLAN, '8', '3'] + files, capture_output=True, text=True).stdout
b = subprocess.run([sys.executable, PLAN, '8', '3'] + list(reversed(files)), capture_output=True, text=True).stdout
check('the plan does not depend on the order the files are listed in', a == b and a.strip() != '')
check('a bad shard number stops the run instead of running nothing', subprocess.run([sys.executable, PLAN, '8', '8', 'x.js'], capture_output=True).returncode != 0)
run_sh = open(os.path.join(HERE, 'run.sh'), encoding='utf-8').read()
check('run.sh takes its shard from shard-plan.py, not every n-th file', 'shard-plan.py' in run_sh and 'idx % ' not in run_sh and '% ${shard#*/}' not in run_sh)
print('shard-plan-test: %d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
