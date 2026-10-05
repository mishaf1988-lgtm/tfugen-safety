#!/usr/bin/env python3
"""guard-365.py: Michael's rules for the Microsoft 365 connector (05/10/2026): reads pass,
drafts and safety-folder writes ask (his word), sends, deletes, moves, Teams and calendar
writes and files outside the safety folder are denied. Runs the real hook on stdin.
"""
import json, os, subprocess, sys

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.claude', 'hooks', 'guard-365.py')
ok = bad = 0
SAFE = 'שולחן העבודה/ניהול בטיחות/13_ועדה/x.xlsx'


def decision(name, tool_input=None):
    out = subprocess.run([sys.executable, HOOK], input=json.dumps({'tool_name': name, 'tool_input': tool_input or {}}, ensure_ascii=False),
                         capture_output=True, text=True, encoding='utf-8').stdout.strip() or '{}'
    return (json.loads(out).get('hookSpecificOutput') or {}).get('permissionDecision', 'pass')


def check(label, name, want, tool_input=None):
    global ok, bad
    got = decision(name, tool_input)
    if got == want:
        ok += 1; print('  ✓ ' + label)
    else:
        bad += 1; print('  ✗ %s  -> %s (want %s)' % (label, got, want))


print('reads pass')
for n in ['mcp__Microsoft_365__outlook_email_search', 'mcp__Microsoft_365__read_resource', 'mcp__Microsoft_365__sharepoint_folder_search',
          'mcp__Microsoft_365__teams_list_chats', 'mcp__Microsoft_365__get_me', 'mcp__Microsoft_365__outlook_find_available_time',
          'mcp__1a2b3c__outlook_calendar_search', 'mcp__Microsoft_365__search_people', 'mcp__Microsoft_365__get_granted_scopes']:
    check(n.split('__')[-1], n, 'pass')

print('\nnever: send, delete, move, share')
for n in ['mcp__Microsoft_365__outlook_send_mail', 'mcp__Microsoft_365__outlook_reply_email', 'mcp__Microsoft_365__outlook_forward_email',
          'mcp__Microsoft_365__outlook_delete_email', 'mcp__Microsoft_365__onedrive_delete_item',           'mcp__Microsoft_365__sharepoint_share_file', 'mcp__Microsoft_365__outlook_send_draft', 'mcp__9f8e__teams_send_chat_message',
          'mcp__Microsoft_365__teams_reply_channel_message', 'mcp__Microsoft_365__outlook_cancel_event', 'mcp__Microsoft_365__onedrive_rename_item']:
    check(n.split('__')[-1] + ' denied', n, 'deny')
check('a send with a path inside the safety folder is still denied', 'mcp__Microsoft_365__outlook_send_mail', 'deny', {'attachment': SAFE})
check('mailbox settings (forwarding rules) are denied', 'mcp__Microsoft_365__outlook_update_mailbox_settings', 'deny')
check('a mail rule is denied', 'mcp__Microsoft_365__outlook_create_rule', 'deny')

print('\nmove: only into the למחיקה folder, with "בצע"')
check('a move elsewhere is denied', 'mcp__Microsoft_365__onedrive_move_item', 'deny', {'itemId': 'x', 'destination': 'שולחן העבודה/ארכיון'})
check('a move into למחיקה asks', 'mcp__Microsoft_365__onedrive_move_item', 'ask', {'itemId': 'x', 'destination': 'שולחן העבודה/ניהול בטיחות/למחיקה'})
check('a mail moved into למחיקה asks', 'mcp__Microsoft_365__outlook_move_email', 'ask', {'id': 'm1', 'folder': 'למחיקה'})
check('a copy outside asks nothing: denied', 'mcp__Microsoft_365__onedrive_copy_item', 'deny', {'to': 'x'})

print('\nTeams and calendar: read only')
for n in ['mcp__Microsoft_365__teams_create_chat', 'mcp__Microsoft_365__outlook_create_event', 'mcp__Microsoft_365__outlook_update_event',
          'mcp__Microsoft_365__teams_post_channel_message'.replace('post', 'create')]:
    check(n.split('__')[-1] + ' denied', n, 'deny')

print('\nallowed only with "בצע": drafts and safety-folder files')
check('a mail draft asks', 'mcp__Microsoft_365__outlook_create_draft', 'ask')
check('a draft with a UUID prefix asks', 'mcp__ab12cd__outlook_create_draft', 'ask')
check('a file written inside the safety folder asks', 'mcp__Microsoft_365__onedrive_upload_file', 'ask', {'path': SAFE, 'content': 'x'})
check('a file updated inside the safety folder asks', 'mcp__Microsoft_365__sharepoint_update_file', 'ask', {'uri': 'file:///drv/' + SAFE})
check('a file written outside the safety folder is denied', 'mcp__Microsoft_365__onedrive_upload_file', 'deny', {'path': 'שולחן העבודה/פרטי/x.xlsx'})
check('a file write with no path at all asks (the prompt shows it)', 'mcp__Microsoft_365__onedrive_create_file', 'ask', {'name': 'x.txt'})
check('an unknown 365 tool asks (fail safe)', 'mcp__Microsoft_365__graph_request', 'ask')

print('\nnot the 365 connector: untouched')
for n in ['mcp__github__create_pull_request', 'mcp__Supabase__execute_sql', 'Bash', 'mcp__github__delete_file']:
    check(n + ' passes', n, 'pass')

print('\nBash: the synced OneDrive folder and curl to Graph')
check('rm inside the synced OneDrive folder is denied', 'Bash', 'deny', {'command': 'rm -rf "/c/Users/m/OneDrive/שולחן העבודה/ניהול בטיחות/13_ועדה"'})
check('mv inside the safety folder is denied', 'Bash', 'deny', {'command': 'mv "ניהול בטיחות/a.xlsx" "ניהול בטיחות/b.xlsx"'})
check('Remove-Item on a OneDrive path is denied', 'Bash', 'deny', {'command': 'Remove-Item "C:\\Users\\m\\OneDrive\\x.docx"'})
check('rm in the repo passes', 'Bash', 'pass', {'command': 'rm -rf tests/harness/_build'})
check('a commit message that mentions rm/mv and OneDrive passes (prose, not a command)', 'Bash', 'pass', {'command': 'git commit -F - <<EOF\nrm/mv on an OneDrive path are blocked\nEOF'})
check('ls of the OneDrive folder passes', 'Bash', 'pass', {'command': 'ls "OneDrive/שולחן העבודה"'})
check('curl GET to Graph passes', 'Bash', 'pass', {'command': 'curl -s https://graph.microsoft.com/v1.0/me'})
check('curl POST sendMail to Graph is denied', 'Bash', 'deny', {'command': 'curl -X POST https://graph.microsoft.com/v1.0/me/sendMail -d @m.json'})
check('curl DELETE to Graph is denied', 'Bash', 'deny', {'command': 'curl --request DELETE https://graph.microsoft.com/v1.0/me/drive/items/1'})
check('curl -d to Graph (a write) is denied', 'Bash', 'deny', {'command': 'curl https://graph.microsoft.com/v1.0/me/drive/root/children --data "{}"'})

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
