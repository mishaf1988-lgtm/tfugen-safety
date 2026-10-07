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

print('\nPowerShell: the same rules as Bash (Move-Item / Remove-Item passed unchecked, 07/10/2026)')
OD = 'C:\\Users\\m\\OneDrive - Tapugan\\שולחן העבודה'
UP = OD + '\\סקילים להעלאה'
check('PowerShell passes with no command', 'PowerShell', 'pass')
check('Remove-Item on a OneDrive path is denied', 'PowerShell', 'deny', {'command': 'Remove-Item "%s\\ניהול בטיחות\\x.docx"' % OD})
check('Move-Item inside the safety folder is denied', 'PowerShell', 'deny', {'command': 'Move-Item -Path "%s\\ניהול בטיחות\\a.xlsx" -Destination "%s\\ניהול בטיחות\\ארכיון"' % (OD, OD)})
check('Rename-Item on a OneDrive path is denied', 'PowerShell', 'deny', {'command': 'Rename-Item "%s\\ניהול בטיחות\\a.xlsx" b.xlsx' % OD})
check('a pipeline that ends in Remove-Item is denied', 'PowerShell', 'deny', {'command': 'Get-ChildItem "%s\\ניהול בטיחות" -Filter *.tmp | Remove-Item' % OD})
check('the alias ri is denied', 'PowerShell', 'deny', {'command': 'ri "%s\\x.txt"' % OD})
check('[IO.File]::Delete is denied', 'PowerShell', 'deny', {'command': '[System.IO.File]::Delete("%s\\x.txt")' % OD})
check('Remove-Item in the repo passes', 'PowerShell', 'pass', {'command': 'Remove-Item -Recurse tests\\harness\\_build'})
check('Get-ChildItem of the OneDrive folder passes', 'PowerShell', 'pass', {'command': 'Get-ChildItem "%s"' % OD})
check('Invoke-RestMethod GET to Graph passes', 'PowerShell', 'pass', {'command': 'Invoke-RestMethod https://graph.microsoft.com/v1.0/me'})
check('Invoke-RestMethod -Method Post to Graph is denied', 'PowerShell', 'deny', {'command': 'Invoke-RestMethod -Uri https://graph.microsoft.com/v1.0/me/sendMail -Method Post -Body $b'})

print('\nm365-guard (4): inside "סקילים להעלאה" only moves between its subfolders and appending to יומן.txt')
check('a zip moved to הועלו passes', 'PowerShell', 'pass', {'command': 'Move-Item -LiteralPath "%s\\v25.zip" -Destination "%s\\הועלו\\"' % (UP, UP)})
check('a proposal moved to הועברו ל-repo passes', 'PowerShell', 'pass', {'command': 'Move-Item "%s\\ממתין למיזוג\\הצעה - 07-10-2026 12-00 - x.md" "%s\\הועברו ל-repo"' % (UP, UP)})
check('a move that keeps the file name passes', 'PowerShell', 'pass', {'command': 'Move-Item "%s\\v25.zip" "%s\\הועלו\\v25.zip"' % (UP, UP)})
check('the same in Bash passes', 'Bash', 'pass', {'command': 'mv "/c/Users/m/OneDrive/שולחן העבודה/סקילים להעלאה/v25.zip" "/c/Users/m/OneDrive/שולחן העבודה/סקילים להעלאה/הועלו/"'})
check('a move then a log line passes', 'PowerShell', 'pass', {'command': 'Move-Item "%s\\v25.zip" "%s\\הועלו"; Add-Content -Path "%s\\יומן.txt" -Value "07/10/2026 v25"' % (UP, UP, UP)})
check('a new subfolder passes', 'PowerShell', 'pass', {'command': 'New-Item -ItemType Directory "%s\\הועברו ל-repo"' % UP})
check('appending with >> passes', 'Bash', 'pass', {'command': 'echo "07/10/2026 ok" >> "/c/Users/m/OneDrive/שולחן העבודה/סקילים להעלאה/יומן.txt"'})
check('Out-File -Append passes', 'PowerShell', 'pass', {'command': '"07/10/2026 ok" | Out-File -Append -Encoding utf8 "%s\\יומן.txt"' % UP})
check('a delete there is denied', 'PowerShell', 'deny', {'command': 'Remove-Item "%s\\הועלו\\v24.zip"' % UP})
check('a rename there is denied', 'PowerShell', 'deny', {'command': 'Rename-Item "%s\\v25.zip" v26.zip' % UP})
check('a rename through Move-Item is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s\\v25.zip" "%s\\הועלו\\v26.zip"' % (UP, UP)})
check('a move out of the folder is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s\\v25.zip" "%s\\ניהול בטיחות"' % (UP, OD)})
check('a move out to a local folder is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s\\v25.zip" C:\\temp' % UP})
check('a move into the folder from elsewhere in OneDrive is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s\\ניהול בטיחות\\a.zip" "%s"' % (OD, UP)})
check('a move with -Force (overwrite) is denied', 'PowerShell', 'deny', {'command': 'Move-Item -Force "%s\\v25.zip" "%s\\הועלו"' % (UP, UP)})
check('a move through .. is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s\\v25.zip" "%s\\..\\ניהול בטיחות"' % (UP, UP)})
check('a move with a variable path is denied (cannot be checked)', 'PowerShell', 'deny', {'command': '$d = "%s"; Move-Item "%s\\v25.zip" $d' % (OD, UP)})
check('moving the folder itself is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s" "%s\\הועלו"' % (UP, UP)})
check('a move plus a delete in one command is denied', 'PowerShell', 'deny', {'command': 'Move-Item "%s\\a.zip" "%s\\הועלו"; Remove-Item "%s\\b.zip"' % (UP, UP, UP)})
check('Set-Content on יומן.txt is denied', 'PowerShell', 'deny', {'command': 'Set-Content "%s\\יומן.txt" "x"' % UP})
check('Clear-Content on יומן.txt is denied', 'PowerShell', 'deny', {'command': 'Clear-Content "%s\\יומן.txt"' % UP})
check('Out-File without -Append on יומן.txt is denied', 'PowerShell', 'deny', {'command': '"x" | Out-File "%s\\יומן.txt"' % UP})
check('> on יומן.txt is denied', 'Bash', 'deny', {'command': 'echo x > "/c/Users/m/OneDrive/שולחן העבודה/סקילים להעלאה/יומן.txt"'})

print('\nsettings.json: the hook is wired to PowerShell too')
import re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
with open(os.path.join(ROOT, '.claude', 'settings.json'), encoding='utf-8') as f:
    pre = json.load(f)['hooks']['PreToolUse']
ms = [e['matcher'] for e in pre if any('guard-365.py' in h.get('command', '') for h in e['hooks'])]
for tool in ['Bash', 'PowerShell', 'mcp__Microsoft_365__outlook_send_mail', 'mcp__ab12__onedrive_move_item']:
    got = 'pass' if any(re.fullmatch(m, tool) for m in ms) else 'missing'
    if got == 'pass':
        ok += 1; print('  ✓ guard-365 runs on ' + tool)
    else:
        bad += 1; print('  ✗ guard-365 does not run on ' + tool)

print('\n%d passed, %d failed' % (ok, bad))
sys.exit(1 if bad else 0)
