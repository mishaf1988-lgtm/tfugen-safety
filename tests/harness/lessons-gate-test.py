# .github/scripts/lessons-gate.py: a fix PR must carry its lesson.
import importlib.util, os, subprocess, sys
# 16/11/2026: the gate reads the branch's own diff (origin/main...HEAD) when BASE is unset, so a real regex change in
# index.html on the branch under test turned these synthetic cases red. An empty diff (HEAD..HEAD) unless a case sets it.
os.environ['BASE'] = 'HEAD'
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.github', 'scripts', 'lessons-gate.py')
spec = importlib.util.spec_from_file_location('gate', P); gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

L = gate.LESSONS
R = 'רטרו: אין\nskill: אין\nמה לא נבדק: אין\nעוזר: לא נוגע, בדיקה\nאחים: grep של הדפוס, אין אחר\nשבירה: הסרתי את התיקון, בדיקה 4b נכשלה (2)\n'
ok = lambda t, b, f: gate.check(t, R + (b or ''), f)[0]
check('not a fix PR: ok', ok('Tour screen: due date in one tap', '', ['chat/x.html']))
Rm = lambda r: 'רטרו: ' + r + '\nskill: אין\nמה לא נבדק: אין\nאחים: grep של הדפוס, אין אחר\nשבירה: הסרתי את התיקון, בדיקה 4b נכשלה (2)\n'
check('01/11/2026: a retro that names a mistake, without a lesson: blocked even without a Fix title', not gate.check('Tour screen', Rm('כתובת מייל נכתבה בקובץ md'), ['chat/x.html'])[0])
check('...with a lesson: ok', gate.check('Tour screen', Rm('כתובת מייל נכתבה בקובץ md'), ['chat/x.html', L])[0])
check('...with no-lesson and a reason: ok', gate.check('Tour screen', Rm('כתובת מייל נכתבה') + 'בלי לקח: כבר לקח 170, חזר נרשם שם', ['chat/x.html'])[0])
check('"רטרו: אין טעות." is no mistake: ok', gate.check('Tour screen', Rm('אין טעות.'), ['chat/x.html'])[0])
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
check('no retro line: blocked', not raw('Tour screen', 'some text', ['chat/x.html']))
check('None body: blocked (no retro)', not raw(None, None, []))
check('retro none (Hebrew): ok', raw('Tour screen', 'text\nרטרו: אין\nskill: אין', ['chat/x.html']))
check('retro none (English): ok', raw('Tour screen', 'retro: none\nskill: אין', ['chat/x.html']))
check('retro with a finding (Michael corrected): needs a lesson since 01/11/2026', not raw('Tour screen', 'רטרו: מיכאל אמר שהכפתור לא במקום\nskill: אין', ['chat/x.html']) and raw('Tour screen', 'רטרו: מיכאל אמר שהכפתור לא במקום\nskill: אין', ['chat/x.html', L]))
check('empty retro: blocked', not raw('Tour screen', 'רטרו:   ', ['chat/x.html']))
check('retro inside a sentence does not count', not raw('Tour screen', 'we skipped the retro: later', ['x']))
check('retro does not replace the lesson on a fix PR', not raw('Fix: x', 'רטרו: אין', ['x.js']))
check('RETRO_NONE: "אין." is none', gate.RETRO_NONE.match('אין.') is not None)
check('RETRO_NONE: a finding is not none', gate.RETRO_NONE.match('אין בדיקה לזה') is None)

