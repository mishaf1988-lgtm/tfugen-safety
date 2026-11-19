// The link to the maintenance ticket app (functions/api/maint-hook.js, 19/11/2026): which hazards open a ticket,
// that nothing leaves without the key, that the key goes only to the ticket app, and that the way back takes only a
// signed body about a ticket we opened, never closes the hazard, and tells Michael once.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const build = path.join(HERE, '_build', 'maint');
fs.mkdirSync(path.join(build, 'api'), { recursive: true });
const toMjs = (src) => src.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)\.js(['"])/g, '$1$2.mjs$3');
for (const d of ['', 'api']) for (const f of fs.readdirSync(path.join(ROOT, 'functions', d))) {
  if (f.endsWith('.js')) fs.writeFileSync(path.join(build, d, f.replace(/\.js$/, '.mjs')), toMjs(fs.readFileSync(path.join(ROOT, 'functions', d, f), 'utf8')));
}
const { onRequest, isMaint, ticketOf, photoOf, sigOk, isClosing, MAINT_URL } = await import(path.join(build, 'api', 'maint-hook.mjs'));

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const MAINT = 'אחזקה', ELEC = 'חשמל', MGR = 'מנהל המחלקה', OPEN = 'פתוח', CLOSED = 'סגור';
const row = (o) => Object.assign({ id: 'th-abc1', n: 7, d: '2026-11-20', dept: 'D', loc: 'L1', descr: 'a broken guard rail on the line', sev: 'S', resp: MAINT, resp2: null, action: '', due: '2026-11-30', s: OPEN, photo_url: null, notes: '' }, o);

console.log('pure');
check('maintenance and electricity count, a manager does not', isMaint(row({})) && isMaint(row({ resp: ELEC })) && !isMaint(row({ resp: MGR })));
check('"A + B" and resp2 count', isMaint(row({ resp: MGR + ' + ' + ELEC })) && isMaint(row({ resp: MGR, resp2: MAINT })));
check('a closed hazard gets no ticket', ticketOf(row({ s: CLOSED }), '2026-11-19') === null);
check('a hazard from before the first day gets no ticket', ticketOf(row({ d: '2026-11-18' }), '2026-11-19') === null);
check('no first day, no ticket', ticketOf(row({}), '') === null);
check('a bad id gets no ticket', ticketOf(row({ id: 'th-ABC/../x' }), '2026-11-19') === null);
const t = ticketOf(row({ action: 'fix it' }), '2026-11-19');
check('the ticket carries the fields of the ticket app', t && t.ext_id === 'th-abc1' && t.location === 'L1' && t.department === 'D' && t.due_date === '2026-11-30' && /fix it/.test(t.description), t);
check('a short description is padded to 10 characters', ticketOf(row({ descr: 'x' }), '2026-11-19').description.replace(/\s/g, '').length >= 10);
check('direction and control characters are removed', !/[‮\u0000]/.test(ticketOf(row({ descr: 'abc‮def\u0000ghijkl' }), '2026-11-19').description));
check('a photo goes only as a public link of our storage', photoOf({ photo_url: SB + '/storage/v1/object/public/incidents-photos/a.jpg' }, SB) && photoOf({ photo_url: 'https://evil.example/a.jpg' }, SB) === null && photoOf({ photo_url: SB + '/storage/v1/object/sign/x?token=1' }, SB) === null);
const mac = (s, raw) => crypto.createHmac('sha256', s).update(raw).digest('hex');
check('a right signature passes, with and without sha256=', await sigOk('k', '{"a":1}', mac('k', '{"a":1}')) && await sigOk('k', '{"a":1}', 'sha256=' + mac('k', '{"a":1}')));
check('a wrong, empty or other-body signature fails', !(await sigOk('k', '{"a":1}', mac('x', '{"a":1}'))) && !(await sigOk('k', '{"a":1}', '')) && !(await sigOk('k', '{"a":2}', mac('k', '{"a":1}'))) && !(await sigOk('', '{"a":1}', mac('', '{"a":1}'))));

console.log('requests');
let state = {}, rows = [], out = [], patches = [], metas = [], maintStatus = 200;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url); const m = opt.method || 'GET';
  if (url === MAINT_URL) { out.push({ key: (opt.headers || {})['X-Api-Key'], body: JSON.parse(opt.body) }); return new Response(JSON.stringify({ id: 'R-55' }), { status: maintStatus }); }
  if (url.startsWith(SB + '/rest/v1/server_state')) {
    if (m === 'POST') { JSON.parse(opt.body).forEach((r) => { if (!(/ignore-duplicates/.test((opt.headers || {}).Prefer || '') && r.key in state)) state[r.key] = r.value; }); return new Response('[{}]', { status: 201 }); }
    if (m === 'PATCH') { const k = decodeURIComponent(/key=eq\.([^&]*)/.exec(url)[1]); state[k] = JSON.parse(opt.body).value; return new Response('[{}]', { status: 200 }); }
    const ks = decodeURIComponent(/key=in\.\(([^)]*)\)/.exec(url)[1]).split(',');
    return new Response(JSON.stringify(ks.filter((k) => k in state).map((k) => ({ key: k, value: state[k], updated_at: '2026-01-01T00:00:00.000Z' }))), { status: 200 });
  }
  if (url.startsWith(SB + '/rest/v1/tour_hazards')) {
    if (m === 'PATCH') { const id = /id=eq\.([^&]*)/.exec(url)[1]; const b = JSON.parse(opt.body); patches.push({ id, b }); const r = rows.find((x) => x.id === id); if (r) Object.assign(r, b); return new Response(null, { status: 204 }); }
    const one = /id=eq\.([^&]*)/.exec(url);
    return new Response(JSON.stringify(one ? rows.filter((x) => x.id === one[1]) : rows.filter((x) => x.s === OPEN)), { status: 200 });
  }
  if (url.startsWith(SB + '/rest/v1/notification_prefs')) return new Response(JSON.stringify([{ prefs: { trustee_hazard: { whatsapp_to: '+972501234567' } } }]), { status: 200 });
  if (url.startsWith('https://graph.facebook.com/')) { metas.push(JSON.parse(opt.body)); return new Response(JSON.stringify({ messages: [{ id: 'wamid.M' }] }), { status: 200 }); }
  if (url.startsWith(SB + '/rest/v1/notifications_log') && m === 'GET') return new Response('[]', { status: 200 });
  return new Response('[]', { status: 200 });
};
const ENV = { TRUSTEE_NOTIFY_SECRET: 'sec', SUPABASE_SERVICE_ROLE_KEY: 'srv', META_PHONE_NUMBER_ID: 'P1', META_ACCESS_TOKEN: 'mt' };
const post = async (env, headers, raw, method) => { const r = await onRequest({ request: new Request('https://x/api/maint-hook', { method: method || 'POST', headers, body: method === 'GET' ? undefined : raw }), env }); return { status: r.status, j: await r.json().catch(() => null) }; };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

