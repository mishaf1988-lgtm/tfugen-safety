# .claude/hooks/desc-hebrew.py (lesson 13, 27/10/2026): a command description shown to Michael
# in English is denied before it runs; Hebrew with names (paths, branches, git words) passes.
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
HOOK = os.path.join(ROOT, '.claude', 'hooks', 'desc-hebrew.py')
p = f = 0
def check(label, cond, detail=None):
    global p, f
    if cond: p += 1; print('  ✓ ' + label)
    else: f += 1; print('  ✗ ' + label + ('  -> ' + str(detail)[:300] if detail is not None else ''))
def run(tool, desc):
    payload = {'tool_name': tool, 'tool_input': {'command': 'ls', 'description': desc} if desc is not None else {'command': 'ls'}}
    r = subprocess.run([sys.executable, HOOK], input=json.dumps(payload), capture_output=True, text=True, encoding='utf-8')
    out = json.loads(r.stdout or '{}')
    return r.returncode, (out.get('hookSpecificOutput') or {}).get('permissionDecision')
for d in ('Check CI waits for PR 2115', 'Run tests', 'Sync main, read handoff, test hooks', 'Wait for CI on routine/x-2026-10-27'):
    rc, dec = run('Bash', d)
    check('denied: ' + d, rc == 0 and dec == 'deny', dec)
for d in ('מחכה לבדיקות של routine/chat-continuity-2026-10-27', 'מריץ git fetch ו-reset', 'ממזג את main לענף ומריץ בדיקות',
          'קורא את `project-files/routine-additions-log.md`', 'בודק את PR 2115'):
    rc, dec = run('Bash', d)
    check('allowed: ' + d, rc == 0 and dec is None, dec)
rc, dec = run('Agent', 'Security review privacy migration')
check('an Agent description in English is denied too', dec == 'deny', dec)
rc, dec = run('Bash', None)
check('no description: left alone', rc == 0 and dec is None, dec)
r = subprocess.run([sys.executable, HOOK], input='not json', capture_output=True, text=True, encoding='utf-8')
check('bad input: exit 0, no decision', r.returncode == 0 and 'deny' not in r.stdout, r.stdout)
s = json.load(open(os.path.join(ROOT, '.claude', 'settings.json'), encoding='utf-8'))
wired = [h for h in s['hooks'].get('PreToolUse', []) if 'desc-hebrew.py' in json.dumps(h)]
check('wired in settings.json for Bash and Agent', any('Bash' in h.get('matcher', '') and 'Agent' in h.get('matcher', '') for h in wired), wired)
print('\n%d passed, %d failed' % (p, f))
sys.exit(1 if f else 0)