# 17/11/2026, four test rules (2): code and a test that already existed change together only with a line that names the test
T = 'tests/harness/lessons-gate-test.py'      # exists at HEAD (BASE=HEAD here)
N = 'tests/harness/brand-new-test.py'         # does not
check('code + an existing test, no line: blocked', not ok('Tour screen', '', ['functions/api/x.js', T]))
check('...with the line naming the test: ok', ok('Tour screen', '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4: lessons-gate-test, \u05de\u05e7\u05e8\u05d4 \u05d7\u05d3\u05e9 \u05dc\u05db\u05dc\u05dc \u05d7\u05d3\u05e9', ['functions/api/x.js', T]))
check('...a line that names another test: blocked', not ok('Tour screen', '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4: pr-gate-test, \u05de\u05e7\u05e8\u05d4 \u05d7\u05d3\u05e9', ['functions/api/x.js', T]))
check('...two tests, one named: blocked, and the reason names the other', 'ci-wait-test' in gate.check('Tour screen', R + '\u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4: lessons-gate-test, \u05de\u05e7\u05e8\u05d4 \u05d7\u05d3\u05e9', ['tools/x.py', T, 'tests/harness/ci-wait-test.py'])[1])
check('code + a new test file: no line needed', ok('Tour screen', '', ['functions/api/x.js', N]))
check('a test alone, no code: no line needed', ok('Tour screen', '', [T]))
check('a test + a .md file: no line needed', ok('Tour screen', '', [T, 'STATUS.md']))
check('code + the README or the flaky list of the harness (not tests): no line needed', ok('Tour screen', '', ['functions/api/x.js', 'tests/harness/README.md', 'tests/harness/flaky.md']))
check('a line inside a sentence does not count', not ok('Tour screen', 'said \u05d1\u05d3\u05d9\u05e7\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4: lessons-gate-test later on', ['functions/api/x.js', T]))
# (1): index.html changes with a screenshot line
SH = '\u05e6\u05d9\u05dc\u05d5\u05dd: \u05de\u05e1\u05da \u05d4\u05d1\u05d9\u05ea, .shots/home.png\n'
check('index.html without a shot line: blocked', not ok('Tour screen', '', ['index.html']) and 'pr-shot' in gate.check('Tour screen', R, ['index.html'])[1])
check('...with it: ok', ok('Tour screen', SH, ['index.html']))
check('...an empty shot line: blocked', not ok('Tour screen', '\u05e6\u05d9\u05dc\u05d5\u05dd:  ', ['index.html']))
check('chat/index.html is not the app: no shot line needed', ok('Tour screen', '', ['chat/index.html']))

# as the workflow calls it: env + stdin, exit code
def run(title, body, files):
    return subprocess.run([sys.executable, P], input='\n'.join(files), capture_output=True, text=True,
                          env=dict(os.environ, PR_TITLE=title, PR_BODY=R + body)).returncode
check('CLI: blocked exits 1', run('Fix: x', '', ['a.js']) == 1)
check('CLI: lesson exits 0', run('Fix: x', '', ['a.js', L]) == 0)
check('CLI: shell characters in title are just text', run('Fix: $(touch /tmp/pwned) `id`', '', [L]) == 0 and not os.path.exists('/tmp/pwned'))

# skill line, on every PR (02/10/2026)
S = '.claude/skills/tfugen-db/SKILL.md'
check('no skill line: blocked', not raw('Tour screen', 'רטרו: אין', ['chat/x.html']))
check('skill none: ok', raw('Tour screen', 'רטרו: אין\nskill: אין', ['chat/x.html']))
check('Hebrew label: ok', raw('Tour screen', 'רטרו: אין\nסקייל: אין', ['chat/x.html']))
check('skill named but no skill file changed: blocked', not raw('Tour screen', 'רטרו: אין\nskill: tfugen-db, איך מריצים migration', ['chat/x.html']))
check('skill named with a skill file: ok', raw('Tour screen', 'רטרו: אין\nskill: tfugen-db, איך מריצים migration', ['chat/x.html', S]))
check('a named skill that did not change: blocked (17/10/2026, #1619)', not raw('Tour screen', 'רטרו: אין\nskill: tfugen-ref, הלוגו', ['chat/x.html', S]))
check('a named skill that changed: ok', raw('Tour screen', 'רטרו: אין\nskill: tfugen-db, migration', ['chat/x.html', S]))
check('a word that is not a skill folder is not required', raw('Tour screen', 'רטרו: אין\nskill: tfugen-db, ראה tfugen-safety', ['chat/x.html', S]))
check('the account skill counts too', raw('Tour screen', 'רטרו: אין\nskill: כלל כללי', ['project-files/claude-ai-skill/michael-work-lessons/SKILL.md']))
check('a skill learned in michael-skills counts with its PR (07/10/2026)', raw('Tour screen', 'רטרו: אין\nskill: העוזר, כלל 44, michael-skills#3', ['chat/x.html']))
check('...naming michael-skills without a PR number does not', not raw('Tour screen', 'רטרו: אין\nskill: העוזר ב-michael-skills', ['chat/x.html']))
check('...or with the commit pushed straight to main (08/10/2026)', raw('Tour screen', 'רטרו: אין\nskill: העוזר, כלל 46, michael-skills@6cee732', ['chat/x.html']))
check('...a short or non-hex sha does not', not raw('Tour screen', 'רטרו: אין\nskill: העוזר, michael-skills@main', ['chat/x.html']))
check('a file merely named skills elsewhere does not count', not raw('Tour screen', 'רטרו: אין\nskill: משהו', ['docs/.claude/skills/x.md']))
check('empty skill line: blocked', not raw('Tour screen', 'רטרו: אין\nskill:   ', ['chat/x.html']))
check('skill inside a sentence does not count', not raw('Tour screen', 'רטרו: אין\nthe new skill: later', ['chat/x.html']))

