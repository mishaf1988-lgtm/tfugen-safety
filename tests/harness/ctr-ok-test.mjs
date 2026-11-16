// The contractor link, stage 2 (16/11/2026, DECISIONS "קישור קבלן שלב 2"): after a send Michael gets "בצע" / "לא" on
// WhatsApp; yes puts the contractor into the register (table ctr) for a year or until the job ends, an existing one is
// updated (same company number or the very same name), a similar name is asked; a second tap answers "already approved".
// No asks for the reason, then makes a draft to the contractor with a fresh link, and the page keeps what was typed.
// The morning update asks again what is still waiting and makes a new link 30 days before a permanent year ends.
// Mocked network, nothing leaves.
import { ctrRefOf, ctrEnd, ctrAskText, normName, matchCtr, ctrNewRow, ctrUpdate, renewDue, ctrDraftBody, fastCtrOk, fastCtrMatch, fastCtrReason, ctrAsk, ctrMorning,
  CTR_S_OK, CTR_S_REJ, CTR_RENEW_KEY, CTR_TRAINED } from './_build/_ctrok.mjs';
import { fastRoute, aboutLine } from './_build/wa-hook.mjs';
import { formHtml, readCtrToken, ctrDeps } from './_build/ctr-link.mjs';
import { CTR_STATE } from './_build/_ctr.mjs';
import { ATTACH_SAID_RE } from './_build/routine-db.mjs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', ROUTINE_KEY: 'k-123', WEEKEND_QUIET: 'off' };
const WA = Object.assign({}, ENV, { META_PHONE_NUMBER_ID: '123', META_ACCESS_TOKEN: 'tok' });
const BAD = /[—–־«»“”‘’→←…]/;
const NOW = Date.now();
const il = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const today = il(NOW);
const addD = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// ---------- the fake database ----------
const db = { state: {}, ctr: [], logs: [], meta: [], talks: [] };
const reset = () => Object.assign(db, { state: {}, ctr: [], logs: [], meta: [], talks: [] });
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]*)').exec(u); return m ? decodeURIComponent(m[1]) : null; };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  if (u.startsWith(SB + '/rest/v1/server_state')) {
    if (m === 'GET') { const k = (q(u, 'key') || '').slice(3); return json(db.state[k] ? [{ key: k, value: db.state[k].value, updated_at: db.state[k].updated_at }] : []); }
    const rows = JSON.parse(init.body);
    if (m === 'PATCH') {
      const k = q(u, 'key').slice(3), at = q(u, 'updated_at');
      if (!db.state[k] || (at && db.state[k].updated_at !== at.slice(3))) return json([]);
      db.state[k] = { value: rows.value, updated_at: rows.updated_at }; return json([{ key: k }]);
    }
    const r = rows[0];
    if (db.state[r.key] && /ignore-duplicates/.test((init.headers && init.headers.Prefer) || '')) return json([]);
    db.state[r.key] = { value: r.value, updated_at: r.updated_at || new Date().toISOString() }; return json([{ key: r.key }]);
  }
  if (u.startsWith(SB + '/rest/v1/ctr')) {
    if (m === 'GET') return json(db.ctr.map((x) => ({ ...x })));
    if (m === 'PATCH') { const id = q(u, 'id').slice(3); const r = db.ctr.find((x) => x.id === id); if (r) Object.assign(r, JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    for (const r of JSON.parse(init.body)) { const i = db.ctr.findIndex((x) => x.id === r.id); if (i >= 0) db.ctr[i] = r; else db.ctr.push(r); }
    return new Response(null, { status: 201 });
  }
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) { if (m === 'POST') db.talks.push(...JSON.parse(init.body)); return json([], 201); }
  if (u.startsWith(SB + '/rest/v1/notification_prefs')) return json([{ prefs: { trustee_hazard: { whatsapp_to: '972500000000' } } }]);
  if (u.startsWith(SB + '/rest/v1/notifications_log')) { if (m === 'POST') db.logs.push(...JSON.parse(init.body)); return json([]); }
  if (u.startsWith('https://graph.facebook.com/')) { db.meta.push(JSON.parse(init.body)); return json({ messages: [{ id: 'wamid.T' + db.meta.length }] }); }
  return json([]);
};
const put = (list) => { db.state[CTR_STATE] = { value: JSON.stringify(list), updated_at: '2026-11-16T00:00:00Z' }; };
const ent = (id) => JSON.parse(db.state[CTR_STATE].value).find((x) => x.id === id);
const filled = (o) => Object.assign({ id: 'cabc1234', kind: 'perm', ins: true, ds: null, de: null, company: 'אלקטרו בע"מ', created_at: new Date(NOW - 864e5).toISOString(), exp: new Date(NOW + 9 * 864e5).toISOString(),
  status: 'filled', talk: 'ctr-cabc1234', at: new Date(NOW - 3600e3).toISOString(), cnum: '515151515', contact: 'דני כהן', mobile: '0501234567', email: 'dani@example.com',
  works: ['elc', 'hgt'], place: null, desc: 'החלפת לוח חשמל', signer: 'דני כהן', workers: 2, files: 3, form: 'https://x/146.pdf' }, o || {});

