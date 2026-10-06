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
R = ['.claude/skills/tfugen-lessons/SKILL.md']
RD = '.claude/skills/tfugen-lessons/'
G365 = 'project-files/claude-ai-skill/m365-guard/'
check('repo skills: the changed ones, each once, after the assistant', g.skill_dirs(R + ['.claude/skills/tfugen-lessons/x.md', '.claude/skills/tfugen-db/SKILL.md', 'index.html']) == [(g.DIR, True), (G365, True), (RD, False), ('.claude/skills/tfugen-db/', False)])
check('m365-guard (06/10/2026): changed without a version line fails, like the assistant', g.problem([G365 + 'SKILL.md'], 'גרסה: 06/10/2026 (1)', 'no line', G365, True) is not None and g.problem([G365 + 'SKILL.md'], 'גרסה: 06/10/2026 (1)', 'גרסה: 06/10/2026 (1)', G365, True) is not None and g.problem([G365 + 'SKILL.md'], 'גרסה: 06/10/2026 (1)', 'גרסה: 06/10/2026 (2)', G365, True) is None)
check('repo skill without a version line on either side: ok (opt-in)', g.problem(R, 'no line', 'no line', RD, False) is None)
check('repo skill with a line, same number as main: fails', g.problem(R, V('04/10/2026', 2), V('04/10/2026', 2), RD, False) is not None)
check('repo skill with a line, next number: ok', g.problem(R, V('04/10/2026', 2), V('04/10/2026', 3), RD, False) is None)
check('repo skill gets its first line: ok', g.problem(R, 'no line', V('04/10/2026', 1), RD, False) is None)
check('repo skill loses its line: fails', g.problem(R, V('04/10/2026', 2), 'no line', RD, False) is not None)
check('another skill changed, this one not: ok', g.problem(['.claude/skills/tfugen-db/SKILL.md'], V('04/10/2026', 2), V('04/10/2026', 2), RD, False) is None)
d = '+++ b/tests/harness/a-test.js\n+  await p.waitForTimeout(400);\n+  await p.waitForTimeout(1200);\n-  await p.waitForTimeout(100);\n+++ b/tests/harness/b-test.js\n   await p.waitForTimeout(200);'
check('short wait: only added lines up to 500 ms, with the file', w.short_waits(d) == [('tests/harness/a-test.js', 400)], w.short_waits(d))
# The real repo: this PR bumps the assistant above main.
cur = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'project-files/claude-ai-skill/michael-assistant/SKILL.md'), encoding='utf-8').read()
check('the repo assistant has a version line', g.ver(cur) is not None)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
