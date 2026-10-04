# .github/scripts/skill-version-gate.py and short-wait-warn.py (04/10/2026).
import importlib.util, os, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.github', 'scripts')
def load(n):
    spec = importlib.util.spec_from_file_location(n.replace('-', '_'), os.path.join(D, n + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
g, w = load('skill-version-gate'), load('short-wait-warn')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

V = lambda d, n: 'גרסה: %s (%d). x' % (d, n)
F = ['project-files/claude-ai-skill/michael-assistant/references/lessons.md']
check('the version line is read', g.ver(V('04/10/2026', 6)) == (2026, 10, 4, 6))
check('assistant untouched: ok', g.problem(['index.html'], V('04/10/2026', 6), V('04/10/2026', 6)) is None)
check('changed, same number as main: fails (two parallel (5))', g.problem(F, V('04/10/2026', 5), V('04/10/2026', 5)) is not None)
check('changed, lower: fails', g.problem(F, V('04/10/2026', 6), V('04/10/2026', 5)) is not None)
check('changed, next number: ok', g.problem(F, V('04/10/2026', 6), V('04/10/2026', 7)) is None)
check('changed, a later date with (1): ok', g.problem(F, V('04/10/2026', 6), V('05/10/2026', 1)) is None)
check('changed, an earlier date with a big number: fails', g.problem(F, V('04/10/2026', 6), V('03/10/2026', 9)) is not None)
check('version line removed: fails', g.problem(F, V('04/10/2026', 6), 'no line') is not None)
check('new assistant (nothing on main): ok', g.problem(F, '', V('04/10/2026', 1)) is None)
d = '+++ b/tests/harness/a-test.js\n+  await p.waitForTimeout(400);\n+  await p.waitForTimeout(1200);\n-  await p.waitForTimeout(100);\n+++ b/tests/harness/b-test.js\n   await p.waitForTimeout(200);'
check('short wait: only added lines up to 500 ms, with the file', w.short_waits(d) == [('tests/harness/a-test.js', 400)], w.short_waits(d))
# The real repo: this PR bumps the assistant above main.
cur = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'project-files/claude-ai-skill/michael-assistant/SKILL.md'), encoding='utf-8').read()
check('the repo assistant has a version line', g.ver(cur) is not None)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
