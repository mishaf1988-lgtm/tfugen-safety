// The morning update on WhatsApp from the server (20/10/2026): pg_cron calls /api/wa-morning twice,
// only the call on 07:xx in Israel on Sunday-Thursday sends, once a day, to Michael's number only.
import { onRequest, run, buildBrief, agentName, dueNow, ilDay, MAX_CHARS, LAST_KEY, calendarPlan, eventDay, OD_CAL, CAL_KEY, CAL_MAX } from './_build/wa-morning.mjs';
import { OD_ROOT } from './_build/routine-db.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co', OWNER = '972501234567';
const ENV = { TRUSTEE_NOTIFY_SECRET: 'sec', SUPABASE_SERVICE_ROLE_KEY: 'srv', META_PHONE_NUMBER_ID: 'P1', META_ACCESS_TOKEN: 'mt' };
let state = {}, metas = [], logs = [], docs = [], equip = [], puts = [], putFail = 0;
globalThis.fetch = async (url, opt = {}) => {
  const m = opt.method || 'GET';
  if (url.startsWith(SB + '/rest/v1/oauth_tokens')) return new Response(JSON.stringify([{ user_email: 'm', refresh_token: 'r', access_token: 'AT', expires_at: new Date(Date.now() + 3600000).toISOString(), scope: '' }]), { status: 200 });
  if (url.startsWith('https://graph.microsoft.com/') && m === 'PUT') {
    if (putFail && puts.length >= putFail - 1) return new Response(JSON.stringify({ error: { code: 'x' } }), { status: 503 });
    puts.push({ url, body: opt.body }); return new Response(JSON.stringify({ webUrl: 'w', size: 1 }), { status: 201 });
  }
  if (url.startsWith(SB + '/rest/v1/notification_prefs')) return new Response(JSON.stringify([{ prefs: { trustee_hazard: { whatsapp_to: '+' + OWNER } } }]), { status: 200 });
  if (url.startsWith(SB + '/rest/v1/server_state')) {
    if (m === 'POST') { JSON.parse(opt.body).forEach((r) => { state[r.key] = r.value; }); return new Response('', { status: 201 }); }
    const k = /key=eq\.([^&]*)/.exec(url)[1];
    return new Response(JSON.stringify(k in state ? [{ value: state[k] }] : []), { status: 200 });
  }
  if (url.startsWith(SB + '/rest/v1/docs')) return new Response(JSON.stringify(docs), { status: 200 });
  if (url.startsWith(SB + '/rest/v1/equip_inspections')) return new Response(JSON.stringify(equip), { status: 200 });
  if (url.startsWith(SB + '/rest/v1/notifications_log')) { logs.push(...JSON.parse(opt.body)); return new Response('', { status: 201 }); }
  if (url.startsWith('https://graph.facebook.com/')) { metas.push(JSON.parse(opt.body)); return new Response(JSON.stringify({ messages: [{ id: 'wamid.M' }] }), { status: 200 }); }
  return new Response('[]', { status: 200 });
};
const call = async (body, secret) => (await onRequest({ request: new Request('https://x/api/wa-morning', { method: 'POST', headers: secret === null ? {} : { 'x-notify-secret': secret || 'sec' }, body: JSON.stringify(body || {}) }), env: ENV })).json();

