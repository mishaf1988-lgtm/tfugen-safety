#!/usr/bin/env python3
"""The WhatsApp assistant does a worker's task itself, from that worker's routine file
(20/10/2026, Michael: "I want it to work immediately"). The map of worker -> files sits in
routine-wa-assistant.md, step 2. A new routine-*.md that is not in the map leaves the assistant
unable to find it. Every routine file is in the map, or in NOT_WORKER with the reason."""
import os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PF = os.path.join(ROOT, 'project-files')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

NOT_WORKER = {
    'routine-wa-assistant.md': 'the assistant itself',
    'routine-chat-relay.md': 'the postman, delivers only',
    'routine-rotation.md': 'the recruiter, replaces sessions',
    'routine-db-columns.md': 'replaced by a database cron (03/10/2026)',
    'routine-night.md': 'the night code round, development',
    'routine-dev-fire.md': 'immediate development per request, takes no worker tasks (21/10/2026)',
    'routine-worker-now.md': 'the worker on demand, takes one task as the named worker (21/10/2026)',
    'routine-dev-runner.md': 'the on-duty developer, code requests every two hours (21/10/2026)',
    'routine-mail-triage.md': 'the daily mail scan, one message to Michael; "more mails" goes to the assistant itself (25/10/2026)',
    'routine-quality.md': 'the daily quality checker, reads what was sent and reports in the morning update (27/10/2026)',
    'routine-additions-log.md': 'writes the day\'s merged additions to Michael\'s log page each evening, takes no tasks (27/10/2026)',
}
wa = open(os.path.join(PF, 'routine-wa-assistant.md'), encoding='utf-8').read()
line = next((l for l in wa.split('\n') if l.startswith('   - **משימה של עובד')), '')
check('the worker-task step exists in routine-wa-assistant.md', bool(line))
mapped = set(re.findall(r'routine-[a-z0-9-]+\.md', line))
files = sorted(f for f in os.listdir(PF) if re.fullmatch(r'routine-[a-z0-9-]+\.md', f))
missing = [f for f in files if f not in mapped and f not in NOT_WORKER]
check('every routine-*.md is in the map or in NOT_WORKER', not missing, missing)
gone = sorted(f for f in mapped if f not in files)
check('every file in the map exists', not gone, gone)
check('a file is not both mapped and excluded', not (mapped & set(NOT_WORKER)), sorted(mapped & set(NOT_WORKER)))
# breaking it on purpose: a new file nobody mapped must fail
fake = files + ['routine-new-worker.md']
check('a new unmapped file is caught', [f for f in fake if f not in mapped and f not in NOT_WORKER] == ['routine-new-worker.md'])
print('\n%d passed, %d failed' % (passed, failed))
raise SystemExit(1 if failed else 0)