rows = [row({ d: today }), row({ id: 'th-mgr1', resp: MGR, d: today }), row({ id: 'th-old1', d: '2020-01-01' })];
let r = await post(ENV, { 'x-notify-secret': 'sec' }, '{"op":"push"}');
check('without the key nothing leaves', r.status === 200 && r.j.off === true && out.length === 0, r);
r = await post({ ...ENV, MAINT_API_KEY: 'KEY' }, { 'x-notify-secret': 'bad' }, '{"op":"push"}');
check('a wrong server secret is refused', r.status === 403 && out.length === 0, r);
r = await post({ ...ENV, MAINT_API_KEY: 'KEY' }, { 'x-notify-secret': 'sec' }, '{"op":"push"}');
check('one ticket: the maintenance hazard of today, not the manager\'s and not the old one', r.j.opened === 1 && out.length === 1 && out[0].body.ext_id === 'th-abc1' && out[0].key === 'KEY', { r, out });
check('the first day is remembered and the ticket number kept', state.maint_from === today && JSON.parse(state.maint_sent)['th-abc1'].ticket === 'R-55', state);
r = await post({ ...ENV, MAINT_API_KEY: 'KEY' }, { 'x-notify-secret': 'sec' }, '{"op":"push"}');
check('a second run opens nothing again', r.j.opened === 0 && out.length === 1, r);
rows.push(row({ id: 'th-new2', d: today, resp: ELEC })); maintStatus = 500;
for (let i = 0; i < 3; i++) r = await post({ ...ENV, MAINT_API_KEY: 'KEY' }, { 'x-notify-secret': 'sec' }, '{"op":"push"}');
check('a failing ticket app: nothing marked as sent, and Michael is told on the third failure, once', r.j.failed === 1 && !JSON.parse(state.maint_sent)['th-new2'] && metas.length === 1, { r, metas: metas.length });
maintStatus = 200; metas = [];
r = await post({ ...ENV, MAINT_API_KEY: 'KEY' }, { 'x-notify-secret': 'sec' }, '{"op":"push"}');
check('when it is back the waiting hazard goes', r.j.opened === 1 && JSON.parse(state.maint_sent)['th-new2'] && JSON.parse(state.maint_err).n === 0, r);

