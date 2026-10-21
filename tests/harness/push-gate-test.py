#!/usr/bin/env python3
# .claude/hooks/push-gate.py (lesson 41): a push with a changed lessons file runs the format test first.
import json, os, subprocess, sys, tempfile
HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'push-gate.py')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
def fake(rc):
    fd, p = tempfile.mkstemp(suffix='.py'); os.write(fd, ('import sys; print("  ✗ file is over"); sys.exit(%d)' % rc).encode()); os.close(fd); return p
def hook(cmd, changed, rc=0, **extra):
    env = dict(os.environ, PUSH_GATE_CHANGED=changed, PUSH_GATE_TEST=fake(rc), **extra)
    r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': 'Bash', 'tool_input': {'command': cmd}}), capture_output=True, text=True, timeout=60, env=env)
    try: return (json.loads(r.stdout or '{}').get('hookSpecificOutput') or {})
    except Exception: return {'bad': r.stdout + r.stderr}
L = '.claude/skills/tfugen-lessons/SKILL.md'
check('not a push: passes', hook('git status', L) == {})
check('push, lessons unchanged: passes', hook('git push -u origin x', 'index.html,STATUS.md') == {})
check('push, lessons changed, test green: passes', hook('git push -u origin x', L + ',STATUS.md', 0) == {})
# Windows (05/10/2026): a piped stdout is cp1255, so a green test that prints a check mark crashed and every push was denied
check('push, test green but the console is cp1255: passes', hook('git push origin x', L, 0, PYTHONIOENCODING='cp1255') == {})
o = hook('git push -q origin x', L, 1)
check('push, lessons changed, test red: denied with the reason', o.get('permissionDecision') == 'deny' and 'lessons-format' in o.get('permissionDecisionReason', '') and 'file is over' in o.get('permissionDecisionReason', ''), o)
check('a push inside a longer command is still a push', hook('git add -A && git commit -q -m x && git push origin x', L, 1).get('permissionDecision') == 'deny')
# the real test, from a subdirectory: the hook must find the repo root itself
env = dict(os.environ, PUSH_GATE_CHANGED=L); env.pop('PUSH_GATE_TEST', None); env.pop('CLAUDE_PROJECT_DIR', None)
r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': 'Bash', 'tool_input': {'command': 'git push origin x'}, 'cwd': os.path.dirname(os.path.abspath(__file__))}), capture_output=True, text=True, timeout=120, env=env)
check('from tests/harness as cwd the real format test is found and run (no "No such file")', 'No such file' not in r.stdout + r.stderr, r.stdout[-300:])
check('git push only inside a heredoc body: passes (05/10/2026)', hook("cat > t.py <<'EOF'\necho; git push origin b\nEOF\npython3 t.py", L, 1) == {})
check('a real push after a heredoc: still checked', hook("cat > t <<'EOF'\nx\nEOF\ngit push origin x", L, 1).get('permissionDecision') == 'deny')
# 14/10/2026: a changed server file runs graph-writes-test.py (PR #1502 went red on a new mail call site)
o = hook('git push origin x', 'functions/api/hazard-report.js,index.html', 1)
check('push, a functions/ file changed, test red: denied, names graph-writes', o.get('permissionDecision') == 'deny' and 'graph-writes-test.py' in o.get('permissionDecisionReason', ''), o)
check('push, a functions/ file changed, test green: passes', hook('git push origin x', 'functions/_onedrive.js', 0) == {})
check('push, only index.html changed: no server check', hook('git push origin x', 'index.html,tests/harness/x.js', 1) == {})
env = dict(os.environ, PUSH_GATE_CHANGED='functions/api/hazard-report.js'); env.pop('PUSH_GATE_TEST', None)
r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': 'Bash', 'tool_input': {'command': 'git push origin x'}}), capture_output=True, text=True, timeout=120, env=env)
check('the real graph-writes test runs and is green on this tree', r.returncode == 0 and (json.loads(r.stdout or '{}') == {}), r.stdout[-300:] + r.stderr[-300:])
# 17/10/2026 (lesson 2): a changed hook runs hook-utf8-test.py, a changed settings.json runs settings-test.py
o = hook('git push origin x', '.claude/hooks/paste-guard.py', 1)
check('push, a hook changed, test red: denied, names hook-utf8', o.get('permissionDecision') == 'deny' and 'hook-utf8-test.py' in o.get('permissionDecisionReason', ''), o)
o = hook('git push origin x', '.claude/settings.json', 1)
check('push, settings.json changed, test red: denied, names settings-test', o.get('permissionDecision') == 'deny' and 'settings-test.py' in o.get('permissionDecisionReason', ''), o)
check('push, a hook README changed only: no hook check', hook('git push origin x', '.claude/hooks/README.md', 1) == {})
env = dict(os.environ, PUSH_GATE_CHANGED='.claude/hooks/push-gate.py,.claude/settings.json'); env.pop('PUSH_GATE_TEST', None)
r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': 'Bash', 'tool_input': {'command': 'git push origin x'}}), capture_output=True, text=True, timeout=120, env=env)
check('the real hook-utf8 and settings tests run and are green on this tree', r.returncode == 0 and (json.loads(r.stdout or '{}') == {}), r.stdout[-300:] + r.stderr[-300:])
# 18/10/2026: a commit on the local main is refused (lesson 110), unless the command branches first.
B = lambda cmd, br: hook(cmd, '', 0, PUSH_GATE_BRANCH=br)
check('commit on main: denied', B('git add -A && git commit -qm x', 'main').get('permissionDecision') == 'deny')
check('commit on a routine branch: passes', B('git commit -qm x', 'routine/x-2026-10-18') == {})
check('checkout -B then commit, while still on main: passes', B('git checkout -q -B routine/x origin/main; git add -A; git commit -qm x', 'main') == {})
check('checkout -b chained with && then commit: passes', B('git checkout -q -b routine/x && git commit -qm x', 'main') == {})
check('checkout -b then ; commit (the -b can fail on an existing branch): denied', 'deny' in json.dumps(B('git checkout -b routine/x 2>/dev/null; git commit -qm x', 'main')))
check('commit only inside a heredoc body on main: passes', B("cat > t <<'EOF'\ngit commit -m x\nEOF\nls", 'main') == {})
env = dict(os.environ, PUSH_GATE_CHANGED='functions/_wa.js'); env.pop('PUSH_GATE_TEST', None)
r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': 'Bash', 'tool_input': {'command': 'git push origin x'}}), capture_output=True, text=True, timeout=120, env=env)
check('21/10/2026: a functions/ change runs the real rule1-hebrew test (node) and it is green on this tree', r.returncode == 0 and json.loads(r.stdout or '{}') == {}, r.stdout[-300:] + r.stderr[-300:])
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