(async () => {
  console.log('\n1. when it sends');
  check('Monday 07:47 Israel in summer (04:47 UTC): due', dueNow(new Date('2026-10-19T04:47:00Z')));
  check('...and the 05:47 UTC call that day (08:47 Israel): not due', !dueNow(new Date('2026-10-19T05:47:00Z')));
  check('in winter 05:47 UTC is 07:47 Israel: due', dueNow(new Date('2026-11-02T05:47:00Z')));
  check('...and 04:47 UTC (06:47): not due', !dueNow(new Date('2026-11-02T04:47:00Z')));
  check('Friday 07:47 Israel: not due', !dueNow(new Date('2026-10-23T04:47:00Z')));
  check('the Israel day, not the UTC day', ilDay(new Date('2026-10-19T22:30:00Z')) === '2026-10-20');

  console.log('\n2. the text');
  check('nothing waiting: the one-line answer', /^בוקר טוב, אין/.test(buildBrief([], [], '2026-10-20')));
  const four = [{ n: 'A', e: '2026-10-01' }, { n: 'B', e: '2026-10-22' }, { n: 'C', e: '2026-10-25' }, { n: 'D', e: '2026-10-26' }];
  const t = buildBrief(four, ['routine-od-scan'], '2026-10-20');
  check('at most 3 expiries, the rest counted, the failed agent named', /- A \(פג 01\/10\/2026\)/.test(t) && /- B \(עד 22\/10\/2026\)/.test(t) && !/- D/.test(t) && /ועוד 1/.test(t) && /\u05e1\u05e8\u05d9\u05e7\u05ea/.test(t), t);
  check('the date as DD/MM/YYYY', /20\/10\/2026/.test(t));
  // 20/10/2026, the first dry run: "(expired 09/11)" read as a future date; it was 09/11/2025.
  const old = buildBrief([{ n: '\u05d8\u05d5\u05e4\u05e1 9\u05d0 \u2013 \u05ea\u05e7\u05d9\u05e0\u05d5\u05ea', e: '2025-11-09' }], [], '2026-10-20');
  check('an expiry from last year shows its year', /\(\u05e4\u05d2 09\/11\/2025\)/.test(old), old);
  check('a long dash in a name from the database becomes "-"', !/\u2013/.test(old) && /9\u05d0 - /.test(old), old);
  const long = buildBrief([{ n: 'x'.repeat(500), e: '2026-10-01' }, { n: 'y'.repeat(500), e: '2026-10-02' }], ['a'.repeat(300)], '2026-10-20');
  check('never over ' + MAX_CHARS + ' characters', long.length <= MAX_CHARS, long.length);
  check('keyboard characters only (no long dash, no curly quotes)', !/[—–“”…־]/.test(t + long));

  // 20/10/2026, Michael's screenshot: the template showed " | " between lines, "update" twice and routine-wa-assistant.
  const c = buildBrief(four, ['routine-wa-assistant'], '2026-10-20', true);
  check('compact (template): one line, "; " between items, no heading and no " | "', !/\n/.test(c) && !/\|/.test(c) && /A \(\u05e4\u05d2 01\/10\/2026\); B/.test(c) && !/\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1\. \u05e2\u05d3\u05db\u05d5\u05df/.test(c), c);
  check('the failed agent by its office name', /\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4/.test(c) && !/routine-/.test(c) && agentName('routine-new-thing') === 'new-thing', c);
  check('compact with nothing: one short sentence', buildBrief([], [], '2026-10-20', true) === '\u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.');

  console.log('\n3. the endpoint');
  check('no secret: 403', (await onRequest({ request: new Request('https://x/api/wa-morning', { method: 'POST', body: '{}' }), env: ENV })).status === 403);
  check('a wrong secret: 403', (await onRequest({ request: new Request('https://x/api/wa-morning', { method: 'POST', headers: { 'x-notify-secret': 'no' }, body: '{}' }), env: ENV })).status === 403);
  docs = [{ n: 'אישור כיבוי אש', e: '2026-01-01' }]; equip = [{ n: 'מלגזה', loc: 'מחסן', e: '2026-01-02' }];
  state.agent_log = JSON.stringify([{ agent: 'routine-validity', ok: false, at: new Date().toISOString() }, { agent: 'routine-old', ok: false, at: '2020-01-01T00:00:00Z' }]);
  // 20/10/2026: a failure followed by a good run of the same agent is not reported.
  const t0 = Date.now();
  state.agent_log = JSON.stringify([{ agent: 'routine-validity', ok: false, at: new Date(t0 - 3600e3).toISOString() },
    { agent: 'routine-wa-assistant', ok: false, at: new Date(t0 - 7200e3).toISOString() }, { agent: 'routine-wa-assistant', ok: true, at: new Date(t0 - 600e3).toISOString() },
    { agent: 'routine-old', ok: false, at: '2020-01-01T00:00:00Z' }]);
  let j = await call({ dry: true });
  check('dry: the text, nothing sent', j.dry && !metas.length && /מלגזה, מחסן/.test(j.text) && /\u05d1\u05d5\u05d3\u05e7 \u05d4\u05ea\u05d5\u05e7\u05e3/.test(j.text) && !/old/.test(j.text) && !/\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4/.test(j.text), j);
  j = await call({ force: true });
  check('force: sent to Michael only, the day marked, logged', j.sent && metas.length === 1 && metas[0].to === OWNER && metas[0].type === 'template' && j.via === 'template' && state[LAST_KEY] === ilDay(new Date()) && logs.some((l) => l.event_type === 'assistant' && l.payload.kind === 'morning' && l.payload.wamid === 'wamid.M'), { j, state, logs });
  let n = metas.length;
  j = await call({});
  check('the scheduled call now (not 07:xx Israel, or already sent): nothing more', !j.sent && metas.length === n, j);
  state = { agent_log: '[]' }; n = metas.length;
  const mon = new Date('2026-10-19T04:47:00Z');
  j = await run(ENV, mon, {});
  check('Monday 04:47 UTC: sent, and the day is 19/10', j.sent && metas.length === n + 1 && state[LAST_KEY] === '2026-10-19', [j, state]);
  j = await run(ENV, new Date('2026-10-19T04:48:00Z'), {});
  check('a second call the same morning: not sent again', !j.sent && j.reason === 'already sent today' && metas.length === n + 1, j);
  j = await run(ENV, new Date('2026-10-19T05:47:00Z'), {});
  check('the 05:47 UTC call (08:47 Israel): not sent', !j.sent && metas.length === n + 1, j);

  console.log('\n4. wiring');
  const mw = fs.readFileSync(new URL('../../functions/_middleware.js', import.meta.url), 'utf8');
  check('a machine path (pg_cron from the database)', /'\/api\/wa-morning'/.test(mw));
  const sql = fs.readFileSync(new URL('../../migrations/2026-10-20_wa_morning_cron.sql', import.meta.url), 'utf8');
  check('pg_cron at 04:47 and 05:47 UTC, Sunday-Thursday, with the Vault secret', /cron\.schedule\('wa-morning', '47 4,5 \* \* 0-4'/.test(sql) && /x-notify-secret/.test(sql) && /revoke all on function private\.wa_morning_tick/.test(sql));
  const rt = fs.readFileSync(new URL('../../project-files/routine-wa-assistant.md', import.meta.url), 'utf8');
  check('the assistant answers in a fixed format, numbered sections (20/10/2026: "not by sections")', /\u05e4\u05d5\u05e8\u05de\u05d8 \u05e7\u05d1\u05d5\u05e2/.test(rt) && /\u05de\u05d7\u05db\u05d4 \u05dc\u05da:\n   1\. /.test(rt));
  check('the assistant no longer sends the morning update itself', /מ-20\/10\/2026 השרת שולח אותו/.test(rt));

  console.log('\n5. calendar requests for expiries (20/10/2026, Michael: "do it: calendar slots")');
  check('the folder is inside the safety folder', OD_CAL === OD_ROOT + '_\u05ea\u05d5\u05e8\u05d9\u05dd \u05dc\u05d9\u05d5\u05de\u05df', OD_CAL);
  check('21 days before the expiry', eventDay('2026-11-30', '2026-10-20') === '2026-11-09');
  check('too close or expired: tomorrow', eventDay('2026-10-25', '2026-10-20') === '2026-10-21' && eventDay('2026-09-01', '2026-10-20') === '2026-10-21');
  check('a Friday moves to Sunday, a Saturday to Sunday', eventDay('2026-11-27', '2026-10-20') === '2026-11-08' && eventDay('2026-10-22', '2026-10-23') === '2026-10-25' && eventDay('2026-11-28', '2026-10-20') === '2026-11-08', [eventDay('2026-11-27', '2026-10-20'), eventDay('2026-10-22', '2026-10-23'), eventDay('2026-11-28', '2026-10-20')]);
  const rows = [{ t: 'equip', id: 7, n: 'Crane \u2014 hall', loc: 'A', vendor: 'V<x>', e: '2026-11-30' }, { t: 'docs', id: 3, n: 'Permit', e: '2026-09-01' }, { t: 'docs', id: 4, n: '', e: '2026-11-01' }, { t: 'docs', id: 5, n: 'Bad', e: '' }];
  let p = calendarPlan(rows, { 'docs:9:2026-11-01': 1, 'docs:3:2026-09-01': 1 }, '2026-10-20');
  check('already written: not again; nameless or dateless rows: skipped', p.todo.length === 1 && p.todo[0].key === 'equip:7:2026-11-30', p.todo);
  check('the sent map keeps only what is still in the window', JSON.stringify(p.keep) === JSON.stringify({ 'docs:3:2026-09-01': 1 }), p.keep);
  const f = JSON.parse(p.todo[0].file);
  check('the event: subject, 09:00-09:30 on the day, Israel time', f.subject === '\u05dc\u05ea\u05d0\u05dd: Crane - hall, A (\u05e2\u05d3 30/11/2026)' && f.start === '2026-11-09T09:00:00' && f.end === '2026-11-09T09:30:00' && f.tz === 'Israel Standard Time', f);
  check('the body: rtl, escaped, the vendor, no long dash', /^<div dir="rtl">/.test(f.html) && /V&lt;x&gt;/.test(f.html) && !/\u2014/.test(f.html + f.subject), f.html);
  const many = Array.from({ length: 9 }, (_, i) => ({ t: 'docs', id: i, n: 'D' + i, e: '2026-11-0' + (9 - i) }));
  p = calendarPlan(many, {}, '2026-10-20');
  check('at most ' + CAL_MAX + ' new a day, the nearest first', p.todo.length === CAL_MAX && p.todo[0].key === 'docs:8:2026-11-01', p.todo.map((x) => x.key));
  const OD = Object.assign({}, ENV, { ONEDRIVE_CLIENT_ID: 'c', ONEDRIVE_CLIENT_SECRET: 's' });
  docs = [{ id: 3, n: 'Permit', e: '2026-09-01' }]; equip = [{ id: 7, n: 'Crane', loc: 'A', vendor: 'V', e: '2026-11-30' }];
  state = { agent_log: '[]' }; puts = [];
  j = await run(ENV, mon, { dry: true });
  check('no OneDrive settings: skipped, nothing written', j.cal && j.cal.skipped && !puts.length, j.cal);
  j = await run(OD, mon, { dry: true });
  check('dry: lists what it would write, writes nothing', j.cal && j.cal.would.length === 2 && !puts.length && !(CAL_KEY in state), j.cal);
  j = await run(OD, mon, {});
  check('the 07:47 run: two files in the folder, the map saved', j.cal.written === 2 && puts.length === 2 && puts.every((x) => x.url.indexOf(encodeURIComponent('_\u05ea\u05d5\u05e8\u05d9\u05dd \u05dc\u05d9\u05d5\u05de\u05df')) > 0) && Object.keys(JSON.parse(state[CAL_KEY])).length === 2, [j.cal, puts.map((x) => x.url), state[CAL_KEY]]);
  j = await run(OD, new Date('2026-10-19T04:48:00Z'), {});
  check('a second call: no file again, even when WhatsApp says already sent', j.reason === 'already sent today' && j.cal.written === 0 && puts.length === 2, j);
  equip = [{ id: 7, n: 'Crane', loc: 'A', vendor: 'V', e: '2027-11-30' }]; docs = [{ id: 3, n: 'Permit', e: '2026-09-01' }, { id: 4, n: 'Other', e: '2026-10-30' }, { id: 6, n: 'Third', e: '2026-10-31' }];
  putFail = 2; puts = [];
  j = await run(OD, new Date('2026-10-20T04:47:00Z'), {});
  const kept = JSON.parse(state[CAL_KEY]);
  check('a failed upload: only what was written is marked, the error is returned, the renewed item left the map', j.cal.written === 1 && /onedrive 503/.test(j.cal.error) && kept['docs:4:2026-10-30'] && !kept['docs:6:2026-10-31'] && !kept['equip:7:2026-11-30'], [j.cal, kept]);
  putFail = 0; n = metas.length; puts = [];
  equip = [{ id: 8, n: 'Hoist', e: '2026-11-20' }]; docs = [];
  j = await run(OD, new Date('2026-10-20T12:00:00Z'), { calendar: true });
  check('calendar only: any hour, the file written, no WhatsApp', j.cal.written === 1 && puts.length === 1 && metas.length === n, [j, metas.length - n]);

  console.log('\nwa-morning-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
