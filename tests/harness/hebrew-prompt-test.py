# .claude/hooks/hebrew-prompt.py (lesson 13): a Hebrew reminder at the start of every turn,
# and ci-watch.py's message in Hebrew (10/10/2026: the English wait lines came right after it).
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
HOOK = os.path.join(ROOT, '.claude', 'hooks', 'hebrew-prompt.py')
p = f = 0
def check(label, cond, detail=None):
    global p, f
    if cond: p += 1; print('  ✓ ' + label)
    else: f += 1; print('  ✗ ' + label + ('  -> ' + str(detail)[:300] if detail is not None else ''))
def run(hook, payload, env=None):
    r = subprocess.run([sys.executable, hook], input=json.dumps(payload), capture_output=True, text=True, encoding='utf-8', env=dict(os.environ, **(env or {})))
    return r.returncode, r.stdout
rc, out = run(HOOK, {'prompt': 'מאשר', 'hook_event_name': 'UserPromptSubmit'})
o = json.loads(out)['hookSpecificOutput']
check('exits 0 and never blocks the prompt', rc == 0 and 'decision' not in json.loads(out), out)
check('a UserPromptSubmit context', o['hookEventName'] == 'UserPromptSubmit', o)
ctx = o['additionalContext']
heb = sum(1 for c in ctx if '֐' <= c <= '׿'); lat = sum(1 for c in ctx if c.isascii() and c.isalpha())
check('the reminder itself is mostly Hebrew', heb > 3 * lat, (heb, lat))
check('names the wait line and tool output', 'המתנה' in ctx and 'פלט כלי' in ctx, ctx)
check('the rules card: questionnaire now, dates, verify, no long dash', all(w in ctx for w in ('שאלון', 'DD/MM/YYYY', 'לבדוק', 'מקף ארוך')), ctx)
check('a short chat: no switch line', 'השיחה ארוכה' not in ctx, ctx)
check('no account-move line without the words', 'ACCOUNT-MOVE' not in ctx, ctx)
rc, out = run(HOOK, {'prompt': 'אני עובר חשבון עכשיו'})
c = json.loads(out)['hookSpecificOutput']['additionalContext']
check('"עובר חשבון": the move procedure is added to the card', rc == 0 and 'ACCOUNT-MOVE.md' in c and 'כרטיס חוקים' in c, c)
check('the move file exists', os.path.exists(os.path.join(ROOT, 'project-files', 'ACCOUNT-MOVE.md')))
import tempfile
for size, want in ((7_000_000, True), (5_000_000, False)):
    with tempfile.NamedTemporaryFile(delete=False) as tf:
        tf.truncate(size)
    rc, out = run(HOOK, {'prompt': 'x', 'transcript_path': tf.name})
    c = json.loads(out)['hookSpecificOutput']['additionalContext']
    os.unlink(tf.name)
    check('transcript of %.0fMB: switch line %s' % (size / 1e6, 'shown' if want else 'not shown'), ('השיחה ארוכה' in c) == want and ('tfugen-sessions' in c) == want, c)
rc, out = run(HOOK, {'prompt': 'x', 'transcript_path': '/nonexistent/x.jsonl'})
check('a missing transcript: still the card, exit 0', rc == 0 and 'כרטיס חוקים' in out, out)
rc, out = run(HOOK, None)
check('bad input: still a reminder, exit 0', rc == 0 and 'additionalContext' in out, out)
s = json.load(open(os.path.join(ROOT, '.claude', 'settings.json'), encoding='utf-8'))
check('wired in settings.json as UserPromptSubmit', 'hebrew-prompt.py' in json.dumps(s['hooks'].get('UserPromptSubmit', [])))
rc, out = run(os.path.join(ROOT, '.claude', 'hooks', 'ci-watch.py'), {'tool_name': 'Bash', 'tool_input': {'command': 'git push -u origin routine/h-2026-10-10'}}, {'CI_WATCH_RUNNING': '0'})
ctx = (json.loads(out or '{}').get('hookSpecificOutput') or {}).get('additionalContext', '')
heb = sum(1 for c in ctx if '֐' <= c <= '׿')
check('ci-watch: its message is in Hebrew and reminds the wait line is too', heb > 40 and 'בעברית' in ctx and 'ci-wait.sh routine/h-2026-10-10 ' in ctx, ctx)
print('\n%d passed, %d failed' % (p, f))
sys.exit(1 if f else 0)
