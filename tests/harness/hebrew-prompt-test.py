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
