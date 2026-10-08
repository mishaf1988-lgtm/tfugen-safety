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
R = 'רטרו: אין\nskill: אין\n'
ok = lambda t, b, f: gate.check(t, R + (b or ''), f)[0]
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
check('None title: ok', ok(None, None, []))

# retro line, on every PR
raw = lambda t, b, f: gate.check(t, b, f)[0]
check('no retro line: blocked', not raw('Tour screen', 'some text', ['index.html']))
check('None body: blocked (no retro)', not raw(None, None, []))
check('retro none (Hebrew): ok', raw('Tour screen', 'text\nרטרו: אין\nskill: אין', ['index.html']))
check('retro none (English): ok', raw('Tour screen', 'retro: none\nskill: אין', ['index.html']))
check('retro with a finding: ok', raw('Tour screen', 'רטרו: מיכאל אמר שהכפתור לא במקום\nskill: אין', ['index.html']))
check('empty retro: blocked', not raw('Tour screen', 'רטרו:   ', ['index.html']))
check('retro inside a sentence does not count', not raw('Tour screen', 'we skipped the retro: later', ['x']))
check('retro does not replace the lesson on a fix PR', not raw('Fix: x', 'רטרו: אין', ['x.js']))
check('RETRO_NONE: "אין." is none', gate.RETRO_NONE.match('אין.') is not None)
check('RETRO_NONE: a finding is not none', gate.RETRO_NONE.match('אין בדיקה לזה') is None)

# as the workflow calls it: env + stdin, exit code
def run(title, body, files):
    return subprocess.run([sys.executable, P], input='\n'.join(files), capture_output=True, text=True,
                          env=dict(os.environ, PR_TITLE=title, PR_BODY=R + body)).returncode
check('CLI: blocked exits 1', run('Fix: x', '', ['a.js']) == 1)
check('CLI: lesson exits 0', run('Fix: x', '', ['a.js', L]) == 0)
check('CLI: shell characters in title are just text', run('Fix: $(touch /tmp/pwned) `id`', '', [L]) == 0 and not os.path.exists('/tmp/pwned'))

# skill line, on every PR (02/10/2026)
S = '.claude/skills/tfugen-db/SKILL.md'
check('no skill line: blocked', not raw('Tour screen', 'רטרו: אין', ['index.html']))
check('skill none: ok', raw('Tour screen', 'רטרו: אין\nskill: אין', ['index.html']))
check('Hebrew label: ok', raw('Tour screen', 'רטרו: אין\nסקייל: אין', ['index.html']))
check('skill named but no skill file changed: blocked', not raw('Tour screen', 'רטרו: אין\nskill: tfugen-db, איך מריצים migration', ['index.html']))
check('skill named with a skill file: ok', raw('Tour screen', 'רטרו: אין\nskill: tfugen-db, איך מריצים migration', ['index.html', S]))
check('the account skill counts too', raw('Tour screen', 'רטרו: אין\nskill: כלל כללי', ['project-files/claude-ai-skill/michael-work-lessons/SKILL.md']))
check('a skill learned in michael-skills counts with its PR (07/10/2026)', raw('Tour screen', 'רטרו: אין\nskill: העוזר, כלל 44, michael-skills#3', ['index.html']))
check('...naming michael-skills without a PR number does not', not raw('Tour screen', 'רטרו: אין\nskill: העוזר ב-michael-skills', ['index.html']))
check('...or with the commit pushed straight to main (08/10/2026)', raw('Tour screen', 'רטרו: אין\nskill: העוזר, כלל 46, michael-skills@6cee732', ['index.html']))
check('...a short or non-hex sha does not', not raw('Tour screen', 'רטרו: אין\nskill: העוזר, michael-skills@main', ['index.html']))
check('a file merely named skills elsewhere does not count', not raw('Tour screen', 'רטרו: אין\nskill: משהו', ['docs/.claude/skills/x.md']))
check('empty skill line: blocked', not raw('Tour screen', 'רטרו: אין\nskill:   ', ['index.html']))
check('skill inside a sentence does not count', not raw('Tour screen', 'רטרו: אין\nthe new skill: later', ['index.html']))

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