const E2 = { ...ENV, MAINT_HOOK_SECRET: 'HS' };
const body = JSON.stringify({ ext_id: 'th-abc1', status: 'closed', action_taken: 'rail replaced‮', handled_by: 'N', closed_at: '2026-11-21T10:00:00Z' });
r = await post(ENV, { 'x-signature': mac('HS', body) }, body);
check('the way back is off without its secret', r.status === 503, r);
r = await post(E2, {}, body);
check('no signature: refused', r.status === 403 && patches.length === 0, r);
r = await post(E2, { 'x-signature': mac('other', body) }, body);
check('a wrong signature: refused', r.status === 403 && patches.length === 0, r);
r = await post(E2, { 'x-signature': mac('HS', body) }, body.replace('th-abc1', 'th-mgr1'));
check('a signed body that was changed: refused', r.status === 403 && patches.length === 0, r);
const other = JSON.stringify({ ext_id: 'th-mgr1', status: 'closed' });
r = await post(E2, { 'x-signature': mac('HS', other) }, other);
check('a hazard we never sent: nothing written', r.status === 200 && patches.length === 0 && metas.length === 0, r);
const work = body.replace('"closed"', '"in work"');
r = await post(E2, { 'x-signature': mac('HS', work) }, work);
check('a signed update that is not a closing: acknowledged, nothing written, the closing still due', r.status === 200 && patches.length === 0 && metas.length === 0 && !state.maint_closed && isClosing('closed') && isClosing(undefined) && !isClosing('assigned'), r);
state.maint_push_lock = new Date().toISOString();
r = await post(E2, { 'x-signature': mac('HS', body) }, body);
check('a signed closing while a push holds its lock: taken all the same, a note on the hazard, which stays open', r.status === 200 && patches.length === 1, r);
check('a signed closing: a note on the hazard, which stays open', patches.length === 1 && Object.keys(patches[0].b).join() === 'notes' && /rail replaced/.test(patches[0].b.notes) && !/‮/.test(patches[0].b.notes) && rows[0].s === OPEN, { r, patches });
check('Michael is told once', metas.length === 1, metas.length);
r = await post(E2, { 'x-signature': mac('HS', body) }, body);
check('the same closing again changes nothing', r.status === 200 && patches.length === 1 && metas.length === 1, r);
delete state.maint_closed; rows[0].notes = 'x'.repeat(5000) + '\n' + patches[0].b.notes;
r = await post(E2, { 'x-signature': mac('HS', body) }, body);
check('the mark was lost but our note is on the row: no second note or message', r.status === 200 && patches.length === 1 && metas.length === 1 && !!state.maint_closed, r);
r = await post(E2, { 'x-signature': mac('HS', '[1]') }, '[1]');
check('a signed body that is not an object: 400', r.status === 400, r);
const big = JSON.stringify({ ext_id: 'th-abc1', x: 'a'.repeat(21000) });
r = await post(E2, { 'x-signature': mac('HS', big) }, big);
check('a body over the limit: 413', r.status === 413, r);
r = await post(E2, {}, '', 'GET');
check('GET is refused', r.status === 405, r);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
