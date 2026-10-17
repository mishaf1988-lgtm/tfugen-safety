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
# BACKLOG 13.15 (12/10/2026)
check('grant to anon asks', {'query': 'grant select on emp to anon'}, 'ask')
check('grant to public asks', {'query': 'grant all on emp to public'}, 'ask')
check('grant to authenticated runs (every migration)', {'query': 'grant select on emp to authenticated'}, 'pass')
check('security definer without search_path asks', {'query': 'create function f() returns int language sql security definer as $f$ select 1 $f$'}, 'ask')
check('security definer with search_path runs', {'query': "create function f() returns int language sql security definer set search_path = '' as $f$ select 1 $f$"}, 'pass')
check('disable trigger asks', {'query': 'alter table inc disable trigger protect_delete'}, 'ask')
check('update without where asks', {'query': "update tasks set s='x'"}, 'ask')
check('update with an alias and no where asks', {'query': "update tasks t set s='x'"}, 'ask')
check('update without where after a safe statement asks', {'query': "select 1; update tasks set s='x'"}, 'ask')
check("a 'where' inside the value is not a where", {'query': "update tasks set n='see where it is'"}, 'ask')
check('update ... from ... where runs', {'query': "update tasks t set s=e.s from emp e where e.id=t.id"}, 'pass')
check('a trigger on update is not an update', {'query': 'create trigger t before update on inc for each row execute function f()'}, 'pass')
check('select ... for update is not an update', {'query': 'select * from inc where id=1 for update'}, 'pass')
check('security invoker runs', {'query': 'create function f() returns int language sql security invoker as $f$ select 1 $f$'}, 'pass')
check('a migration with a drop asks too', {'name': 'm', 'query': 'drop trigger t on inc'}, 'ask')
check('protected table is still denied, not asked', {'query': T + ' ncr'}, 'deny')
check('delete from trustee_reports is denied', {'query': 'delete from public.trustee_reports'}, 'deny')
check('a Bash command that mentions delete is left to the normal prompt', {'command': 'grep -n "DELETE FROM tasks" x'}, 'pass')
check('a Bash command on a protected table is still denied', {'command': 'psql -c "' + T + ' ncr"'}, 'deny')

# retro 12/10/2026: forms that slipped past the plain pattern as 'ask' (CLAUDE.md: not even with a general approval)
check('quoted table name is denied', {'query': 'delete from "ncr"'}, 'deny')
check('ONLY is denied', {'query': 'delete from only ncr'}, 'deny')
check('a comment between is denied', {'query': 'delete from /**/ ncr'}, 'deny')
check('truncate of a table list that has ncr is denied', {'query': 'truncate tasks, ncr'}, 'deny')
check("'--' inside a literal is not a comment: delete after it is denied", {'query': "select 'a--b'; delete from ncr"}, 'deny')
check("'/*' inside a literal is not a comment: delete after it is denied", {'query': "select 'a /* b'; delete from ncr; select '*/'"}, 'deny')
check("'--' inside a literal does not hide a ; in the next literal", {'query': "select 'x--'; select 'y;z'"}, 'deny')
check('spaces around the dot are denied', {'query': 'delete from public . ncr'}, 'deny')
check('comments between every word are denied', {'query': 'delete /*a*/ from /*b*/ public /*c*/ . /*d*/ ncr'}, 'deny')
check('a $$ body that deletes is denied', {'query': 'create function f() returns void language sql as $$ delete from ncr $$'}, 'deny')
check('a table that only starts with ncr is not this rule', {'query': 'delete from ncr_old where id=1'}, 'ask')
check('an apostrophe in a comment is not a literal', {'query': "-- don't touch\nselect 1;\nselect 2; -- it's ok"}, 'pass')

# tfugen-db rule 7a: these hang the connector for 60s (10/10 and 11/10/2026)
check('semicolon inside a literal is denied', {'query': "update docs set n='a; b' where id='1'"}, 'deny')
check('gershayim is denied', {'query': "update docs set n='\u05ea\u05f4\u05d6' where id='1'"}, 'deny')
check('two statements separated by ; still run', {'query': "select 1; select 2;"}, 'pass')
check("an escaped quote before ; outside the literal runs", {'query': "update docs set n='it''s' where id='1';"}, 'pass')
check("escaped quote then ; inside the literal is denied", {'query': "update docs set n='it''s; x' where id='1'"}, 'deny')
D = 'DEL' + 'ETE FROM ncr'
check("a Bash flag '--hard' before it does not hide a delete (17/10/2026)", {'command': 'git reset --hard origin/main && psql -c "' + D + ' WHERE false"'}, 'deny')
check("a Bash flag '--' before it does not hide a " + T + " either", {'command': 'psql --host x -c "' + T + ' trustee_reports"'}, 'deny')
check('a Bash command with -- flags and no protected table passes', {'command': 'git reset --hard origin/main && git log --oneline'}, 'pass')
check('a Bash command with ; in quotes is not this rule', {'command': "echo 'a; b'"}, 'pass')
check('a destructive statement with ; still asks', {'query': "delete from tasks where n='a; b'"}, 'ask')

check('UPDATE with a WHERE only inside a sub-select still asks', {'query': 'update tasks set a=(select 1 where true)'}, 'ask')
check('UPDATE with its own WHERE after a sub-select runs', {'query': 'update tasks set a=(select 1 where true) where id=1'}, 'pass')

check('UPDATE inside a CTE, WHERE only in the outer SELECT, asks', {'query': 'with u as (update t set a=1 returning *) select * from u where true'}, 'ask')
check('UPDATE inside a CTE with its own WHERE runs', {'query': 'with u as (update t set a=1 where id=1 returning *) select * from u where true'}, 'pass')

# tfugen-db rule 8: DO blocks hang the connector (03/10/2026)
check('a DO block is denied', {'query': "do $$ begin perform 1 end $$"}, 'deny')
check('a DO block in a migration is denied', {'name': 'm', 'query': "DO $x$ BEGIN PERFORM 1 END $x$"}, 'deny')
check('the word do inside a literal runs', {'query': "update docs set n='to do $5' where id='1'"}, 'pass')

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
