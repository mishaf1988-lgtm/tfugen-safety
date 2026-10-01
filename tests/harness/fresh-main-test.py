# .claude/hooks/fresh-main.py against a throwaway origin + clone (BACKLOG 31).
import json, os, subprocess, sys, tempfile
HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'fresh-main.py')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

def sh(cwd, *a):
    subprocess.run(list(a), cwd=cwd, check=True, capture_output=True)

def hook(path):
    env = dict(os.environ, FRESH_MAIN_EVERY='0')
    r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': 'Edit', 'tool_input': {'file_path': path}}),
                       capture_output=True, text=True, env=env, timeout=60)
    try: return json.loads(r.stdout or '{}')
    except Exception: return {'raw': r.stdout, 'err': r.stderr}

def denied(o): return (o.get('hookSpecificOutput') or {}).get('permissionDecision') == 'deny'

tmp = tempfile.mkdtemp()
origin, me, other = (os.path.join(tmp, n) for n in ('origin.git', 'me', 'other'))
sh(tmp, 'git', 'init', '-q', '--bare', '-b', 'main', origin)
sh(tmp, 'git', 'init', '-q', '-b', 'main', me)
sh(me, 'git', 'config', 'user.email', 't@t'); sh(me, 'git', 'config', 'user.name', 't')
open(os.path.join(me, 'a.txt'), 'w').write('a\n'); open(os.path.join(me, 'STATUS.md'), 'w').write('s\n')
os.makedirs(os.path.join(me, 'docs')); open(os.path.join(me, 'docs', 'מצב.md'), 'w').write('h\n')
sh(me, 'git', 'add', '-A'); sh(me, 'git', 'commit', '-q', '-m', 'one')
sh(me, 'git', 'remote', 'add', 'origin', origin); sh(me, 'git', 'push', '-q', '-u', 'origin', 'main')
sh(tmp, 'git', 'clone', '-q', origin, other)
sh(other, 'git', 'config', 'user.email', 'o@o'); sh(other, 'git', 'config', 'user.name', 'o')

check('up to date: edit allowed', not denied(hook(os.path.join(me, 'STATUS.md'))))

# the other account changes STATUS.md and a Hebrew-named file, and pushes
open(os.path.join(other, 'STATUS.md'), 'a').write('other\n')
open(os.path.join(other, 'docs', 'מצב.md'), 'a').write('other\n')
sh(other, 'git', 'commit', '-qam', 'other'); sh(other, 'git', 'push', '-q')

o = hook(os.path.join(me, 'STATUS.md'))
check('main moved, same file: edit denied', denied(o), o)
reason = (o.get('hookSpecificOutput') or {}).get('permissionDecisionReason', '')
check('reason names the file and the fix for main', 'STATUS.md' in reason and 'reset --hard origin/main' in reason, reason)
check('main moved, other file: edit allowed', not denied(hook(os.path.join(me, 'a.txt'))))
check('Hebrew file name changed on main: denied', denied(hook(os.path.join(me, 'docs', 'מצב.md'))))
check('new file that does not exist yet: allowed', not denied(hook(os.path.join(me, 'new', 'x.md'))))
check('file outside any repo: allowed', not denied(hook(os.path.join(tmp, 'loose.txt'))))

# on a feature branch the fix is a rebase
sh(me, 'git', 'checkout', '-qb', 'routine/x')
o = hook(os.path.join(me, 'STATUS.md'))
check('feature branch behind: denied with rebase', denied(o) and 'rebase origin/main' in str(o), o)

# after catching up, allowed again
sh(me, 'git', 'checkout', '-q', 'main'); sh(me, 'git', 'reset', '-q', '--hard', 'origin/main')
check('after reset to origin/main: allowed', not denied(hook(os.path.join(me, 'STATUS.md'))))

# no network: origin unreachable -> fails open on a file that is current locally
sh(me, 'git', 'remote', 'set-url', 'origin', os.path.join(tmp, 'gone.git'))
check('origin unreachable: allowed (fails open)', not denied(hook(os.path.join(me, 'STATUS.md'))))

# garbage input: allowed
r = subprocess.run([sys.executable, HOOK], input='not json', capture_output=True, text=True)
check('bad input: allowed', r.stdout.strip() == '{}', r.stdout)

print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
