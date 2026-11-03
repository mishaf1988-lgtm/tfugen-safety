# .claude/hooks/denial-log.py (ideas-lab 18, 03/11/2026): one agent_log row per auto-mode denial,
# with no command text beyond the first word (a command can hold an employee's name).
import importlib.util, json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
P = os.path.join(ROOT, '.claude', 'hooks', 'denial-log.py')
spec = importlib.util.spec_from_file_location('dl', P); dl = importlib.util.module_from_spec(spec); spec.loader.exec_module(dl)
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

ev = {"hook_event_name": "PermissionDenied", "session_id": "cse_01HFfaw63i5v7JZnNQFnaNhd", "tool_name": "Bash",
      "tool_input": {"command": "bash project-files/routine-db.sh '{\"op\":\"od_move\",\"from\":\"ישראל ישראלי.pdf\"}' 2>&1 | head -c 600"},
      "reason": "[External System Writes]"}
r = dl.row(ev)
check('the row names the tool and the rule', r.startswith('חסימה: Bash [External System Writes]'), r)
check('a routine-db call shows the script and the op', '(bash routine-db.sh od_move)' in r, r)
check('the file name (an employee) is not in the row', 'ישראל' not in r, r)
check('the session is named by its last 8 characters', r.endswith(' s:NQFnaNhd'), r)
check('env assignments are skipped', dl.first_word('FOO=1 curl -X POST x') == 'curl')
mcp = dict(ev, tool_name='mcp__x__sharepoint_delete_item', tool_input={"id": "שם"})
r2 = dl.row(mcp)
check('an MCP denial logs the tool name only', '(' not in r2 and 'שם' not in r2.replace('חסימה', ''), r2)
check('a row is at most 300 characters', len(dl.row(dict(ev, reason='x' * 999))) <= 300)
env = {k: v for k, v in os.environ.items() if k != 'ROUTINE_KEY'}
p = subprocess.run([sys.executable, P], input=json.dumps(ev).encode(), capture_output=True, env=env, timeout=30)
check('without ROUTINE_KEY: exit 0 and the row on stderr', p.returncode == 0 and 'od_move' in p.stderr.decode('utf-8'), p.stderr[:200])
check('the hook never prints a retry decision', p.stdout.strip() == b'', p.stdout[:100])
p = subprocess.run([sys.executable, P], input=b'not json', capture_output=True, env=env, timeout=30)
check('bad input: exit 0', p.returncode == 0)
s = json.load(open(os.path.join(ROOT, '.claude', 'settings.json'), encoding='utf-8'))
hs = [h.get('command', '') for m in s['hooks'].get('PermissionDenied', []) for h in m.get('hooks', [])]
check('settings.json runs denial-log.py on PermissionDenied', any('denial-log.py' in c for c in hs), hs)
print('%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
