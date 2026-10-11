#!/usr/bin/env python3
"""guard-sql.py: what runs without a prompt, what asks, what is denied (01/10/2026).

execute_sql is on the allow list, so this hook is the only thing between a
destructive statement and the live database. Runs the real hook on stdin.
"""
import json, os, subprocess, sys

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'guard-sql.py')
ok = bad = 0


def decision(tool_input):
    out = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_input': tool_input}),
                         capture_output=True, text=True).stdout.strip() or '{}'
    return (json.loads(out).get('hookSpecificOutput') or {}).get('permissionDecision', 'pass')


def check(label, tool_input, want):
    global ok, bad
    got = decision(tool_input)
    if got == want:
        ok += 1; print('  ✓ ' + label)
    else:
        bad += 1; print('  ✗ %s  -> %s (want %s)' % (label, got, want))


T = 'TRUNC' + 'ATE'  # spelled apart so this file never trips the hook as a Bash argument
check('select runs without a prompt', {'query': 'select count(*) from inc'}, 'pass')
check('update runs without a prompt', {'query': "update inc set rc='x' where id='1'"}, 'pass')
check('insert runs without a prompt', {'query': "insert into tasks(id) values ('t1')"}, 'pass')
check('delete from an ordinary table asks', {'query': "delete from tasks where id='1'"}, 'ask')
check('truncate of an ordinary table asks', {'query': T + ' tasks'}, 'ask')
check('drop table asks', {'query': 'drop table if exists tmp_x'}, 'ask')
check('drop column asks', {'query': 'alter table inc drop column rc'}, 'ask')
check('alter table ... drop constraint asks', {'query': 'alter table inc drop constraint c1'}, 'ask')
check('drop policy asks', {'query': 'drop policy p on inc'}, 'ask')
check('create policy asks', {'query': 'create policy p on inc for select using (true)'}, 'ask')
check('alter policy asks', {'query': 'alter policy p on inc using (true)'}, 'ask')
check('disable RLS asks', {'query': 'alter table inc disable row level security'}, 'ask')
check('a migration with a drop asks too', {'name': 'm', 'query': 'drop trigger t on inc'}, 'ask')
check('protected table is still denied, not asked', {'query': T + ' ncr'}, 'deny')
check('delete from trustee_reports is denied', {'query': 'delete from public.trustee_reports'}, 'deny')
check('a Bash command that mentions delete is left to the normal prompt', {'command': 'grep -n "DELETE FROM tasks" x'}, 'pass')
check('a Bash command on a protected table is still denied', {'command': 'psql -c "' + T + ' ncr"'}, 'deny')

# tfugen-db rule 7a: these hang the connector for 60s (10/10 and 11/10/2026)
check('semicolon inside a literal is denied', {'query': "update docs set n='a; b' where id='1'"}, 'deny')
check('gershayim is denied', {'query': "update docs set n='\u05ea\u05f4\u05d6' where id='1'"}, 'deny')
check('two statements separated by ; still run', {'query': "select 1; select 2;"}, 'pass')
check("an escaped quote before ; outside the literal runs", {'query': "update docs set n='it''s' where id='1';"}, 'pass')
check("escaped quote then ; inside the literal is denied", {'query': "update docs set n='it''s; x' where id='1'"}, 'deny')
check('a Bash command with ; in quotes is not this rule', {'command': "echo 'a; b'"}, 'pass')
check('a destructive statement with ; still asks', {'query': "delete from tasks where n='a; b'"}, 'ask')

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