# a lesson in a field skill counts (11/10/2026); run from the repo root
_cwd = os.getcwd(); os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
check('fix PR with a lesson in tfugen-dev: ok', raw('Fix: x', 'רטרו: אין\nskill: לקח 23\nאחים: grep, אין אחר', ['a.js', '.claude/skills/tfugen-dev/references/lessons.md']))
check('tfugen-dev SKILL.md itself no longer holds the lessons (moved 27/10/2026)', not raw('Fix: x', 'רטרו: אין\nskill: x', ['a.js', '.claude/skills/tfugen-dev/SKILL.md']))
check('fix PR touching a skill with no lessons section: blocked', not raw('Fix: x', 'רטרו: אין\nskill: x', ['a.js', '.claude/skills/tfugen-history/SKILL.md']))
os.chdir(_cwd)

# a sensitive PR needs a security review line (27/10/2026)
import tempfile
check('a login file without a review line: blocked', not raw('Codes screen', R, ['functions/api/codes.js']))
check('a login file with a review line and a refute line: ok', raw('Codes screen', R + 'סקירה: סוכן נפרד בדק את ה-diff, לא נמצא דבר\nהפרכה: אין ממצא מאושר', ['functions/api/codes.js']))
check('a review line without a refute line: blocked (27/10/2026, security-review.md)', not raw('Codes screen', R + 'סקירה: סוכן נפרד בדק את ה-diff, מאושר 1 (תוקן)', ['functions/api/codes.js']))
check('an empty refute line: blocked', not raw('Codes screen', R + 'סקירה: סוכן נפרד בדק את ה-diff\nהפרכה: ', ['functions/api/codes.js']))
check('an ordinary server file: no review needed', raw('Morning brief', R, ['functions/api/wa-morning.js']))
R0 = 'רטרו: אין\nskill: אין\n'
check('server code without an unchecked line: blocked (31/10/2026)', not raw('Morning brief', R0, ['functions/api/wa-morning.js']))
check('...with a real unchecked line: ok', raw('Morning brief', R0 + 'מה לא נבדק: לא נבדק בטלפון אמיתי\nעוזר: לא נוגע', ['functions/api/wa-morning.js']))
check('...an empty unchecked line: blocked', not raw('Morning brief', R0 + 'מה לא נבדק: ', ['functions/api/wa-morning.js']))
check('...not required outside functions/', raw('Tour screen', R0, ['chat/x.html', 'STATUS.md']))
check('a file that takes outside input (trustee photos, a parser): blocked without review', not raw('Log', R, ['functions/api/trustee-log.js']) and not raw('PDF', R, ['functions/_pdftext.js']))
# 02/11/2026 (Michael: "do it: only when the checks change"): routine-db.js needs a review only when a check changes
cc = gate.changes_checks
check('routine-db: a changed refusal or *Check line = review; a comment, a log line or a new field = none',
  cc("+      if (x) return jsonResp({ ok: false, error: 'bad' }, 400, {});") and cc("-  if (!d0) return { error: 'replaced_by' };") and cc("+      const c = odExpireCheck(body);")
  and cc("+export function draftThreadGate(b) {") and not cc("+      // return jsonResp({ ok: false })") and not cc("+      const name = 'x';") and not cc("+++ b/functions/api/routine-db.js"))
