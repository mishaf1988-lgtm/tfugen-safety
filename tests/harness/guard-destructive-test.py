#!/usr/bin/env python3
"""guard-destructive.py (29/10/2026): infrastructure delete, pause and deploy tools are denied by the words in
the tool name (a UUID prefix or a renamed server does not matter); reads, SQL, merges of pull requests and the
trigger tools used by the session chain pass. Also: settings.json wires the hook with a matcher that covers
every denied name. Runs the real hook on stdin.
"""
import json, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
HOOK = os.path.join(ROOT, '.claude', 'hooks', 'guard-destructive.py')
ok = bad = 0


def decision(name):
    out = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': name, 'tool_input': {}}),
                         capture_output=True, text=True, encoding='utf-8').stdout.strip() or '{}'
    return (json.loads(out).get('hookSpecificOutput') or {}).get('permissionDecision', 'pass')


def check(label, cond, detail=None):
    global ok, bad
    if cond:
        ok += 1; print('  ✓ ' + label)
    else:
        bad += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))


DENY = []
for srv in ['Cloudflare_Developer_Platform', 'b78e97f4-33ab-440a-bf52-9987f0912dd6']:
    for t in ['d1_database_delete', 'd1_database_create', 'kv_namespace_delete', 'kv_namespace_update', 'r2_bucket_delete', 'r2_bucket_create',
              'hyperdrive_config_delete', 'hyperdrive_config_edit']:
        DENY.append('mcp__%s__%s' % (srv, t))
for srv in ['Supabase', '04d8a04f-6f61-4d02-bce2-b8291da71c88']:
    for t in ['delete_branch', 'pause_project', 'restore_project', 'reset_branch', 'rebase_branch', 'merge_branch', 'create_project',
              'deploy_edge_function', 'create_edge_function_secret']:
        DENY.append('mcp__%s__%s' % (srv, t))
DENY.append('mcp__github__delete_file')
PASS = ['mcp__Supabase__execute_sql', 'mcp__Supabase__apply_migration', 'mcp__Supabase__list_tables', 'mcp__Supabase__get_advisors',
        'mcp__Supabase__create_branch', 'mcp__Cloudflare_Developer_Platform__d1_databases_list', 'mcp__Cloudflare_Developer_Platform__r2_bucket_get',
        'mcp__Cloudflare_Developer_Platform__kv_namespaces_list', 'mcp__Cloudflare_Developer_Platform__workers_get_worker_code',
        'mcp__github__merge_pull_request', 'mcp__github__create_pull_request', 'mcp__github__create_or_update_file', 'mcp__github__push_files',
        'mcp__github__get_file_contents', 'mcp__claude-code-remote__delete_trigger', 'mcp__claude-code-remote__archive_session',
        'mcp__claude-code-remote__send_later', 'mcp__Microsoft_365__outlook_email_search', 'Bash', 'Read', 'Artifact']

print('denied')
for n in DENY:
    check(n, decision(n) == 'deny', decision(n))
print('pass')
for n in PASS:
    check(n, decision(n) == 'pass', decision(n))
print('bad input does not break a call')
r = subprocess.run([sys.executable, HOOK], input='not json', capture_output=True, text=True)
check('not JSON: no output, exit 0', r.returncode == 0 and r.stdout.strip() == '', r.stdout + r.stderr)

print('settings.json wires it')
s = json.load(open(os.path.join(ROOT, '.claude', 'settings.json'), encoding='utf-8'))
wired = [h for h in s['hooks']['PreToolUse'] if any('guard-destructive.py' in x.get('command', '') for x in h['hooks'])]
check('one PreToolUse entry runs guard-destructive.py', len(wired) == 1, len(wired))
if wired:
    m = re.compile('^(?:' + wired[0]['matcher'] + ')$')
    check('its matcher covers every denied tool name', all(m.match(n) for n in DENY), [n for n in DENY if not m.match(n)])
    # The matcher may be wider than the hook's own words (d1_databases_list matches "d1_database"): the hook is the judge, tested above.
print('%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
