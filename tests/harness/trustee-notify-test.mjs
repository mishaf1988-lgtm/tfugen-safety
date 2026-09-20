// Unit test of the REAL trustee-notify function with fetch mocked: the DB
// lookups, the atomic claim, template fallback, recipients from prefs, test mode.
import { onRequest } from './_build/trustee-notify.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
function world(opts) {
  const calls = [];
  const st = { row: opts.row, prefs: opts.prefs, claimed: false, dedicatedMissing: opts.dedicatedMissing !== false, metaFail: opts.metaFail, resendOk: opts.resendOk !== false, authOk: opts.authOk !== false };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const method = (init && init.method) || 'GET'; const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ u, method, body, headers: init && init.headers });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.startsWith(SB + '/auth/v1/user')) return json(st.authOk ? { id: 'u1', email: 'admin@tfugen.local', is_anonymous: false } : { error: 'bad' }, st.authOk ? 200 : 401);
    if (u.startsWith(SB + '/rest/v1/trustee_reports?id=eq.') && method === 'GET') return json(st.row ? [st.row] : []);
    if (u.startsWith(SB + '/rest/v1/trustee_reports?id=eq.') && method === 'PATCH') { if (st.claimed || !st.row || st.row.notified_at) return json([]); st.claimed = true; return json([{ id: st.row.id }]); }
    if (u.startsWith(SB + '/rest/v1/notification_prefs')) return json(st.prefs ? [{ prefs: st.prefs }] : []);
    if (u.startsWith(SB + '/rest/v1/notifications_log')) return new Response('', { status: 201 });
    if (u.includes('graph.facebook.com')) {
      if (st.metaFail) return json({ error: { code: 190, message: 'Invalid OAuth access token' } }, 401);
      if (body.template.name === 'tfugen_trustee_hazard' && st.dedicatedMissing) return json({ error: { code: 132001, message: 'Template name does not exist in the translation' } }, 404);
      return json({ messages: [{ id: 'wamid.1' }] });
    }
    if (u.includes('api.resend.com')) return st.resendOk ? json({ id: 'em_1' }) : new Response('{"message":"nope"}', { status: 422 });
    throw new Error('unexpected fetch ' + u);
  };
  return { calls, st };
}
const env = { SUPABASE_SERVICE_ROLE_KEY: 'svc', META_PHONE_NUMBER_ID: 'pn', META_ACCESS_TOKEN: 'tok', RESEND_KEY: 'rk' };
const req = (body, headers) => new Request('https://tapugan-safety.pages.dev/api/trustee-notify', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev', ...(headers || {}) }, body: JSON.stringify(body) });
const fresh = () => ({ id: 'r1', u: 'דנה', t: 5, d: '2026-09-19', loc: 'מחסן · הידרנט', f: 'ללא פלומבה', ok: false, s: 'פתוח', photo_url: 'https://x/p.jpg', ts: new Date().toISOString(), notified_at: null });
const prefsOn = { trustee_hazard: { whatsapp: true, whatsapp_to: '972-50-1234567', email: true, email_to: 'sviva@tapugan.co.il' } };

(async () => {
  console.log('\n1. happy path: hazard → claim → WhatsApp (fallback template) + email → log');
  { const w = world({ row: fresh(), prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'r1' }), env }); const j = await r.json();
    const meta = w.calls.filter(c => c.u.includes('graph.facebook.com')); const resend = w.calls.find(c => c.u.includes('resend')); const log = w.calls.find(c => c.u.includes('notifications_log'));
    check('200, whatsapp sent, email sent', r.status === 200 && j.ok && j.whatsapp === 'sent' && j.email === 'sent', j);
    check('dedicated template tried first, then the approved incident template with location / "ליקוי נאמן" / finding', meta.length === 2 && meta[0].body.template.name === 'tfugen_trustee_hazard' && meta[1].body.template.name === 'tfugen_incident_alert' && meta[1].body.to === '972501234567' && meta[1].body.template.components[0].parameters.map(p => p.text).join('|') === 'מחסן · הידרנט|ליקוי נאמן בטיחות — דנה, עמדות כיבוי אש|ללא פלומבה', meta.map(m => m.body.template));
    check('email to the saved address with trustee, task, location, finding, photo link and the app link', resend && resend.body.to[0] === 'sviva@tapugan.co.il' && /דנה/.test(resend.body.subject) && /הידרנט/.test(resend.body.html) && /ללא פלומבה/.test(resend.body.html) && /x\/p\.jpg/.test(resend.body.html) && /tapugan-safety\.pages\.dev/.test(resend.body.html), resend && resend.body.subject);
    check('two log rows (whatsapp, email) written by the server', log && log.body.length === 2 && log.body.map(x => x.channel).join() === 'whatsapp,email' && log.body[0].event_type === 'trustee_hazard', log && log.body);
    check('the claim is a PATCH guarded by notified_at=is.null', w.calls.some(c => c.method === 'PATCH' && /notified_at=is\.null/.test(c.u) && c.body.notified_at), w.calls.filter(c => c.method === 'PATCH').map(c => c.u)); }
  console.log('\n2. once only, and the guards');
  { const w = world({ row: Object.assign(fresh(), { notified_at: '2026-09-19T08:00:00Z' }), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('already notified → skipped, no Meta / Resend call', j.skipped === 'already notified' && !w.calls.some(c => /facebook|resend/.test(c.u)), j); }
  { const w = world({ row: fresh(), prefs: prefsOn }); w.st.claimed = true; const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('claim lost (another worker got there first) → skipped, nothing sent', j.skipped === 'already notified' && !w.calls.some(c => /facebook|resend/.test(c.u)), j); }
  { const w = world({ row: Object.assign(fresh(), { ok: true, s: 'תקין' }), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('a תקין report is never sent', j.skipped === 'not a hazard' && !w.calls.some(c => /facebook|resend/.test(c.u)), j); }
  { const w = world({ row: Object.assign(fresh(), { ts: '2026-01-01T00:00:00Z' }), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('an old row (replayed webhook) is not sent', j.skipped === 'too old', j); }
  { const w = world({ row: null, prefs: prefsOn }); const r = await onRequest({ request: req({ id: 'nope' }), env }); check('unknown id → 404', r.status === 404); }
  { const r = await onRequest({ request: req({}), env }); check('missing id → 400', r.status === 400); }
  { const r = await onRequest({ request: req({ id: 'r1;drop' }), env }); check('odd id characters → 400', r.status === 400); }
  { const w = world({ row: fresh(), prefs: null }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('no recipient saved yet → skipped and NOT claimed (so it sends once Michael sets a number)', j.skipped === 'no recipient configured' && !w.st.claimed, j); }
  { const w = world({ row: fresh(), prefs: { trustee_hazard: { whatsapp: false, whatsapp_to: '972501234567', email: false, email_to: 'a@b.c' } } }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    check('channels unticked in the matrix → nothing sent even with addresses', j.skipped === 'no recipient configured', j); }
  { const w = world({ row: fresh(), prefs: { trustee_hazard: { whatsapp: true, whatsapp_to: '972501234567' } }, metaFail: true }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json();
    const log = w.calls.find(c => c.u.includes('notifications_log'));
    check('Meta failure is reported and logged as whatsapp_error; email not configured is not attempted', /error: Meta 401/.test(j.whatsapp) && !j.email && log.body[0].channel === 'whatsapp_error', j); }
  { const w = world({ row: fresh(), prefs: prefsOn }); const j = await (await onRequest({ request: req({ id: 'r1' }), env: { ...env, TRUSTEE_NOTIFY_SECRET: 's3' } })).json();
    check('with a secret configured, a call without the header is refused', j.error === 'forbidden'); 
    const j2 = await (await onRequest({ request: req({ id: 'r1' }, { 'x-notify-secret': 's3' }), env: { ...env, TRUSTEE_NOTIFY_SECRET: 's3' } })).json();
    check('…and accepted with it', j2.ok === true && j2.whatsapp === 'sent', j2); }
  { const r = await onRequest({ request: req({ id: 'r1' }), env: { META_ACCESS_TOKEN: 'x' } }); check('missing service key → 500', r.status === 500); }
  { const w = world({ row: fresh(), prefs: prefsOn, dedicatedMissing: false }); const j = await (await onRequest({ request: req({ id: 'r1' }), env })).json(); const meta = w.calls.filter(c => c.u.includes('graph.facebook.com'));
    check('once the dedicated template exists it is used directly: trustee / task — location / finding', j.whatsapp === 'sent' && meta.length === 1 && meta[0].body.template.name === 'tfugen_trustee_hazard' && meta[0].body.template.components[0].parameters.map(p => p.text).join('|') === 'דנה|עמדות כיבוי אש — מחסן · הידרנט|ללא פלומבה', meta.map(m => m.body.template)); }
  console.log('\n3. test mode from the settings screen');
  { const r = await onRequest({ request: req({ test: true, whatsapp_to: '972501234567' }), env }); check('test without a session → 401', r.status === 401); }
  { const w = world({ authOk: false }); const r = await onRequest({ request: req({ test: true, whatsapp_to: '972501234567' }, { Authorization: 'Bearer bad' }), env }); check('test with a bad session → 401', r.status === 401); }
  { const w = world({}); const r = await onRequest({ request: req({ test: true, whatsapp: true, whatsapp_to: '+972 50-123 4567', email: true, email_to: 'me@tapugan.co.il' }, { Authorization: 'Bearer good' }), env }); const j = await r.json(); const meta = w.calls.filter(c => c.u.includes('graph.facebook.com')); const resend = w.calls.find(c => c.u.includes('resend'));
    check('test: uses the numbers typed on the screen (digits only), sends the sample to both channels, does not touch trustee_reports', r.status === 200 && j.test && j.whatsapp === 'sent' && j.email === 'sent' && meta[meta.length - 1].body.to === '972501234567' && /בדיקה/.test(meta[meta.length - 1].body.template.components[0].parameters[2].text) && resend.body.to[0] === 'me@tapugan.co.il' && !w.calls.some(c => c.u.includes('trustee_reports')), j); }
  { const w = world({}); const r = await onRequest({ request: req({ test: true }, { Authorization: 'Bearer good' }), env }); check('test with no recipient → 400 with a clear message', r.status === 400); }
  { const w = world({}); const j = await (await onRequest({ request: req({ test: true, email: true, email_to: 'me@tapugan.co.il' }, { Authorization: 'Bearer good' }), env: { SUPABASE_SERVICE_ROLE_KEY: 'svc' } })).json();
    check('email without RESEND_KEY says exactly what is missing', /RESEND_KEY/.test(j.email), j); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