check('routine-db is in CHECKED_FILES and its path exists', all(os.path.exists(os.path.join(gate.ROOT, f)) for f in gate.CHECKED_FILES) and 'functions/api/routine-db.js' in gate.CHECKED_FILES)
_fd = gate.file_diff
try:
    gate.file_diff = lambda f: "+  const n = 1;"
    check('routine-db with no check changed: no review needed', raw('Morning brief', R, ['functions/api/routine-db.js']))
    gate.file_diff = lambda f: "+  if (!ok) return jsonResp({ ok: false, error: 'x' }, 400, {});"
    check('routine-db with a check changed: blocked without review', not raw('Morning brief', R, ['functions/api/routine-db.js']))
    gate.file_diff = lambda f: None
    check('routine-db whose diff cannot be read: blocked without review', not raw('Morning brief', R, ['functions/api/routine-db.js']))
finally:
    gate.file_diff = _fd
# 02/11/2026 (Michael: "do it: required in every fix"): a fix PR carries an "אחים:" line
R_noSib = 'רטרו: אין\nskill: אין\nמה לא נבדק: אין\nעוזר: לא נוגע\n'
check('a Fix PR without a siblings line: blocked, even with its lesson', not gate.check('Fix: x', R_noSib, ['a.js', L])[0])
check('...with "אחים: <what was searched and found>": ok', gate.check('Fix: x', R_noSib + 'אחים: grep tapIsPrev, 4 אחים, תוקנו', ['a.js', L])[0])
check('...an empty siblings line: blocked', not gate.check('Fix: x', R_noSib + 'אחים: ', ['a.js', L])[0])
# 03/11/2026 (Michael: "do it: required in every fix"): a fix PR that changes code proves its test catches the bug
R_noBrk = 'רטרו: אין\nskill: אין\nמה לא נבדק: אין\nעוזר: לא נוגע\nאחים: grep, אין אחר\n'
check('a Fix PR on server code without a break line: blocked', not gate.check('Fix: x', R_noBrk, ['functions/api/wa-morning.js', L])[0])
check('...on index.html, a hook or a tool: blocked too', all(not gate.check('Fix: x', R_noBrk, [f, L])[0] for f in ['index.html', '.claude/hooks/x.py', 'tools/x.py']))
check('...with "שבירה: <what was taken out and what failed>": ok', gate.check('Fix: x', R_noBrk + 'שבירה: בלי stateCas נכשלו 3 בבדיקת המרוץ', ['functions/api/wa-morning.js', L])[0])
check('...a too short break line: blocked', not gate.check('Fix: x', R_noBrk + 'שבירה: כן', ['functions/api/x.js', L])[0])
check('a Fix PR on documents only: no break line needed', gate.check('Fix: x', R_noBrk, ['project-files/x.md', L])[0])
check('not a fix PR on server code: no break line needed', gate.check('Morning brief', R_noBrk, ['functions/api/wa-morning.js'])[0])
check('not a fix PR: no siblings line needed', gate.check('Tour screen', R_noSib, ['chat/x.html'])[0])
# 02/11/2026 (Michael: "do it: yes"): a changed regex or text filter carries a "זוגות:" line
cr = gate.changes_regex
check('changes_regex: a regex literal or new RegExp in a code line; not a comment, not a division, not a URL',
  cr("+  if (/^tru-/.test(n)) return 1;") and cr("+export const QUOTE_VALID_RE = /תוקף ההצעה/i;") and cr("-  const r = new RegExp(x);")
  and not cr("+  // /^tru-/.test(n)") and not cr("+  const h = a / b / c;") and not cr("+  const u = 'https://x.co/a/b';") and not cr("+++ b/x.js"))
