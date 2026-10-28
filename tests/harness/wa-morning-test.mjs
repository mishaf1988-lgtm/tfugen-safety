// The morning update on WhatsApp from the server (20/10/2026): pg_cron calls /api/wa-morning twice,
// only the call on 07:xx in Israel on Sunday-Thursday sends, once a day, to Michael's number only.
import { areaRole, watchVerdict, WATCH_MIN, onRequest, run, buildBrief, agentName, dueNow, ilDay, MAX_CHARS, LAST_KEY, calendarPlan, eventDay, OD_CAL, CAL_KEY, CAL_MAX, LEARN_ALERT, splitUrgent, WAIT_DAYS, rowContradictions } from './_build/wa-morning.mjs';
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
  if (url.startsWith(SB + '/rest/v1/equip_inspections')) { equipUrls.push(url); return new Response(JSON.stringify(equip), { status: 200 }); }
  if (url.startsWith(SB + '/rest/v1/notifications_log')) { logs.push(...JSON.parse(opt.body)); return new Response('', { status: 201 }); }
  if (url.startsWith('https://graph.facebook.com/')) { metas.push(JSON.parse(opt.body)); return new Response(JSON.stringify({ messages: [{ id: 'wamid.M' }] }), { status: 200 }); }
  return new Response('[]', { status: 200 });
};
const equipUrls = [];
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
  // 21/10/2026 (handoff, Michael: "בצע: בלי תור, רק סימון"): equipment of another area names the role, never a person.
  const ar = buildBrief([{ n: 'Boiler', e: '2026-10-22', area: 'תשתיות' }, { n: 'NH3 detector', e: '2026-10-01', area: 'קירור ואמוניה' }, { n: 'Hoist', e: '2026-10-23' }], [], '2026-10-20');
  check('area: "אחראי התשתיות" / "אחראי הקירור" in the bracket, none on the safety manager\'s own', /- Boiler \(עד 22\/10\/2026, אחראי התשתיות\)/.test(ar) && /- NH3 detector \(פג 01\/10\/2026, אחראי הקירור\)/.test(ar) && /- Hoist \(עד 23\/10\/2026\)$/m.test(ar), ar);
  check('area: no first names in the update (שלומי, יורי)', !/שלומי|יורי/.test(ar + buildBrief([{ n: 'Boiler', e: '2026-10-22', area: 'תשתיות' }], [], '2026-10-20', true)));
  check('area: a new area still reads as a role', areaRole('מעבדה') === 'אחראי מעבדה' && areaRole('') === '' && areaRole(null) === '');
  // 20/10/2026, Michael on WhatsApp: "add the weather to the morning update" (dev_inbox).
  const wx = { ok: true, day: '2026-10-20', alerts: [{ kind: 'gust' }], sum: { tmin: 17, tmax: 26, rain: 0, gust: 55 } };
  const tw = buildBrief(four, [], '2026-10-20', false, [], wx);
  check('weather: the first line after the heading, no rain at 0%, the alert in words', tw.split('\n')[1] === 'מזג האוויר: 17-26 מעלות, משבים עד 55 קמ"ש. זהירות בעבודה בחוץ: משבים חזקים.', tw);
  check('weather of another day or a failed run: no line', !/מזג/.test(buildBrief(four, [], '2026-10-21', false, [], wx)) && !/מזג/.test(buildBrief(four, [], '2026-10-20', false, [], Object.assign({}, wx, { ok: false }))));
  check('weather without the summary (a record from before 20/10/2026): no line', !/מזג/.test(buildBrief(four, [], '2026-10-20', false, [], { ok: true, day: '2026-10-20', alerts: [] })));
  const cw = buildBrief([], [], '2026-10-20', true, [], wx);
  check('short version: weather and "nothing waiting"', /^מזג האוויר: 17-26/.test(cw) && /אין שום דבר שמחכה לך היום\.$/.test(cw), cw);
  check('weather keeps keyboard characters', !/[—–“”…־]/.test(tw + cw));
  // 25/10/2026 (the test session): "what is urgent" gave back the whole update; a dev note carried "(#1965)".
  const notes = [{ agent: 'dev', text: 'כותרת הצ\'אט נוספה לנוהל (#1965) ולפרומפט, ראה #1966' }];
  const u = buildBrief(four, ['routine-od-scan'], '2026-10-20', false, notes, wx, 2, 66, true);
  check('urgent: the expiries and the failed agent only; no weather, workers, development or notebook line', /^מה דחוף:\n/.test(u) && /A/.test(u) && /סוכן שנכשל/.test(u) && !/מזג|מהעובדים|בקשות פיתוח|המחברת|בוקר טוב/.test(u), u);
  check('urgent with nothing urgent: one line', buildBrief([], [], '2026-10-20', false, notes, wx, 0, 0, true) === 'אין עכשיו שום דבר דחוף.');
  const full = buildBrief(four, [], '2026-10-20', false, notes, wx);
  check('the morning update keeps the workers\' note, without the PR numbers', /נוספה לנוהל ולפרומפט, ראה\n|נוספה לנוהל ולפרומפט, ראה$/m.test(full) && !/#19/.test(full), full);
  check('the fast lane builds "what is urgent" with urgent on', /buildBrief\(g\.items, g\.failed, g\.today, false, \[\], null, null, null, true, g\.waiting, g\.disq\)/.test(fs.readFileSync(new URL('../../functions/api/wa-hook.js', import.meta.url), 'utf8')));


  // 20/10/2026, Michael's screenshot: the template showed " | " between lines, "update" twice and routine-wa-assistant.
  const c = buildBrief(four, ['routine-wa-assistant'], '2026-10-20', true);
  check('compact (template): one line, "; " between items, no heading and no " | "', !/\n/.test(c) && !/\|/.test(c) && /A \(\u05e4\u05d2 01\/10\/2026\); B/.test(c) && !/\u05d1\u05d5\u05e7\u05e8 \u05d8\u05d5\u05d1\. \u05e2\u05d3\u05db\u05d5\u05df/.test(c), c);
  check('the failed agent by its office name', /\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4/.test(c) && !/routine-/.test(c) && agentName('routine-new-thing') === 'new-thing', c);
  check('compact with nothing: one short sentence', buildBrief([], [], '2026-10-20', true) === '\u05d0\u05d9\u05df \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05e9\u05de\u05d7\u05db\u05d4 \u05dc\u05da \u05d4\u05d9\u05d5\u05dd.');

  // 20/10/2026: what workers left for Michael (agent_report for_michael)
  const nb = buildBrief([], [], '2026-10-20', false, [{ agent: 'routine-coa', text: 'דוח המים לספטמבר: טיוטה ב-Drafts' }]);
  check('for_michael: a "from the workers" line with the office name', /\u05de\u05d4\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd:/.test(nb) && /\u05e1\u05d9\u05d3\u05d5\u05e8 \u05ea\u05e2\u05d5\u05d3\u05d5\u05ea COA: \u05d3\u05d5\u05d7 \u05d4\u05de\u05d9\u05dd/.test(nb) && !/\u05d0\u05d9\u05df \u05e9\u05d5\u05dd/.test(nb), nb);
  const nc = buildBrief([], [], '2026-10-20', true, [{ agent: 'routine-quotes', text: 'x' }, { agent: 'routine-coa', text: 'y' }]);
  check('for_michael compact: one line, both', !/\n/.test(nc) && /: x; /.test(nc) && /: y\./.test(nc), nc);

  // 21/10/2026: an internal id in a worker's note is cut out, the rest of the note stays
  const ni = buildBrief([], [], '2026-10-21', false, [{ agent: 'routine-coa', text: '\u05d4\u05d5\u05e2\u05d1\u05e8 \u05dc\u05e4\u05d9\u05ea\u05d5\u05d7 dev-20261021053745-tqu3.' }, { agent: 'routine-quotes', text: '\u05d4\u05e6\u05e2\u05d4 \u05d7\u05d3\u05e9\u05d4 (trig_01TofqtqNWtrXMnqiNjHq1nZ), \u05d1\u05e9\u05d9\u05d7\u05d4 session_01McD38xyz' }, { agent: 'routine-od-scan', text: 'cse_01TuRyeMrE8W' }]);
  check('internal ids: cut out of the notes, text kept', !/dev-2026|trig_|session_|cse_|\(\)/.test(ni) && /\u05dc\u05e4\u05d9\u05ea\u05d5\u05d7\./.test(ni) && /\u05d7\u05d3\u05e9\u05d4, \u05d1\u05e9\u05d9\u05d7\u05d4/.test(ni), ni);
  check('internal ids: a note that was only an id is dropped', !/\u05e1\u05e8\u05d9\u05e7\u05ea/.test(ni) && (ni.match(/\n- /g) || []).length === 2, ni);
  const nk = buildBrief([], [], '2026-10-21', true, [{ agent: 'routine-coa', text: '\u05d8\u05d5\u05e4\u05e1 16, 21/10/2026, ISO 45001, #1802' }]);
  check('internal ids: dates, form numbers and ISO stay; a PR number is cut (25/10/2026)', /\u05d8\u05d5\u05e4\u05e1 16, 21\/10\/2026, ISO 45001\./.test(nk) && !/#1802|,\./.test(nk), nk);

  // 21/10/2026: a promise still open after a day gets one reminder, in daytime
  {
    const { promiseDue, promiseRemindText, promiseAdd, promiseDone, promiseDoneText } = await import('./_build/_wa.mjs');
    const T0 = Date.parse('2026-10-21T08:00:00Z');
    let l = promiseAdd('[]', { agent: 'routine-wa-assistant', text: 'the six labels', who: 'dev' }, new Date(T0).toISOString()).list;
    check('promise: not due before 24 hours', promiseDue(JSON.stringify(l), T0 + 23 * 3600e3, 11).length === 0);
    check('promise: due after 24 hours, in daytime only', promiseDue(JSON.stringify(l), T0 + 25 * 3600e3, 11).length === 1 && promiseDue(JSON.stringify(l), T0 + 25 * 3600e3, 22).length === 0 && promiseDue(JSON.stringify(l), T0 + 25 * 3600e3, 7).length === 0);
    l[0].reminded_at = 'x';
    const fut = [{ id: 'pf', at: new Date(T0).toISOString(), status: 'open', check_at: new Date(T0 + 44 * 3600e3).toISOString() }];
    check('promise: a check scheduled ahead is not day-old due (23/10/2026)', promiseDue(JSON.stringify(fut), T0 + 25 * 3600e3, 11).length === 0 && promiseDue(JSON.stringify(fut), T0 + 45 * 3600e3, 11).length === 1);
    check('promise: reminded once only', promiseDue(JSON.stringify(l), T0 + 48 * 3600e3, 11).length === 0);
    { const { promiseToCheck, promiseCheckDue, PROMISE_VERIFY } = await import('./_build/_wa.mjs');
      const c = promiseToCheck(JSON.stringify(l), [l[0].id], new Date(T0 + 25 * 3600e3).toISOString());
      check('a day-old promise becomes a check for the assistant first, not a reminder to Michael (23/10/2026)', c[0].check === PROMISE_VERIFY && c[0].reminded_at && promiseCheckDue(JSON.stringify(c), T0 + 25 * 3600e3 + 1000, 13) && promiseCheckDue(JSON.stringify(c), T0 + 25 * 3600e3 + 1000, 13).id === l[0].id, c); }
    { const { ocrAutoPick, OCR_ROOT, OCR_INBOX } = await import('./_build/_ocr.mjs');
      const rd = await import('./_build/routine-db.mjs');
      const N = Date.parse('2026-10-24T10:00:00Z'), f = (name, h) => ({ name, file: {}, createdDateTime: new Date(N - h * 3600e3).toISOString() });
      const items = [f('a.pdf', 5), f('b.pdf', 30), f('c.jpg', 1), f('old.pdf', 24 * 5), { name: 'dir', createdDateTime: new Date(N).toISOString() }];
      check('auto OCR: the oldest new PDF of the last 3 days, not one already done, never a folder or a jpg (24/10/2026)', ocrAutoPick(items, [], N).name === 'b.pdf' && ocrAutoPick(items, ['b.pdf'], N).name === 'a.pdf' && ocrAutoPick(items, ['a.pdf', 'b.pdf'], N) === null && OCR_ROOT === rd.OD_ROOT && OCR_INBOX === rd.OD_INBOX); }
    { const { isoWeekAdd, ISO_HOUR, ISO_CHECK } = await import('./_build/_wa.mjs');
      const i1 = isoWeekAdd('[]', '2026-10-25', 0, ISO_HOUR, '2026-10-25T07:00:00.000Z');
      check('the weekly ISO review: one check on Sunday at 10:00, never twice, never on another day or hour (24/10/2026)', i1 && i1.length === 1 && i1[0].check === ISO_CHECK && i1[0].id === 'p-iso-20261025' && isoWeekAdd(JSON.stringify(i1), '2026-10-25', 0, ISO_HOUR, 'x') === null && isoWeekAdd('[]', '2026-10-26', 1, ISO_HOUR, 'x') === null && isoWeekAdd('[]', '2026-10-25', 0, 9, 'x') === null, i1); }
    { const { eveningAdd, EVENING_HOUR, EVENING_CHECK } = await import('./_build/_wa.mjs');
      const e1 = eveningAdd('[]', '2026-10-25', 0, EVENING_HOUR, '2026-10-25T12:00:00.000Z');
      check('the evening list: one check at 15:00 on a working day, never twice, never on Friday or out of the hour (23/10/2026)', e1 && e1.length === 1 && e1[0].check === EVENING_CHECK && /from the database/.test(EVENING_CHECK) && e1[0].check_at && eveningAdd(JSON.stringify(e1), '2026-10-25', 0, EVENING_HOUR, 'x') === null && eveningAdd('[]', '2026-10-23', 5, EVENING_HOUR, 'x') === null && eveningAdd('[]', '2026-10-25', 0, 14, 'x') === null, e1); }
    check('promise: the reminder says what and who it waits on', /the six labels \(\u05de\u05d7\u05db\u05d4 \u05dcdev\)/.test(promiseRemindText(l)));
    const d = promiseDone(JSON.stringify(l), { id: l[0].id }, 'fixed', 'now');
    check('promise_done text: done, what, note', promiseDoneText(d.closed, 'fixed') === '\u05d1\u05d5\u05e6\u05e2: the six labels. fixed' && d.list[0].status === 'done');
    check('promise text: internal ids cut, long dash made keyboard', promiseAdd('[]', { agent: 'a-b', text: 'x \u2014 y dev-20261021075805-mq3v' }, 'now').list[0].text === 'x - y');
  }

  // 21/10/2026 (the assistant's list, item 3): a check it scheduled wakes it at that time, from the watchdog
  {
    const { promiseAdd, promiseCheckDue, promiseCheckFireText, PROMISE_CHECK_HEAD, PROMISE_CHECKS_MAX } = await import('./_build/_wa.mjs');
    const N = '2026-10-21T08:00:00.000Z', NM = Date.parse(N);
    const a = promiseAdd('[]', { agent: 'routine-wa-assistant', text: 'the merged PDF', who: 'docs', check_in_min: 30, check: 'the chat row has an answer' }, N);
    check('check: check_at 30 minutes on, what to check kept', a.list[0].check_at === '2026-10-21T08:30:00.000Z' && a.list[0].check === 'the chat row has an answer' && a.check_at === a.list[0].check_at, a);
    check('check: under 10 minutes or over 2 days refused', !!promiseAdd('[]', { agent: 'a-b', text: 'abcdef', check_in_min: 5 }, N).error && !!promiseAdd('[]', { agent: 'a-b', text: 'abcdef', check_in_min: 3000 }, N).error);
    check('check: none without check_in_min', !promiseAdd('[]', { agent: 'a-b', text: 'abcdef' }, N).list[0].check_at);
    const L = JSON.stringify(a.list);
    check('check: not due before its time, due after, daytime only (07-21 Israel)', !promiseCheckDue(L, NM + 29 * 60e3, 11) && (promiseCheckDue(L, NM + 31 * 60e3, 11) || {}).id === a.id && !promiseCheckDue(L, NM + 31 * 60e3, 22) && !promiseCheckDue(L, NM + 31 * 60e3, 6));
    const again = promiseAdd(L, { agent: 'routine-wa-assistant', text: 'the merged PDF', check_in_min: 60 }, '2026-10-21T09:00:00.000Z');
    check('check: the same promise again sets the next check, no second promise', again.list.length === 1 && again.list[0].check_at === '2026-10-21T10:00:00.000Z' && again.id === a.id);
    const maxed = JSON.parse(L); maxed[0].checks = PROMISE_CHECKS_MAX;
    check('check: after ' + PROMISE_CHECKS_MAX + ' checks no more (tell Michael instead)', !!promiseAdd(JSON.stringify(maxed), { agent: 'routine-wa-assistant', text: 'the merged PDF', check_in_min: 30 }, N).error);
    const ft = promiseCheckFireText(Object.assign({}, a.list[0], { checks: 1 }), N);
    check('check: the fire text opens with the server line, carries the promise, what to check and who', ft.split('\n')[0] === PROMISE_CHECK_HEAD && ft.indexOf('promise: ' + a.id) >= 0 && /waiting_on: docs/.test(ft) && /check \(.*\): the chat row has an answer/.test(ft) && ft.includes('check_no: 1 of ' + PROMISE_CHECKS_MAX), ft);
    // end to end: watch fires the assistant once, marks it, logs it
    const fires = [], f0 = globalThis.fetch;
    globalThis.fetch = async (url, opt = {}) => { if (String(url).startsWith('https://api.anthropic.com/')) { fires.push(JSON.parse(opt.body)); return new Response(JSON.stringify({ claude_code_session_id: 'session_X1' }), { status: 200 }); } return f0(url, opt); };
    state = { promises: L }; logs = [];
    const E = Object.assign({}, ENV, { ASSISTANT_FIRE_URL: 'https://api.anthropic.com/v1/claude_code/routines/trig_T/fire', ASSISTANT_FIRE_TOKEN: 't' });
    const w1 = await run(E, new Date(NM + 31 * 60e3), { watch: true });
    const st = JSON.parse(state.promises)[0];
    check('watch: the due check fires the assistant with its text', fires.length === 1 && fires[0].text.split('\n')[0] === PROMISE_CHECK_HEAD && w1.check && w1.check.fired, { fires, w1 });
    check('watch: marked (checks 1, no check_at), logged as promise_check with the session', st.checks === 1 && !st.check_at && logs.some((l) => l.event_type === 'promise_check' && l.payload.session === 'session_X1'), { st, logs });
    await run(E, new Date(NM + 36 * 60e3), { watch: true });
    check('watch: not fired twice', fires.length === 1);
    globalThis.fetch = f0; state = {}; logs = [];
  }

  // 21/10/2026: a failed read of the answers never alerts (the first alert ever was a false one)
  {
    const f0 = globalThis.fetch, sent = [];
    const T = Date.parse('2026-10-21T13:19:44.804Z');
    globalThis.fetch = async (url, opt = {}) => {
      const u = String(url);
      if (u.indexOf('event_type=eq.owner_in') >= 0) return new Response(JSON.stringify([{ ts: '2026-10-21T13:19:44.804+00:00', payload: { wamid: 'wF' } }]), { status: 200 });
      if (u.indexOf('event_type=eq.assistant') >= 0) return new Response('{"message":"timeout"}', { status: 503 });
      if (u.startsWith('https://graph.facebook.com/')) { sent.push(u); }
      return f0(url, opt);
    };
    const w = await run(ENV, new Date(T + 15 * 60e3), { watch: true });
    check('watch: the answers could not be read: no alert, says why', sent.length === 0 && w.sent === false && /could not read/.test(w.error || ''), { w, sent });
    globalThis.fetch = f0; state = {}; logs = []; metas = [];
  }

  // 21/10/2026 (Michael on WhatsApp): the last line counts the development requests closed yesterday
  {
    const { devClosedYesterday } = await import('./_build/wa-morning.mjs');
    const L = [{ status: 'done', done_at: '2026-10-21T13:25:16Z' }, { status: 'done', done_at: '2026-10-21T21:30:00Z' }, { status: 'done', done_at: '2026-10-20T10:00:00Z' }, { status: 'open' }];
    check('dev count: done on the Israel day before today only (21:30 UTC is the next day in Israel)', devClosedYesterday(L, '2026-10-22') === 1 && devClosedYesterday(L, '2026-10-21') === 1 && devClosedYesterday('x', '2026-10-22') === null, [devClosedYesterday(L, '2026-10-22'), devClosedYesterday(L, '2026-10-21')]);
    const full = buildBrief([{ n: 'A', e: '2026-10-21' }], [], '2026-10-22', false, [], null, 2);
    check('dev count: the last line of the full update', full.split('\n').pop() === 'בקשות פיתוח שנסגרו אתמול: 2.', full);
    check('dev count: zero is said too; none when not read (null)', /אתמול: 0\.$/.test(buildBrief([], [], '2026-10-22', false, [], null, 0)) && !/בקשות פיתוח/.test(buildBrief([{ n: 'A', e: '2026-10-21' }], [], '2026-10-22', false, [], null, null)));
    const longB = buildBrief(Array.from({ length: 3 }, (_, i) => ({ n: 'x'.repeat(300) + i, e: '2026-10-21' })), ['a'.repeat(300)], '2026-10-22', false, [{ agent: 'routine-coa', text: 'y'.repeat(300) }], null, 4);
    check('dev count: stays last when the update is cut to ' + MAX_CHARS, longB.length <= MAX_CHARS && /אתמול: 4\.$/.test(longB), longB.length);
    const comp = buildBrief(Array.from({ length: 3 }, (_, i) => ({ n: 'x'.repeat(300) + i, e: '2026-10-21' })), [], '2026-10-22', true, [], null, 1);
    check('dev count: compact keeps it at the end within ' + MAX_CHARS, comp.length <= MAX_CHARS && /אתמול: 1\.$/.test(comp), comp.length);
  }

  // 25/10/2026: the guard for a dev request Michael never heard about
  {
    const { devStuck, devStuckText, DEV_STUCK_MS } = await import('./_build/wa-morning.mjs');
    const T = Date.parse('2026-10-25T12:00:00Z');
    const L = JSON.stringify([
      { id: 'dev-20261025090000-aaaa', at: '2026-10-25T09:00:00Z', status: 'open', text: 'move the course day dev-20261025090000-aaaa' },
      { id: 'dev-20261025091000-bbbb', at: '2026-10-25T09:10:00Z', status: 'open', text: 'told', told_at: '2026-10-25T09:20:00Z' },
      { id: 'dev-20261025113000-cccc', at: '2026-10-25T11:30:00Z', status: 'open', text: 'fresh one' },
      { id: 'dev-20261025080000-dddd', at: '2026-10-25T08:00:00Z', status: 'done', text: 'closed' }]);
    const d = devStuck(L, '[]', T, 15);
    check('dev guard: only open, untold and older than ' + (DEV_STUCK_MS / 3600000) + 'h', d.length === 1 && d[0].id === 'dev-20261025090000-aaaa', d);
    check('dev guard: once (warned list), and quiet at night', devStuck(L, '["dev-20261025090000-aaaa"]', T, 15).length === 0 && devStuck(L, '[]', T, 22).length === 0 && devStuck(L, '[]', T, 6).length === 0);
    const wm = (await import('node:fs')).readFileSync(new URL('../../functions/api/wa-morning.js', import.meta.url), 'utf8');
    const iR = wm.indexOf('async function devRemind');
    check('dev guard: marked warned only after a send that went out, so a failed send is tried again (a source check: devRemind is not run here; 26/10/2026 retro)', iR > 0 && /sendToOwner\([\s\S]{0,300}if \(r\.ok\) await stateSet\(env, DEV_WARN_KEY/.test(wm.slice(iR, iR + 2500)) && !/await stateSet\(env, DEV_WARN_KEY[\s\S]{0,200}const r = await sendToOwner/.test(wm.slice(iR, iR + 2500)));
    const iW = wm.indexOf('stateSet(env, WATCH_KEY'), iP = wm.indexOf('stateSet(env, PROMISE_KEY, JSON.stringify(list))');
    check('watch alert and promise reminder: marked only after a send that went out, so a failed one is tried again (source check; 26/10/2026 retro)', iW > 0 && /if \(r\.ok\) await stateSet\(env, WATCH_KEY/.test(wm.slice(iW - 40, iW + 60)) && iP > 0 && /if \(r\.ok\) await stateSet\(env, PROMISE_KEY, JSON\.stringify\(list\)\)/.test(wm.slice(iP - 40, iP + 80)));
    check('dev guard: bad state = nothing, never a throw', devStuck('x', 'y', T, 15).length === 0 && devStuck(null, null, T, 15).length === 0);
    const tx = devStuckText(d[0]);
    check('dev guard: the time in Israel (UTC+2 after 25/10), no internal id', /11:00/.test(tx) && !/dev-\d{14}/.test(tx), tx);
  }

  // 20/10/2026: the watchdog for a stuck run
  {
    const T = Date.parse('2026-10-20T18:00:00Z'), last = { ts: '2026-10-20T18:00:00Z', payload: { wamid: 'w1' } };
    check('watch: no answer after ' + WATCH_MIN + ' minutes: one line, with the time in Israel', /\u05e2\u05d3\u05d9\u05d9\u05df \u05d0\u05d9\u05df \u05ea\u05e9\u05d5\u05d1\u05d4 \u05dc\u05d4\u05d5\u05d3\u05e2\u05d4 \u05de-21:00/.test((watchVerdict(last, [], T + 11 * 60000, null) || {}).text || ''), watchVerdict(last, [], T + 11 * 60000, null));
    check('watch: before ' + WATCH_MIN + ' minutes, after an answer, already warned, or an hour later: nothing',
      !watchVerdict(last, [], T + 5 * 60000, null) && !watchVerdict(last, [{ payload: { text: '\u05d4\u05d8\u05d9\u05d5\u05d8\u05d4 \u05de\u05d5\u05db\u05e0\u05d4' } }], T + 15 * 60000, null) && !watchVerdict(last, [], T + 15 * 60000, 'w1') && !watchVerdict(last, [], T + 61 * 60000, null));
    const started = [{ payload: { text: '\u05de\u05ea\u05d7\u05d9\u05dc: \u05de\u05d7\u05e4\u05e9' } }];
    check('watch: only "started": waits to 20 minutes, then warns', !watchVerdict(last, started, T + 15 * 60000, null) && !!watchVerdict(last, started, T + 21 * 60000, null));
  }

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
  state.agent_log = JSON.stringify(JSON.parse(state.agent_log).concat([{ agent: 'routine-coa', ok: true, at: new Date(t0 - 1800e3).toISOString(), for_michael: 'טיוטה מוכנה' },
    { agent: 'routine-quotes', ok: true, at: '2020-01-01T00:00:00Z', for_michael: 'ישן' }]));
  let j = await call({ dry: true });
  check('dry: the text, nothing sent', j.dry && !metas.length && /מלגזה, מחסן/.test(j.text) && /\u05d1\u05d5\u05d3\u05e7 \u05d4\u05ea\u05d5\u05e7\u05e3/.test(j.text) && !/old/.test(j.text) && !/\u05d4\u05e2\u05d5\u05d6\u05e8 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4/.test(j.text) && /\u05d8\u05d9\u05d5\u05d8\u05d4 \u05de\u05d5\u05db\u05e0\u05d4/.test(j.text) && !/\u05d9\u05e9\u05df/.test(j.text), j);
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
  check('the folder is inside the safety folder', OD_CAL === OD_ROOT + '_\u05d0\u05d5\u05d8\u05d5\u05de\u05e6\u05d9\u05d4/_\u05ea\u05d5\u05e8\u05d9\u05dd \u05dc\u05d9\u05d5\u05de\u05df', OD_CAL);
  check('21 days before the expiry', eventDay('2026-11-30', '2026-10-20') === '2026-11-09');
  check('too close or expired: tomorrow', eventDay('2026-10-25', '2026-10-20') === '2026-10-21' && eventDay('2026-09-01', '2026-10-20') === '2026-10-21');
  check('a Friday moves to Sunday, a Saturday to Sunday', eventDay('2026-11-27', '2026-10-20') === '2026-11-08' && eventDay('2026-10-22', '2026-10-23') === '2026-10-25' && eventDay('2026-11-28', '2026-10-20') === '2026-11-08', [eventDay('2026-11-27', '2026-10-20'), eventDay('2026-10-22', '2026-10-23'), eventDay('2026-11-28', '2026-10-20')]);
  const rows = [{ t: 'equip', id: 7, n: 'Crane \u2014 hall', loc: 'A', vendor: 'V<x>', e: '2026-11-30' }, { t: 'docs', id: 3, n: 'Permit', e: '2026-09-01' }, { t: 'docs', id: 4, n: '', e: '2026-11-01' }, { t: 'docs', id: 5, n: 'Bad', e: '' }];
  let p = calendarPlan(rows, { 'docs:9:2026-11-01': 1, 'docs:3:2026-09-01': 1 }, '2026-10-20');
  check('already written: not again; nameless or dateless rows: skipped', p.todo.length === 1 && p.todo[0].key === 'equip:7:2026-11-30', p.todo);
  check('equipment of another area (resp_area): no calendar entry (21/10/2026 retro)', calendarPlan([{ t: 'equip', id: 11, n: 'NH3 valve', e: '2026-11-30', resp_area: '\u05e7\u05d9\u05e8\u05d5\u05e8 \u05d5\u05d0\u05de\u05d5\u05e0\u05d9\u05d4' }, { t: 'equip', id: 12, n: 'Crane', e: '2026-11-30', resp_area: null }], {}, '2026-10-20').todo.map((x) => x.key).join() === 'equip:12:2026-11-30');
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

  equipUrls.length = 0; puts = [];
  equip = [{ id: 21, n: 'NH3 valve', e: '2026-11-20', resp_area: '\u05e7\u05d9\u05e8\u05d5\u05e8 \u05d5\u05d0\u05de\u05d5\u05e0\u05d9\u05d4' }]; docs = [];
  j = await run(OD, new Date('2026-10-20T12:00:00Z'), { calendar: true });
  check('calendar: the query leaves other areas out (resp_area=is.null), and a row that got through is not written (21/10/2026 retro)', equipUrls.length === 1 && /resp_area=is\.null/.test(equipUrls[0]) && j.cal.written === 0 && !puts.length, [equipUrls, j.cal]);

    { // 22/10/2026: an unfolded notebook (over LEARN_ALERT open entries) gets one line at the end; at or under, nothing
    const a = buildBrief([], [], '2026-10-22', false, [], null, 5, LEARN_ALERT + 19), b = buildBrief([], [], '2026-10-22', false, [], null, 5, LEARN_ALERT), c = buildBrief([], [], '2026-10-22', true, [], null, null, 49);
    check('the notebook line: over the limit it shows the count, at the limit nothing, and the compact form keeps it', a.includes('\u05d4\u05de\u05d7\u05d1\u05e8\u05ea \u05e9\u05dc \u05d4\u05e2\u05d5\u05d6\u05e8: 49') && a.includes(': 5.') && !b.includes('\u05d4\u05de\u05d7\u05d1\u05e8\u05ea') && c.includes('49'), { a, b, c }); }
  { // 27/10/2026 (Michael: "you know the inspection was done, so why urgent?"): inspected = waiting for the report, disqualified apart
    const T = '2026-10-27';
    const all = [{ n: 'fork extenders', e: '2026-10-29', d: '2026-10-25', s: '\u05e4\u05e1\u05d5\u05dc' }, { n: 'big bag cross', e: '2026-10-29', d: '2026-10-25', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4' },
      { n: 'gas controller', e: '2026-08-25', d: null, s: '\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3' }, { n: 'old check', e: '2026-10-30', d: '2026-09-01', s: '' }, { n: 'form 9', e: '2026-10-28' }];
    const sp = splitUrgent(all, T);
    check('split: disqualified apart, inspected in the last ' + WAIT_DAYS + ' days waits for its report, an old inspection and the rest stay urgent', sp.disq.map((x) => x.n).join() === 'fork extenders' && sp.waiting.map((x) => x.n).join() === 'big bag cross' && sp.items.map((x) => x.n).join() === 'gas controller,old check,form 9', sp);
    check('split: an inspection dated after today does not count', splitUrgent([{ n: 'x', e: T, d: '2026-10-28' }], T).items.length === 1);
    const full = buildBrief(sp.items, [], T, false, [], null, null, null, false, sp.waiting, sp.disq), urg = buildBrief(sp.items, [], T, false, [], null, null, null, true, sp.waiting, sp.disq), cmp = buildBrief(sp.items, [], T, true, [], null, null, null, false, sp.waiting, sp.disq);
    check('brief: a line "waiting for the report" with the inspection date, and "disqualified" apart; also in "what is urgent" and the compact form', full.includes('\u05de\u05d7\u05db\u05d4 \u05dc\u05ea\u05e1\u05e7\u05d9\u05e8') && full.includes('25/10/2026') && full.includes('\u05e4\u05e1\u05d5\u05dc, \u05de\u05d7\u05db\u05d4 \u05dc\u05d4\u05d7\u05dc\u05e4\u05d4') && full.indexOf('big bag cross') > full.indexOf('\u05de\u05d7\u05db\u05d4 \u05dc\u05ea\u05e1\u05e7\u05d9\u05e8') && urg.includes('\u05de\u05d7\u05db\u05d4 \u05dc\u05ea\u05e1\u05e7\u05d9\u05e8') && urg.includes('\u05e4\u05e1\u05d5\u05dc') && cmp.includes('\u05de\u05d7\u05db\u05d4 \u05dc\u05ea\u05e1\u05e7\u05d9\u05e8'), { full, urg, cmp });
    check('brief: without the new lists it is as before', buildBrief(sp.items, [], T, false, [], null, null, null) === buildBrief(sp.items, [], T, false, [], null, null, null, false, [], []));
  }
  { // 27/10/2026: a row whose state passes while its latest note or deficiencies say it failed
    const rows = [{ n: 'extenders', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4', notes: 'safe load | 27/10/2026 Claude (routine-wa-assistant): \u05e0\u05e4\u05e1\u05dc \u05d1\u05d1\u05d3\u05d9\u05e7\u05d4 25/10/2026', deficiencies: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4' },
      { n: 'old fail', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4', notes: '\u05e0\u05e4\u05e1\u05dc 2024 | 27/10/2026 Claude: \u05e0\u05d1\u05d3\u05e7, \u05ea\u05e7\u05d9\u05df', deficiencies: '' },
      { n: 'deficiency', s: '\u05de\u05d5\u05ea\u05e8 \u05dc\u05e9\u05d9\u05de\u05d5\u05e9', notes: '', deficiencies: '\u05dc\u05d0 \u05ea\u05e7\u05d9\u05df: \u05e1\u05d3\u05e7' },
      { n: 'history', s: '\u05de\u05d5\u05ea\u05e8 \u05dc\u05e9\u05d9\u05de\u05d5\u05e9', notes: '\u05e0\u05de\u05e6\u05d0 \u05dc\u05d0 \u05ea\u05e7\u05d9\u05df, \u05e0\u05d1\u05d3\u05e7 \u05e9\u05d5\u05d1 \u05d5\u05e0\u05de\u05e6\u05d0 \u05ea\u05e7\u05d9\u05df.', deficiencies: '' },
      { n: 'marked', s: '\u05e4\u05e1\u05d5\u05dc', notes: '\u05e0\u05e4\u05e1\u05dc', deficiencies: '' }, { n: 'negated', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4', notes: '\u05dc\u05d0 \u05e0\u05e4\u05e1\u05dc', deficiencies: '' }];
    const c = rowContradictions(rows);
    check('contradiction: fit + latest note "disqualified", or fit + a failing deficiency; an older note, a free-text history note (3 false alarms live, 27/10), a row already disqualified, and "not disqualified" are not', c.join() === 'extenders,deficiency', c);
    { const waste = rowContradictions([{ n: 'compressor', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4', notes: '', deficiencies: '\u05d4\u05e6\u05d8\u05d1\u05e8\u05d5\u05ea \u05e4\u05e1\u05d5\u05dc\u05ea \u05d1\u05de\u05d3\u05d7\u05e1' }, { n: 'real', s: '\u05db\u05e9\u05d9\u05e8 \u05dc\u05e2\u05d1\u05d5\u05d3\u05d4', notes: '', deficiencies: '\u05d4\u05e6\u05d9\u05d5\u05d3 \u05e4\u05e1\u05d5\u05dc' }]);
      check('contradiction: the word "waste" (\u05e4\u05e1\u05d5\u05dc\u05ea) in a deficiency is not "disqualified" (28/10/2026 retro); "\u05e4\u05e1\u05d5\u05dc" still is', waste.join() === 'real', waste); }
    const b = buildBrief([], [], '2026-10-27', false, [], null, null, null, false, [], [], c), u = buildBrief([], [], '2026-10-27', false, [], null, null, null, true, [], [], c);
    check('brief: a contradiction line in the morning update, not in "what is urgent"', b.includes('\u05e9\u05d5\u05e8\u05d4 \u05e1\u05d5\u05ea\u05e8\u05ea') && b.includes('extenders') && !u.includes('\u05e9\u05d5\u05e8\u05d4 \u05e1\u05d5\u05ea\u05e8\u05ea'), { b, u });
  }
  console.log('\nwa-morning-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
