# .claude/hooks/ci-watch.py (lesson 25): after a push, the background CI watch.
import json, os, subprocess, sys
HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'ci-watch.py')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))
def hook(tool, inp, running='0'):
    env = dict(os.environ, CI_WATCH_RUNNING=running)
    r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': tool, 'tool_input': inp}), capture_output=True, text=True, timeout=30, env=env)
    try: return ((json.loads(r.stdout or '{}').get('hookSpecificOutput') or {}).get('additionalContext')) or ''
    except Exception: return 'BAD:' + r.stdout + r.stderr

o = hook('Bash', {'command': 'git push -q -u origin routine/x-2026-10-01'})
check('git push: the background watch command, for the branch pushed', 'ci-wait.sh routine/x-2026-10-01 ' in o and 'run_in_background' in o, o)
check('...in this repo, and not gh pr checks (GraphQL, blocked here)', 'mishaf1988-lgtm/tfugen-safety' in o and 'gh pr checks' not in o, o)
o = hook('Bash', {'command': 'git add -A && git commit -qm x && git push -q origin routine/z-2026-10-01 2>&1 | tail -1'})
check('push at the end of a chain: also', 'ci-wait.sh routine/z-2026-10-01 ' in o, o)
check('git status: nothing', hook('Bash', {'command': 'git status --short'}) == '')
check('a word containing push (pushd): nothing', hook('Bash', {'command': 'pushd /tmp && ls'}) == '')
check('the watch itself (background): nothing', hook('Bash', {'command': 'bash .claude/hooks/ci-wait.sh x', 'run_in_background': True}) == '')
o = hook('mcp__github__create_pull_request', {'head': 'routine/y-2026-10-01', 'base': 'main'})
check('PR opened: watch its head branch', 'ci-wait.sh routine/y-2026-10-01' in o, o)
check('another tool: nothing', hook('Read', {'file_path': '/x'}) == '')
check('wired in settings.json as PostToolUse', 'ci-watch.py' in json.dumps(json.load(open(os.path.join(os.path.dirname(HOOK), '..', 'settings.json')))['hooks']['PostToolUse']))
w = '\n'.join(l for l in open(os.path.join(os.path.dirname(HOOK), 'ci-wait.sh')).read().split('\n') if not l.lstrip().startswith('#'))
check('ci-wait.sh: REST only (no GraphQL), red exits 1', 'gh api "repos/' in w and 'gh pr' not in w and 'exit 1' in w and 'check-runs' in w and '.name == "tests"' in w)
o = hook('Bash', {'command': "python3 - <<'EOF'\ns = \"o = hook('Bash', {'command': 'git push -q origin routine/fake-2026-10-01'})\"\nEOF\ngit push -q -u origin routine/real-2026-10-02 2>&1 | tail -1"})
check('a fake push inside a heredoc earlier in the command does not win: the real (last) push does', 'ci-wait.sh routine/real-2026-10-02 ' in o and 'fake' not in o, o)
o = hook('Bash', {'command': 'git push -q origin routine/x-2026-10-01'}, running='1')
check('a watcher already on the branch: say it follows the head, do not start or kill', 'כבר רץ' in o and 'ci-wait.sh routine/x' not in o and 'להרוג' in o, o)
o = hook('mcp__github__create_pull_request', {'head': 'routine/y-2026-10-01'}, running='1')
check('PR opened while a watcher runs: same', 'כבר רץ' in o, o)
# 05/10/2026: "git push" only inside a heredoc body is not a push (it named a branch "b").
o = hook('Bash', {'command': "cat > /tmp/t.py <<'EOF'\ngit push origin b\nEOF\npython3 /tmp/t.py"})
check('git push only inside a heredoc body: nothing', o == '', o)
o = hook('Bash', {'command': "cat <<-EOF > x\n\tgit push origin b\n\tEOF\necho done"})
check('...also with <<- and a tab-indented terminator', o == '', o)
o = hook('Bash', {'command': "grep -q x <<< 'git push origin b' && git push -q origin routine/hs-2026-10-05"})
check('a here-string (<<<) is not a heredoc: the real push after it is seen', 'ci-wait.sh routine/hs-2026-10-05 ' in o, o)
# 05/10/2026: `git push origin --delete X` started `ci-wait.sh --delete` (the flag taken as the branch).
o = hook('Bash', {'command': 'git push origin --delete routine/old-2026-10-05'})
check('git push origin --delete <branch>: nothing (no CI on a deleted branch)', o == '', o)
check('...and the :<branch> form: nothing', hook('Bash', {'command': 'git push origin :routine/old-2026-10-05'}) == '')
o = hook('Bash', {'command': 'git push origin --force-with-lease routine/f-2026-10-05 2>&1 | tail -1'})
check('a flag after origin is skipped: the branch after it is watched', 'ci-wait.sh routine/f-2026-10-05 ' in o and '--force' not in o, o)
o = hook('Bash', {'command': 'git push -q origin HEAD:routine/h-2026-10-05'})
check('HEAD:<branch>: the branch', 'ci-wait.sh routine/h-2026-10-05 ' in o, o)
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
