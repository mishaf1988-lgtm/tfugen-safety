# Unit test of tools/vm-notifier/notify.py with requests + sending mocked.
import importlib.util, json, os, sys, tempfile, types
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools', 'vm-notifier'))
spec = importlib.util.spec_from_file_location('notify', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools', 'vm-notifier', 'notify.py'))
notify = importlib.util.module_from_spec(spec); spec.loader.exec_module(notify)
from datetime import datetime, timedelta, timezone
passed = failed = 0
def check(label, cond, detail=None):
    global passed, failed
    if cond: passed += 1; print('  ✓ ' + label)
    else: failed += 1; print('  ✗ ' + label + ('  -> ' + json.dumps(detail, ensure_ascii=False, default=str) if detail is not None else ''))

class R:
    def __init__(self, status, payload): self.status_code = status; self._p = payload; self.ok = 200 <= status < 300; self.text = json.dumps(payload)
    def json(self): return self._p

tmp = tempfile.mkdtemp(); notify.STATE_PATH = os.path.join(tmp, 'state.json')
now = datetime.now(timezone.utc)
rows = [
    {'id': 'h1', 'u': 'דנה', 't': 5, 'd': '2026-09-19', 'loc': 'מחסן · הידרנט', 'f': 'ללא פלומבה', 'ok': False, 's': 'פתוח', 'photo_url': 'https://x/p.jpg', 'ts': (now - timedelta(hours=1)).isoformat()},
]
calls = {'get': [], 'post': [], 'sent': []}
signups = {'n': 0}
def fake_post(url, **kw):
    calls['post'].append((url, kw.get('params'), kw.get('json')))
    if url.endswith('/auth/v1/signup'):
        signups['n'] += 1; return R(200, {'access_token': 'tok%d' % signups['n'], 'refresh_token': 'ref', 'expires_in': 3600})
    if url.endswith('/auth/v1/token'):
        return R(200, {'access_token': 'tok-refreshed', 'refresh_token': 'ref2', 'expires_in': 3600})
    return R(500, {})
def fake_get(url, **kw):
    calls['get'].append((url, kw.get('params'), kw.get('headers')))
    if getattr(fake_get, 'fail401', False): fake_get.fail401 = False; return R(401, {'message': 'expired'})
    return R(200, list(rows))
notify.requests = types.SimpleNamespace(get=fake_get, post=fake_post)
cfg = {'supabase_url': 'https://sb.example', 'supabase_key': 'anon', 'app_url': 'https://tapugan-safety.pages.dev', 'to': 'sviva@tapugan.co.il', 'mode': 'smtp', 'poll_seconds': 60}
def fake_sender(cfg, subject, html, text):
    if getattr(fake_sender, 'boom', False): raise RuntimeError('smtp down')
    calls['sent'].append((subject, html, text))

print('\n1. session + query')
sess = notify.Session(cfg['supabase_url'], cfg['supabase_key'])
state, sent, seeded = notify.poll_once(cfg, sess, None, sender=fake_sender)
g = calls['get'][-1]
check('anonymous sign-in once, then the read carries the session token + apikey', signups['n'] == 1 and g[2]['Authorization'] == 'Bearer tok1' and g[2]['apikey'] == 'anon', g[2])
check('query: hazards only (ok=eq.false), last 48h, oldest first', g[1]['ok'] == 'eq.false' and g[1]['ts'].startswith('gte.') and g[1]['order'] == 'ts.asc', g[1])
check('first run: existing hazard remembered, nothing sent, state saved', sent == 0 and seeded == 1 and state['seen'].get('h1') == 'seeded' and not calls['sent'] and os.path.exists(notify.STATE_PATH), state)

print('\n2. a new hazard → one e-mail, once')
rows.append({'id': 'h2', 'u': 'יוסי', 't': 3, 'd': '2026-09-19', 'loc': 'אולם טיגון', 'f': 'דלת חירום חסומה', 'ok': False, 's': 'פתוח', 'photo_url': None, 'ts': now.isoformat()})
rows.append({'id': 'ok1', 'u': 'יוסי', 't': 2, 'd': '2026-09-19', 'loc': 'x', 'f': None, 'ok': True, 's': 'תקין', 'photo_url': None, 'ts': now.isoformat()})
state, sent, _ = notify.poll_once(cfg, sess, state, sender=fake_sender)
subj, html, text = calls['sent'][-1]
check('exactly one e-mail for h2 (h1 already known, ok1 not a hazard)', sent == 1 and len(calls['sent']) == 1 and 'h2' in state['seen'], {'sent': sent, 'seen': list(state['seen'])})
check('subject + body: trustee, task name, location, finding, app link; no photo line when there is none', 'יוסי' in subj and 'דרכי מילוט' in subj and 'אולם טיגון' in html and 'דלת חירום חסומה' in html and 'tapugan-safety.pages.dev' in html and '📷' not in html and 'דלת חירום' in text, subj)
state, sent, _ = notify.poll_once(cfg, sess, state, sender=fake_sender)
check('next round: nothing new → nothing sent; session token reused (no second sign-in)', sent == 0 and len(calls['sent']) == 1 and signups['n'] == 1, {'signups': signups['n']})
h1 = [r for r in rows if r['id'] == 'h1'][0]
s1, h1html, _ = notify.build_email(h1, cfg['app_url'])
check('a hazard with a photo gets the photo link; HTML is escaped', 'x/p.jpg' in h1html and '📷' in h1html and '<script' not in notify.build_email({'id': 'z', 'u': '<script>', 't': 1, 'f': 'a<b', 'loc': 'l', 'd': 'd'}, cfg['app_url'])[1], None)

print('\n3. send failures: retried, then given up after the cap; 401 → re-login')
rows.append({'id': 'h3', 'u': 'רון', 't': 6, 'd': '2026-09-19', 'loc': 'ייצור', 'f': 'מגן מנוטרל', 'ok': False, 's': 'פתוח', 'photo_url': None, 'ts': now.isoformat()})
fake_sender.boom = True
for i in range(notify.MAX_SEND_ATTEMPTS - 1):
    state, sent, _ = notify.poll_once(cfg, sess, state, sender=fake_sender)
check('while the mailer is down the row is NOT marked seen and the failure counter grows', 'h3' not in state['seen'] and state['fails']['h3'] == notify.MAX_SEND_ATTEMPTS - 1 and len(calls['sent']) == 1, state['fails'])
fake_sender.boom = False
state, sent, _ = notify.poll_once(cfg, sess, state, sender=fake_sender)
check('mailer back → the pending hazard is sent and the counter cleared', sent == 1 and 'h3' in state['seen'] and 'h3' not in state['fails'], state)
rows.append({'id': 'h4', 'u': 'לב', 't': 1, 'd': '2026-09-19', 'loc': 'x', 'f': 'y', 'ok': False, 's': 'פתוח', 'photo_url': None, 'ts': now.isoformat()})
fake_sender.boom = True
for i in range(notify.MAX_SEND_ATTEMPTS):
    state, sent, _ = notify.poll_once(cfg, sess, state, sender=fake_sender)
check('after the cap the row is given up (marked seen) so the loop never spins on it', 'h4' in state['seen'] and len(calls['sent']) == 2, {'seen': list(state['seen'])})
fake_sender.boom = False
fake_get.fail401 = True
try:
    notify.poll_once(cfg, sess, state, sender=fake_sender); ok401 = False
except RuntimeError as e:
    ok401 = '401' in str(e)
state, sent, _ = notify.poll_once(cfg, sess, state, sender=fake_sender)
check('a 401 invalidates the session; the next round refreshes/relogs and continues', ok401 and (calls['get'][-1][2]['Authorization'] in ('Bearer tok-refreshed', 'Bearer tok2')), calls['get'][-1][2])

print('\n4. state file survives a restart and prunes old ids')
state['seen']['old'] = (now - timedelta(days=notify.PRUNE_DAYS + 1)).isoformat()
notify.save_state(state)
st2 = notify.load_state()
check('reload: recent ids kept, seeded ids kept, ids older than the prune window dropped', 'h2' in st2['seen'] and st2['seen']['h1'] == 'seeded' and 'old' not in st2['seen'], list(st2['seen']))

print('\n5. config validation')
def cfgfile(d):
    p = os.path.join(tmp, 'c.json'); open(p, 'w', encoding='utf-8').write(json.dumps(d)); return p
try: notify.load_config(cfgfile({'supabase_url': 'u', 'supabase_key': 'k', 'to': 'a@b', 'mode': 'smtp', 'smtp': {'host': 'h', 'port': 465, 'user': 'u'}})); bad = False
except SystemExit as e: bad = 'smtp.password' in str(e)
check('smtp mode without a password is refused with the field named', bad)
c = notify.load_config(cfgfile({'supabase_url': 'u', 'supabase_key': 'k', 'to': 'a@b', 'mode': 'outlook'}))
check('outlook mode needs no smtp block; defaults filled (app_url, poll 60s)', c['app_url'].startswith('https://tapugan-safety') and c['poll_seconds'] == 60)

print('\n%d passed, %d failed' % (passed, failed)); sys.exit(1 if failed else 0)
