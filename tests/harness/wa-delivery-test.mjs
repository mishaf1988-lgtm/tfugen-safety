// Delivery statuses of WhatsApp messages to Michael (07/11/2026, ideas-lab 13; Michael in the questionnaire: "do it:
// delivery confirmation on WhatsApp"). _wa.js deliveryStatuses / failPlan / waDeliveryHandle / waFailFlush.
//
// 1. Parsing: only delivered and failed, only to the owner's number, a malformed id dropped, the error cut to size.
// 2. The plan: the first failure mails at once, more within FAIL_GAP_MS wait and go together; Friday and Saturday only urgent.
// 3. With fetch mocked: a failed status finds the text by wamid, logs, mails it to the connected mailbox once; a Meta retry
//    of the same status adds nothing; delivered is only logged; a second failure within the gap waits and the flush later
//    sends it; a mail that fails keeps the list and gives the claim back.
// 4. Wiring: wa-hook calls it only on a body with no messages (the inbound path is untouched), the watchdog flushes.
import fs from 'fs';
import { deliveryStatuses, failPlan, failAdd, failUrgent, failMailHtml, failMailSubject, failReason, waDeliveryHandle, waFailFlush, FAIL_KEY, FAIL_MAIL_KEY, FAIL_GAP_MS, FAIL_MAX, DELIVERY_EVENT, FAIL_MAIL_EVENT } from './_build/_wa.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const OWNER = '972501234567';
const W1 = 'wamid.HBgMOTcyNTAxMjM0NTY3FQIAERgSAAA1', W2 = 'wamid.HBgMOTcyNTAxMjM0NTY3FQIAERgSAAA2', W3 = 'wamid.HBgMOTcyNTAxMjM0NTY3FQIAERgSAAA3';
const st = (id, status, extra) => Object.assign({ id, status, timestamp: '1762500000', recipient_id: OWNER }, extra || {});
const body = (...s) => ({ object: 'whatsapp_business_account', entry: [{ id: 'x', changes: [{ field: 'messages', value: { statuses: s } }] }] });
const FAILED = (id) => st(id, 'failed', { errors: [{ code: 131047, title: 'Re-engagement message' }] });

// ---------- 1. parsing ----------
console.log('\n1. parsing the statuses');
{
  const b = body(st(W1, 'sent'), st(W2, 'read'), st(W1, 'delivered'), FAILED(W3), st(W2, 'failed', { recipient_id: '972500000000' }),
    st('bad id <script>', 'failed'), st(W2, 'failed', { errors: [{ code: 'x', title: '<b>' + 'a'.repeat(300) }] }));
  const l = deliveryStatuses(b, OWNER);
  check('delivered and failed only, to the owner only, malformed id dropped', l.length === 3 && l.map((x) => x.status).join(',') === 'delivered,failed,failed', l);
  check('the code and the time are read', l[1].code === 131047 && l[1].at === '2025-11-07T07:20:00.000Z', l[1]);
  check('a non-number code is null, the title loses < > and is cut to 160', l[2].code === null && !/[<>]/.test(l[2].title) && l[2].title.length <= 160, l[2]);
  check('no owner number = nothing', deliveryStatuses(b, '').length === 0);
  check('a body with messages only = nothing', deliveryStatuses({ entry: [{ changes: [{ value: { messages: [{ id: 'a', from: OWNER }] } }] }] }, OWNER).length === 0);
  check('the owner number is compared as digits (+972...)', deliveryStatuses(body(FAILED(W1)), '+972-50-1234567').length === 1);
}

