# .claude/hooks/ci-watch.py (lesson 25): after a push, the background CI watch.
import json, os, subprocess, sys
HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'ci-watch.py')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
def hook(tool, inp):
    r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': tool, 'tool_input': inp}), capture_output=True, text=True, timeout=30)
    try: return ((json.loads(r.stdout or '{}').get('hookSpecificOutput') or {}).get('additionalContext')) or ''
    except Exception: return 'BAD:' + r.stdout + r.stderr

o = hook('Bash', {'command': 'git push -q -u origin routine/x-2026-10-01'})
check('git push: the background watch command', 'gh pr checks' in o and '--watch' in o and 'run_in_background' in o, o)
check('...for the pushed branch, in this repo', '-R mishaf1988-lgtm/tfugen-safety' in o, o)
o = hook('Bash', {'command': 'git add -A && git commit -qm x && git push -q 2>&1 | tail -1'})
check('push at the end of a chain: also', 'gh pr checks' in o, o)
check('git status: nothing', hook('Bash', {'command': 'git status --short'}) == '')
check('a word containing push (pushd): nothing', hook('Bash', {'command': 'pushd /tmp && ls'}) == '')
check('the watch itself (background): nothing', hook('Bash', {'command': 'gh pr checks x --watch', 'run_in_background': True}) == '')
o = hook('mcp__github__create_pull_request', {'head': 'routine/y-2026-10-01', 'base': 'main'})
check('PR opened: watch its head branch', 'gh pr checks routine/y-2026-10-01' in o, o)
check('another tool: nothing', hook('Read', {'file_path': '/x'}) == '')
check('wired in settings.json as PostToolUse', 'ci-watch.py' in json.dumps(json.load(open(os.path.join(os.path.dirname(HOOK), '..', 'settings.json')))['hooks']['PostToolUse']))
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
