# The worker -> session map lives in one place, meta/workers in the office's db (18/10/2026).
# The weekly rotation (routine-rotation.md) gives every worker a new session on Fridays, so a
# session id written into the office page or the courier's instructions is stale within a week:
# on 18/10/2026 the same five ids had to be fixed in three files in one day.
import os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + str(detail) if detail is not None else ''))

ID = re.compile(r'session_0[0-9A-Za-z]{10,}')
FILES = ['project-files/agent-office-page.txt', 'project-files/routine-chat-relay.md', 'project-files/routine-rotation.md']
def ids(text): return sorted(set(ID.findall(text)))

for rel in FILES:
    found = ids(open(os.path.join(ROOT, rel), encoding='utf-8').read())
    check(rel + ': no session id (they come from meta/workers)', found == [], found)

page = open(os.path.join(ROOT, FILES[0]), encoding='utf-8').read()
check('the office page reads meta/workers', "db.doc('meta/workers')" in page)
relay = open(os.path.join(ROOT, FILES[1]), encoding='utf-8').read()
# 18/10/2026, lesson 117 (lessons-archive.md): the watch was missing for an hour and two messages waited 3 hours.
check('the courier renews the ArtifactComments watch every round', '0א.' in relay and 'ArtifactComments watch' in relay)
check('a relayed message is re-checked after 10 minutes', '1א.' in relay and 'delay_minutes 10' in relay)
rot = open(os.path.join(ROOT, FILES[2]), encoding='utf-8').read()
check('early rotation: the courier asks, the recruiter does it', '[החלפה מוקדמת]' in relay and '[החלפה מוקדמת]' in rot and 'meta/workers.recruiter' in relay)
check('self: an id is caught', ids("var SESS={'x':'session_01JT8Fct6Z6Qv2GbaBBqxtQT'}") == ['session_01JT8Fct6Z6Qv2GbaBBqxtQT'])
check('self: a placeholder is not', ids('send_message to session_<id>') == [])
print('\nworker-map-test: %d passed, %d failed' % (passed, failed))
raise SystemExit(1 if failed else 0)