(async () => {
  console.log('\n1. pure parts');
  check('the ref from the tapped message', JSON.stringify(ctrRefOf('ctra', 'assistant | text | ref ctra:cabc1234 | 2026-11-16T08:00:00Z', null)) === JSON.stringify({ rid: 'cabc1234', by: 'about' }));
  check('the ref from the newest message', JSON.stringify(ctrRefOf('ctrr', '', { ref: 'ctrr:cabc1234' })) === JSON.stringify({ rid: 'cabc1234', by: 'prev' }));
  check('another kind is not taken', ctrRefOf('ctra', '', { ref: 'ctrr:cabc1234' }) === null && ctrRefOf('ctra', 'x | ref del:abcdefgh | t', { ref: 'ctra:cabc1234' }) === null);
  check('perm: a year from now', ctrEnd({ kind: 'perm' }, NOW) === il(NOW + 365 * 864e5));
  check('temp: the job\'s last day', ctrEnd({ kind: 'temp', de: '2026-12-01' }, NOW) === '2026-12-01');
  const ask = ctrAskText(filled(), NOW);
  check('the question names the company, the works and the date', ask.indexOf('אלקטרו') >= 0 && ask.indexOf('עבודות חשמל') >= 0 || ask.indexOf('חשמל') >= 0, ask);
  check('the question: no company number, keyboard characters only', ask.indexOf('515151515') < 0 && !BAD.test(ask), ask);
  check('normName drops quotes and בע"מ', normName('אלקטרו בע"מ') === normName('  אלקטרו  ') && normName('א.ב. שירותים') === 'א ב שירותים');
  const rows = [{ id: 'ctr26-1', n: 'אלקטרו', cid: null }, { id: 'ctr26-2', n: 'גגות הצפון', cid: '515151515' }, { id: 'ctr26-3', n: 'מנופי יוסי בע"מ', cid: '111111111' }];
  check('match by company number and name', JSON.stringify(matchCtr(rows, { cnum: '515151515', company: 'גגות הצפון בע"מ' })) === JSON.stringify({ id: 'ctr26-2', how: 'cid' }));
  check('another contractor\'s number under a different name is asked, not updated (security review)', (matchCtr(rows, { cnum: '515151515', company: 'אלקטרו' }).similar || {}).id === 'ctr26-2');
  check('match by the very same name', JSON.stringify(matchCtr(rows, { cnum: '222222222', company: 'אלקטרו בע"מ' })) === JSON.stringify({ id: 'ctr26-1', how: 'name' }));
  check('the same name with another company number is asked', !!matchCtr(rows, { cnum: '999999999', company: 'מנופי יוסי' }).similar);
  check('a similar name is asked', matchCtr(rows, { cnum: '', company: 'אלקטרו חשמל' }).similar.id === 'ctr26-1');
  check('no match = a new row', matchCtr(rows, { cnum: '', company: 'צבע ושיפוצים' }).none === true);
  const nr = ctrNewRow(Object.assign(filled(), { until: '2027-11-16' }));
  check('a new row: trained, active, its end date, the form', nr.tr === CTR_TRAINED && nr.s === 'פעיל' && nr.e === '2027-11-16' && nr.file_url === 'https://x/146.pdf' && /^קבוע: /.test(nr.ty) && nr.cid === '515151515', nr);
  check('an update links the newest signed form', ctrUpdate({ e: '2027-12-31', file_url: 'old' }, Object.assign(filled(), { form: 'new-form', until: '2027-11-16' })).file_url === 'new-form');
  check('an update never shortens the date', ctrUpdate({ e: '2027-12-31' }, Object.assign(filled({ kind: 'temp' }), { until: '2026-12-01' })).e === undefined);
  check('an update lengthens the date and keeps a known company number', (() => { const p = ctrUpdate({ e: '2026-01-01', cid: '333' }, Object.assign(filled(), { until: '2027-11-16' })); return p.e === '2027-11-16' && p.cid === undefined && p.tr === CTR_TRAINED; })());
  const rr = [{ id: 'a', ty: 'קבוע: עבודות חשמל', e: addD(today, 10), s: 'פעיל' }, { id: 'b', ty: 'זמני: גגות', e: addD(today, 10) }, { id: 'c', ty: 'קבוע', e: addD(today, 40) }, { id: 'd', ty: 'קבוע', e: addD(today, 5) }];
  check('renewal: permanent, within 30 days, not done yet', JSON.stringify(renewDue(rr, today, { d: addD(today, 5) }).map((x) => x.id)) === '["a"]');
  const body = ctrDraftBody(filled(), 'חסר רישיון חשמלאי', 'https://l', '2026-11-30');
  check('the draft does not trip the "file attached" gate of mail_draft', !ATTACH_SAID_RE.test(body));
  check('the draft: the reason, the link, the date, keyboard only', body.indexOf('חסר רישיון חשמלאי') >= 0 && body.indexOf('https://l') >= 0 && body.indexOf('30/11/2026') >= 0 && !BAD.test(body));

  console.log('\n2. the fast route');
  const about = aboutLine({ event_type: 'assistant', payload: { title: 'x', ref: 'ctra:cabc1234' }, ts: '2026-11-16T08:00:00Z' });
  check('a tap on בצע', JSON.stringify(fastRoute({ text: '1. בצע', choice: 1 }, about, null)) === JSON.stringify({ kind: 'ctr_ok', id: 'cabc1234', yes: true }));
  check('a tap on לא', fastRoute({ text: '2. לא', choice: 2 }, about, null).yes === false);
  check('a bare "בצע" that only follows the question is not an approval', (() => { const r = fastRoute({ text: 'בצע' }, '', { ref: 'ctra:cabc1234', text: 'קבלן שלח' }); return !r || r.kind !== 'ctr_ok'; })());
  check('the reason after the reason question', JSON.stringify(fastRoute({ text: 'חסר רישיון חשמלאי לעובד השני' }, '', { ref: 'ctrr:cabc1234', text: 'מה לא תקין' })) === JSON.stringify({ kind: 'ctr_reason', id: 'cabc1234', text: 'חסר רישיון חשמלאי לעובד השני' }));
  check('a question after the reason question goes to the assistant', (() => { const r = fastRoute({ text: 'מה דחוף היום?' }, '', { ref: 'ctrr:cabc1234' }); return !r || r.kind !== 'ctr_reason'; })());
  check('a reply to another message is not a reason', (() => { const r = fastRoute({ text: 'מה דחוף היום' }, 'assistant | y | ref del:abcdefgh | t', { ref: 'ctrr:cabc1234' }); return !r || r.kind !== 'ctr_reason'; })());
  const aboutM = aboutLine({ event_type: 'assistant', payload: { title: 'x', ref: 'ctrm:cabc1234' }, ts: 't' });
  check('a tap on "same contractor"', JSON.stringify(fastRoute({ text: '1. אותו קבלן', choice: 1 }, aboutM, null)) === JSON.stringify({ kind: 'ctr_match', id: 'cabc1234', n: 1 }));

  console.log('\n3. approve: a new contractor, then a second tap');
  reset(); put([filled()]);
  let r = await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  check('a new row in the register', db.ctr.length === 1 && db.ctr[0].tr === CTR_TRAINED && db.ctr[0].e === il(NOW + 365 * 864e5), db.ctr);
  check('the entry approved and linked to the row', ent('cabc1234').status === CTR_S_OK && ent('cabc1234').reg === db.ctr[0].id, ent('cabc1234'));
  check('the answer says added, until when, and the renewal', /נוסף/.test(r.text) && r.text.indexOf('30 יום') >= 0 && !BAD.test(r.text), r.text);
  r = await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  check('a second tap: already approved, nothing written again', /כבר אושר/.test(r.text) && db.ctr.length === 1, r.text);
  reset(); put([filled({ files: null })]);
  r = await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  check('a send still being saved is not approved', db.ctr.length === 0 && ent('cabc1234').status === 'filled', r.text);
  reset(); put([]);
  check('an unknown request', /כבר לא נמצאת/.test((await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW)).text));

  console.log('\n4. approve: an existing contractor, and a similar name');
  reset(); put([filled()]); db.ctr = [{ id: 'ctr26-9', n: 'אלקטרו', cid: '515151515', e: null, tr: null, s: 'פעיל', file_url: 'https://old' }];
  r = await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  check('the row is updated, not added, with the newest form', db.ctr.length === 1 && db.ctr[0].tr === CTR_TRAINED && db.ctr[0].e === il(NOW + 365 * 864e5) && db.ctr[0].file_url === 'https://x/146.pdf' && /עודכן/.test(r.text), db.ctr);
  check('the answer names the row that was updated', r.text.indexOf('אושר. אלקטרו עודכן') === 0, r.text);
  reset(); put([filled({ cnum: '' })]); db.ctr = [{ id: 'ctr26-4', n: 'אלקטרו חשמל ותאורה', cid: null, e: null }];
  r = await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  check('a similar name: asked, nothing written', r.choices && r.choices.length === 2 && r.ref === 'ctrm:cabc1234' && db.ctr.length === 1 && db.ctr[0].tr === undefined, r);
  r = await fastCtrMatch(ENV, { id: 'cabc1234', n: 2 });
  check('"new contractor": a new row', db.ctr.length === 2 && ent('cabc1234').reg === db.ctr[1].id, db.ctr);
  r = await fastCtrMatch(ENV, { id: 'cabc1234', n: 1 });
  check('the match question answers once', db.ctr.length === 2 && /כבר נרשם/.test(r.text), r.text);
  reset(); put([filled({ cnum: '' })]); db.ctr = [{ id: 'ctr26-4', n: 'אלקטרו חשמל ותאורה', cid: null, e: null }];
  await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  await fastCtrMatch(ENV, { id: 'cabc1234', n: 1 });
  check('"same contractor": that row is updated', db.ctr.length === 1 && db.ctr[0].tr === CTR_TRAINED, db.ctr);
  reset(); put([filled({ kind: 'temp', ds: today, de: addD(today, 5) })]);
  await fastCtrOk(ENV, { id: 'cabc1234', yes: true }, NOW);
  check('temp: until the job ends, marked temporary', db.ctr[0].e === addD(today, 5) && /^זמני/.test(db.ctr[0].ty), db.ctr[0]);

  console.log('\n5. no, the reason, the draft, the page');
  reset(); put([filled()]);
  r = await fastCtrOk(ENV, { id: 'cabc1234', yes: false }, NOW);
  check('no: the reason is asked', r.ref === 'ctrr:cabc1234' && ent('cabc1234').status === CTR_S_REJ && db.ctr.length === 0, r);
  const drafts = [];
  r = await fastCtrReason(ENV, { id: 'cabc1234', text: 'חסר רישיון חשמלאי' }, NOW, { draft: async (b) => { drafts.push(b); return { ok: true }; } });
  const e5 = ent('cabc1234');
  check('the request is open again with the reason and what was typed', e5.status === 'sent' && e5.rej === 'חסר רישיון חשמלאי' && e5.files === null && e5.at === null && e5.cnum === '515151515', e5);
  check('one draft to the contractor, with the reason and a working link', drafts.length === 1 && drafts[0].to === 'dani@example.com' && drafts[0].agent === 'ctr-link' && drafts[0].body.indexOf('חסר רישיון חשמלאי') >= 0, drafts);
  const link = (/https:\/\/\S+ctr-link\?k=(\S+)/.exec(drafts[0].body) || [])[1];
  const tok = link ? await readCtrToken(ENV, decodeURIComponent(link), NOW + 864e5) : { error: 'none' };
  check('the fresh link reads as the same request', tok.rid === 'cabc1234', tok);
  check('Michael is told the draft waits for him', /טיוטה/.test(r.text) && !BAD.test(r.text), r.text);
  const html = formHtml({ kind: 'perm' }, e5, 'TOK', 'הוראות');
  check('the page shows the reason and keeps the details', html.indexOf('צריך לתקן') >= 0 && html.indexOf('value="515151515"') >= 0 && html.indexOf('value="dani@example.com"') >= 0 && html.indexOf('החלפת לוח חשמל</textarea>') >= 0 && /value="elc" class="wk" checked/.test(html), html.slice(0, 300));
  check('a fresh request page has no reason and no old values', (() => { const h = formHtml({ kind: 'perm' }, { company: 'X' }, 'TOK', 'הוראות'); return h.indexOf('צריך לתקן') < 0 && !/class="wk" checked/.test(h) && h.indexOf('</textarea>') > 0; })());
  r = await fastCtrReason(ENV, { id: 'cabc1234', text: 'שוב' }, NOW, { draft: async () => ({ ok: true }) });
  check('a second reason finds nothing waiting', /כבר לא נמצאת/.test(r.text));
  reset(); put([filled({ email: 'not-an-email', status: CTR_S_REJ, rej_at: new Date(NOW).toISOString() })]);
  r = await fastCtrReason(ENV, { id: 'cabc1234', text: 'חסר ביטוח' }, NOW, { draft: async () => ({ ok: true }) });
  check('no valid mail: the link is given to Michael to forward', /ctr-link\?k=/.test(r.text) && /אין מייל/.test(r.text), r.text);
  reset(); put([filled({ status: CTR_S_REJ, rej_at: new Date(NOW - 30 * 3600e3).toISOString() })]);
  check('a reason after a day is not taken', /כבר לא נמצאת/.test((await fastCtrReason(ENV, { id: 'cabc1234', text: 'חסר' }, NOW, {})).text));

  console.log('\n6. the WhatsApp question and the morning update');
  reset(); put([filled()]);
  const closed = await ctrAsk(WA, 'cabc1234', NOW);
  check('a closed window: the template, and how to answer without buttons', closed.ok && db.meta[0].type === 'template' && JSON.stringify(db.meta[0]).indexOf('בצע או לא') >= 0, db.meta[0]);
  reset(); put([filled()]); db.state.wa_owner_in_at = { value: new Date(NOW - 3600e3).toISOString(), updated_at: 'x' };
  let a = await ctrAsk(WA, 'cabc1234', NOW);
  const logged = db.logs.find((x) => x.event_type === 'assistant');
  check('the question goes out with two buttons', a.ok && db.meta.length === 1 && db.meta[0].type === 'interactive', db.meta[0]);
  check('it is logged with its ref and wamid, so the tap finds it', logged && logged.payload.ref === 'ctra:cabc1234' && /^wamid\./.test(logged.payload.wamid), logged);
  check('the ask time is kept', !!ent('cabc1234').ask_at);
  let mo = await ctrMorning(WA, new Date(NOW));
  check('the morning: not asked again within the day', mo.asked === 0, mo);
  mo = await ctrMorning(WA, new Date(NOW + 21 * 3600e3));
  check('the next morning: asked again', mo.asked === 1 && db.meta.length === 2, mo);
  check('ctrDeps asks after a send', ctrDeps.ask === ctrAsk);
  reset(); put([filled({ status: CTR_S_OK, until: addD(today, 365) })]); db.ctr = [];
  mo = await ctrMorning(WA, new Date(NOW));
  check('an approval without a register row is written in the morning', mo.reg === 1 && db.ctr.length === 1, mo);
  reset(); put([filled({ status: CTR_S_OK, reg: 'ctr26-9', ins: true })]); db.ctr = [{ id: 'ctr26-9', n: 'אלקטרו', ty: 'קבוע: עבודות חשמל', e: addD(today, 20), s: 'פעיל' }];
  mo = await ctrMorning(WA, new Date(NOW));
  const renewMsg = db.meta.map((x) => JSON.stringify(x)).join(' ');
  check('30 days before: a new link to forward, with insurance as before', mo.renew === 1 && db.talks.length === 1 && /ctr-link\?k=/.test(renewMsg) && JSON.parse(db.state[CTR_STATE].value)[0].ins === true, mo);
  check('it is marked for that date', JSON.parse(db.state[CTR_RENEW_KEY].value)['ctr26-9'] === addD(today, 20));
  mo = await ctrMorning(WA, new Date(NOW + 864e5));
  check('the next morning: no second link', mo.renew === 0 && db.talks.length === 1, mo);
  reset(); put([]); db.ctr = [{ id: 'ctr26-9', n: 'אלקטרו', ty: 'קבוע', e: addD(today, 20), s: 'פעיל' }];
  mo = await ctrMorning(ENV, new Date(NOW));
  check('a renewal whose message failed keeps its link', mo.renew === 0 && db.talks.length === 1 && typeof JSON.parse(db.state[CTR_RENEW_KEY].value)['ctr26-9'] === 'object', mo);
  mo = await ctrMorning(WA, new Date(NOW + 864e5));
  check('the next morning sends that link, not a new one', mo.renew === 1 && db.talks.length === 1 && JSON.parse(db.state[CTR_RENEW_KEY].value)['ctr26-9'] === addD(today, 20), mo);

  console.log(`\nctr-ok-test.mjs            ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e && e.stack); process.exit(1); });