_fd = gate.file_diff
try:
    gate.file_diff = lambda f: "+  if (/^nm-/.test(x)) return;"
    check('a filter change without a pairs line: blocked', not raw('Filter', R, ['functions/api/x.js']))
    check('...with "זוגות: <the test with 3 and 3>": ok', raw('Filter', R + 'זוגות: x-test.mjs, 3 שורות שמתאימות ו-3 שלא', ['functions/api/x.js']))
    check('...a regex in a .md file does not count', raw('Doc', R, ['STATUS.md']))
    gate.file_diff = lambda f: "+  const n = 1;"
    check('a code change with no regex: no pairs line needed', raw('Filter', R, ['functions/api/x.js']))
finally:
    gate.file_diff = _fd
# 06/11/2026 (Michael: "a sync rule has to go in"): a new decision or a server change teaches the assistant, or says why not
R_noSync = 'רטרו: אין\nskill: אין\nמה לא נבדק: אין\n'
# 15/11/2026: these checks name functions/api/works.js; its real diff on a branch that changes a regex there
# made the pairs rule fire and the sync checks fail. The diff is stubbed here, as in the pairs block above.
_fd2 = gate.file_diff
gate.file_diff = lambda f: "+  const n = 1;"
check('sync: a new decision and nothing for the assistant: blocked', not raw('Decision', R_noSync, ['DECISIONS.md', 'STATUS.md']))
check('sync: ...the decisions map alone does not count', not raw('Decision', R_noSync, ['DECISIONS.md', 'project-files/domains/decisions-map.tsv']))
check('sync: a server change and nothing for the assistant: blocked', not raw('Weekly mail', R_noSync, ['functions/api/works.js']))
check('sync: ...with the branch rules changed: ok', raw('Decision', R_noSync, ['DECISIONS.md', 'project-files/domains/rules/env.md']))
check('sync: ...with a topic file or the core changed: ok', raw('Mail', R_noSync, ['functions/api/works.js', 'project-files/wa-topics/ops.md']) and raw('Mail', R_noSync, ['DECISIONS.md', 'project-files/routine-wa-core.md']))
check('sync: ...with a branch file changed: ok', raw('Decision', R_noSync, ['DECISIONS.md', 'project-files/domains/env.md']))
check('sync: ...with "עוזר: <why not>": ok', raw('Weekly mail', R_noSync + 'עוזר: שינוי פנימי בשרת, אין מה לדעת\n', ['functions/api/works.js']))
check('sync: an empty "עוזר:" line: blocked', not raw('Weekly mail', R_noSync + 'עוזר: \n', ['functions/api/works.js']))
check('sync: a PR with neither a decision nor server code: no line needed', raw('Status', R_noSync, ['STATUS.md', 'project-files/ideas-lab.md']))
gate.file_diff = _fd2
check('every SENSITIVE path exists in the repo', all(os.path.exists(os.path.join(gate.ROOT, f)) for f in gate.SENSITIVE), [f for f in gate.SENSITIVE if not os.path.exists(os.path.join(gate.ROOT, f))])
check('an empty review line: blocked', not raw('Codes screen', R + 'סקירה: ', ['functions/api/create-user.js']))
mig = 'migrations/zz-gate-test-%d.sql' % os.getpid()
open(os.path.join(gate.ROOT, mig), 'w').write('create policy p on public.x for select to anon using (true);')
try:
    check('a migration with a policy: blocked without review', not raw('New table', R, [mig]))
    open(os.path.join(gate.ROOT, mig), 'w').write('create table if not exists public.y (id int);')
    check('a migration with no permission change: no review needed', raw('New table', R, [mig]))
finally:
    os.remove(os.path.join(gate.ROOT, mig))

# 21/11/2026: check_all gives every missing line; check stays the first one (CI prints it)
ok_all, whys = gate.check_all('x', '', ['functions/_wa.js'])
check('check_all: an empty description on a server file names all six, in the order check() gave them', not ok_all and len(whys) == 6 and 'retro' in whys[0] and 'skill line' in whys[1] and gate.check('x', '', ['functions/_wa.js'])[1] == whys[0], whys)
check('check_all: a good description is ok with its reason', gate.check_all('Tour screen', R, ['chat/x.html']) == (True, ['not a fix PR']), gate.check_all('Tour screen', R, ['chat/x.html']))

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
