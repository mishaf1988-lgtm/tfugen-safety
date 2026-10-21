#!/usr/bin/env python3
"""trigger-prompt-gate.py (lesson 140): send_message asking for update_trigger is denied."""
import json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'trigger-prompt-gate.py')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail)[:300] if detail is not None else ''))
def hook(name, inp):
    r = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': name, 'tool_input': inp}), capture_output=True, text=True, encoding='utf-8')
    return json.loads(r.stdout or '{}').get('hookSpecificOutput', {})
o = hook('mcp__claude-code-remote__send_message', {'session_id': 's', 'message': 'please run update_trigger on trig_X with this prompt'})
check('send_message asking for update_trigger: denied, names lesson 140 and the Routine page', o.get('permissionDecision') == 'deny' and '140' in o.get('permissionDecisionReason', '') and 'routines' in o.get('permissionDecisionReason', ''), o)
check('an ordinary send_message: passes', hook('mcp__claude-code-remote__send_message', {'session_id': 's', 'message': 'open a new session for the handoff'}) == {})
check('another tool with the word: passes', hook('Bash', {'command': 'echo update_trigger'}) == {})
check('bad input: passes', subprocess.run([sys.executable, HOOK], input='x', capture_output=True, text=True).stdout.strip() == '{}')
print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