// ---------- 2. the plan ----------
console.log('\n2. when to mail');
const THU = Date.parse('2026-11-05T10:00:00Z'), SAT = Date.parse('2026-11-07T10:00:00Z');
{
  const list = JSON.stringify([{ wamid: W1, kind: 'reminder' }, { wamid: W2, kind: 'hazard' }]);
  check('weekday, no mail before: both now', failPlan(list, 0, THU).send.length === 2);
  check('weekday, a mail 3 minutes ago: wait', failPlan(list, THU - 3 * 60000, THU).send.length === 0 && failPlan(list, THU - 3 * 60000, THU).wait === true);
  check('weekday, a mail 11 minutes ago: both now', failPlan(list, THU - 11 * 60000, THU).send.length === 2);
  check('Saturday: only the urgent one (hazard), the reminder waits', failPlan(list, 0, SAT).send.map((x) => x.wamid).join() === W2);
  check('Saturday, only a reminder: nothing, weekend flag', failPlan(JSON.stringify([{ wamid: W1, kind: 'reminder' }]), 0, SAT).send.length === 0 && failPlan(JSON.stringify([{ wamid: W1, kind: 'reminder' }]), 0, SAT).weekend === true);
  check('urgent: reply, hazard, incident, watchdog, sign, unknown or missing kind; not reminder, done, agent, morning',
    ['reply', 'hazard', 'incident', 'watchdog', 'sign', null, 'xyz'].every(failUrgent) && !['reminder', 'done', 'agent', 'morning'].some(failUrgent));
  const many = failAdd('[]', Array.from({ length: FAIL_MAX + 5 }, (_, i) => ({ wamid: 'wamid.' + 'A'.repeat(10) + i })));
  check('failAdd: one per wamid, at most FAIL_MAX', many.length === FAIL_MAX && failAdd(JSON.stringify([{ wamid: W1 }]), [{ wamid: W1 }]).length === 1);
  check('reason: 131047 is the closed window in Hebrew, other codes name Meta and the code', /חלון 24/.test(failReason({ code: 131047 })) && /131026/.test(failReason({ code: 131026, title: 't' })));
  const html = failMailHtml([{ at: '2026-11-05T10:00:00Z', code: 131047, text: 'a <b>x</b>\nline 2' }, { at: null, code: 1, text: '' }]);
  check('mail html: inline RTL, text escaped, a missing text says so, keyboard characters only',
    /^<div dir="rtl" style="direction:rtl;text-align:right/.test(html) && html.indexOf('&lt;b&gt;x&lt;/b&gt;') > 0 && html.indexOf('<b>x') < 0 && /לא נמצא/.test(html) && !/[–—‘’“”…]/.test(html));
  check('mail html: the time in Israel, DD/MM/YYYY', html.indexOf('05/11/2026 12:00') > 0);
  check('subject: one / several (with the number)', failMailSubject(1) !== failMailSubject(3) && failMailSubject(3).indexOf('3') === 0);
}

// ---------- 3. with fetch mocked ----------
console.log('\n3. end to end with a mocked database and mailbox');
const db = { state: {}, log: [], fail: false };
const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://sb.test' };
let mails = [], mailFail = false;
const deps = { accessToken: async () => ({ token: 't', email: 'me@x.il' }), sendMailTo: async (tok, to, cc, subject, html) => { if (mailFail) throw new Error('outlook 500'); mails.push({ to, subject, html }); return true; } };
let ver = 0;
const resp = (j, s = 200) => ({ ok: s < 300, status: s, json: async () => j, text: async () => JSON.stringify(j) });
globalThis.fetch = async (u, o = {}) => {
  const url = new URL(u), m = o.method || 'GET', p = url.pathname, q = url.searchParams;
  if (p.endsWith('/server_state') && db.stateDown && m !== 'GET') return resp({ error: 'down' }, 503);
  if (p.endsWith('/server_state')) {
    const key = (q.get('key') || '').replace(/^eq\./, '');
    if (m === 'GET') { const r = db.state[key]; return resp(r ? [{ value: r.value, updated_at: r.updated_at }] : []); }
    if (m === 'PATCH') { const r = db.state[key]; const want = (q.get('updated_at') || '').replace(/^eq\./, ''); if (!r || r.updated_at !== want) return resp([]); const b = JSON.parse(o.body); db.state[key] = { value: b.value, updated_at: new Date(Date.parse(b.updated_at) + (++ver)).toISOString() }; return resp([{ key }]); }
    if (m === 'POST') { const [b] = JSON.parse(o.body); if (db.state[b.key]) return resp([]); db.state[b.key] = { value: b.value, updated_at: b.updated_at }; return resp([{ key: b.key }]); }
  }
  if (p.endsWith('/notifications_log')) {
    if (m === 'GET') { const w = (q.get('payload->>wamid') || '').replace(/^eq\./, ''); return resp(db.log.filter((r) => r.payload && r.payload.wamid === w && /wa_out|assistant/.test(r.event_type)).slice(0, 1).map((r) => ({ event_type: r.event_type, payload: r.payload }))); }
    if (m === 'DELETE') { const id = decodeURIComponent((q.get('id') || '').replace(/^eq\./, '')); db.log = db.log.filter((r) => r.id !== id); return resp(null, 204); }
    if (m === 'POST') { const rows = JSON.parse(o.body); const out = []; rows.forEach((r) => { if (db.log.some((x) => x.id === r.id)) return; db.log.push(r); out.push(r); }); return resp(out, 201); }
  }
  return resp({ error: 'unexpected ' + m + ' ' + p }, 500);
};
(async () => {
  db.log.push({ id: 'wo1', event_type: 'wa_out', payload: { wamid: W1, text: 'reminder text one', okind: 'reminder' } });
  db.log.push({ id: 'wo2', event_type: 'wa_out', payload: { wamid: W2, text: 'hazard text two', okind: 'hazard' } });
  const r1 = await waDeliveryHandle(env, body(FAILED(W1)), OWNER, deps, THU);
  check('a failed status: logged, one mail to the connected mailbox with the text', r1 && r1.failed === 1 && mails.length === 1 && mails[0].to[0] === 'me@x.il' && mails[0].html.indexOf('reminder text one') > 0, { r1, mails: mails.length });
  check('the log row: wa_delivery, whatsapp_error, the wamid and the code', db.log.some((x) => x.event_type === DELIVERY_EVENT && x.channel === 'whatsapp_error' && x.payload.wamid === W1 && x.payload.code === 131047));
  check('the mail is logged (wa_fail_mail, email) and the pending list is empty', db.log.some((x) => x.event_type === FAIL_MAIL_EVENT && x.channel === 'email') && JSON.parse(db.state[FAIL_KEY].value).length === 0);
  const r2 = await waDeliveryHandle(env, body(FAILED(W1)), OWNER, deps, THU + 1000);
  check('Meta sends the same failed status again: nothing new, no second mail', r2.logged === 0 && mails.length === 1, r2);
  const r3 = await waDeliveryHandle(env, body(st(W2, 'delivered')), OWNER, deps, THU + 2000);
  check('delivered: only a log row (channel whatsapp), no mail', r3.logged === 1 && r3.failed === 0 && mails.length === 1 && db.log.some((x) => x.id === 'wdd-' + W2 && x.channel === 'whatsapp'));
  const r4 = await waDeliveryHandle(env, body(FAILED(W2)), OWNER, deps, THU + 60000);
  check('a second failure a minute later waits (no second mail yet)', mails.length === 1 && r4.flush && r4.flush.wait === true && JSON.parse(db.state[FAIL_KEY].value).length === 1, r4);
  const r5 = await waDeliveryHandle(env, body(FAILED(W3)), OWNER, deps, THU + 120000);
  check('a third failure: the text was not found, it waits with the second', mails.length === 1 && JSON.parse(db.state[FAIL_KEY].value).length === 2, r5);
  mailFail = true;
  const f0 = await waFailFlush(env, deps, THU + FAIL_GAP_MS + 1000);
  check('the flush after the gap, Outlook fails: error, list kept, claim given back', f0.error && JSON.parse(db.state[FAIL_KEY].value).length === 2 && Date.parse(JSON.parse(db.state[FAIL_MAIL_KEY].value).at) === THU, f0);
  mailFail = false;
  const f1 = await waFailFlush(env, deps, THU + FAIL_GAP_MS + 2000);
  check('the next flush: one mail with both, the list empty', f1.mailed === 2 && mails.length === 2 && mails[1].html.indexOf('hazard text two') > 0 && JSON.parse(db.state[FAIL_KEY].value).length === 0, f1);
  check('the joined mail says the content was not found for the third', /לא נמצא/.test(mails[1].html));
  const f2 = await waFailFlush(env, deps, THU + FAIL_GAP_MS + 3000);
  check('nothing pending: no mail', f2.pending === 0 && mails.length === 2);
  // security review 07/11/2026: the pending list cannot be written = the log row is taken back, so Meta's retry is not lost
  const W4 = 'wamid.HBgMOTcyNTAxMjM0NTY3FQIAERgSAAA4';
  db.stateDown = true;
  const r7 = await waDeliveryHandle(env, body(FAILED(W4)), OWNER, deps, THU + 3 * FAIL_GAP_MS);
  db.stateDown = false;
  check('list write fails: error, the log row taken back, no mail', r7.error && !db.log.some((x) => x.id === 'wdf-' + W4) && mails.length === 2, r7);
  const r8 = await waDeliveryHandle(env, body(FAILED(W4)), OWNER, deps, THU + 3 * FAIL_GAP_MS + 1000);
  check('...and Meta\'s retry of the same status is handled: logged and mailed', r8.logged === 1 && mails.length === 3, r8);
  // a status for a message to someone else (a trustee): nothing at all
  const before = db.log.length;
  const r6 = await waDeliveryHandle(env, body(st(W1, 'failed', { recipient_id: '972599999999' })), OWNER, deps, THU);
  check('a failed status of a message to someone else: not logged, not mailed', r6 === null && db.log.length === before && mails.length === 3);
  check('no service key: nothing', (await waDeliveryHandle({}, body(FAILED(W1)), OWNER, deps, THU)) === null);

  // ---------- 4. wiring ----------
  console.log('\n4. wiring');
  const hook = fs.readFileSync(new URL('../../functions/api/wa-hook.js', import.meta.url), 'utf8');
  const i = hook.indexOf('if (!msgs.length) {'), j = hook.indexOf('return;', i), call = hook.indexOf('waDeliveryHandle(env, body', i);
  check('wa-hook: called inside the no-messages branch only, wrapped in try', i > 0 && call > i && call < j && /try \{ await waDeliveryHandle\(/.test(hook) && hook.split('waDeliveryHandle(env').length === 2);
  const wd = fs.readFileSync(new URL('../../functions/_watchdog.js', import.meta.url), 'utf8');
  check('watchdog tick flushes what waited', /r\.wa_fail = await waFailFlush\(env, \{ accessToken, sendMailTo \}/.test(wd));
  const wa = fs.readFileSync(new URL('../../functions/_wa.js', import.meta.url), 'utf8');
  check('every send to Michael logs its wamid and kind (wa_out)', /wamid: \(r && r\.wamid\) \|\| null/.test(wa) && /okind: \(opts && opts\.kind\) \|\| null/.test(wa) && /okind: \(src && src\.kind\) \|\| null/.test(wa));
  check('no resend on WhatsApp from this path (no metaPost/sendToOwner in the delivery code)', !/metaPost|sendToOwner\(/.test(wa.slice(wa.indexOf('export const DELIVERY_EVENT'))));
  console.log('\nwa-delivery-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
