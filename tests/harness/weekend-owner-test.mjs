// Weekend quiet (06/11/2026, Michael: "I don't work on Friday and Saturday. Requests to the assistant yes, updates are
// less relevant"; in the questionnaire: "do it: collect for Sunday morning"). _wa.js weekendHold + wa-morning weekendStep.
//
// 1. Inventory: every sendToOwner( / sendDocToOwner( call site names a known kind. A new send to Michael with no
//    kind, or a kind that is in neither list, fails here (like server-mail-format-test.mjs for mails).
// 2. The rule: on Friday and Saturday (Israel) only the HELD kinds wait; NOW kinds (a reply, a hazard, a safety event,
//    the watchdog, the morning update) and anything unknown go at once; a held kind within an hour of Michael goes too.
// 3. The Sunday list: 10 lines at most, closed reminders dropped, "and N more".
// 4. With fetch mocked: a held send never reaches Meta; an urgent one on Saturday does; any failure on the way = sent.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendToOwner, sendDocToOwner, weekendHold, holdForWeekend, weekendAdd, weekendList, weekendIL, OWNER_NOW_KINDS, OWNER_HELD_KINDS, OWNER_KINDS, WEEKEND_KEY, WEEKEND_MAX, WEEKEND_SHOW } from './_build/_wa.mjs';
import { weekendText } from './_build/wa-morning.mjs';
import { waMeKind, WA_ME_URGENT, STATE_READ } from './_build/routine-db.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FN = path.join(HERE, '..', '..', 'functions');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

// ---------- 1. inventory ----------
console.log('\n1. every send to Michael names its kind');
// file -> number of call sites. A new site = a failure until it is added here with a kind.
const KNOWN_SITES = { 'api/works.js': 1, 'api/wa-hook.js': 5, 'api/trustee-notify.js': 1, 'api/wa-morning.js': 5, 'api/routine-db.js': 8, '_faults.js': 1 };
// kinds that are computed at the call: the expression must be exactly one of these
const DYNAMIC = { 'kind: waMeKind(body)': 'routine-db wa_me (agent, or body.urgent)', "kind: loud.some((x) => /^agentq?:wa-assistant$/.test(x.key)) ? 'watchdog' : 'fault'": 'faults: the assistant itself failing = watchdog' };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
const found = {};
for (const f of walk(FN)) {
  const rel = path.relative(FN, f).split(path.sep).join('/');
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => /\b(sendToOwner|sendDocToOwner)\(/.test(l) && !/^\s*(\/\/|\*)/.test(l) && !/function\s+(sendToOwner|sendDocToOwner)\b/.test(l) && !/^\s*import\b/.test(l));
  if (!lines.length) continue;
  found[rel] = lines.length;
  lines.forEach((l, i) => {
    const m = /kind: '([a-z]+)'/.exec(l);
    const dyn = Object.keys(DYNAMIC).find((d) => l.indexOf(d) >= 0);
    check(rel + ' #' + (i + 1) + ' has a known kind' + (m ? ' (' + m[1] + ')' : dyn ? ' (' + DYNAMIC[dyn] + ')' : ''), (m && OWNER_KINDS.indexOf(m[1]) >= 0) || !!dyn, l.trim().slice(0, 160));
  });
}
for (const rel of Object.keys(found)) check('call site count is known: ' + rel + ' (' + found[rel] + ')', KNOWN_SITES[rel] === found[rel], 'known=' + KNOWN_SITES[rel] + ' found=' + found[rel] + ' (add the new send with a kind, and to this list)');
for (const rel of Object.keys(KNOWN_SITES)) check('listed site still exists: ' + rel, found[rel] === KNOWN_SITES[rel], 'found=' + found[rel]);
check('the two lists do not overlap', OWNER_NOW_KINDS.every((k) => OWNER_HELD_KINDS.indexOf(k) < 0));
check('the urgent ones are NOW: reply, hazard, incident, watchdog, morning', ['reply', 'hazard', 'incident', 'watchdog', 'morning'].every((k) => OWNER_NOW_KINDS.indexOf(k) >= 0));
// the senders that must stay urgent, by their code (a reclassification by mistake fails here)
const src = (f) => fs.readFileSync(path.join(FN, f), 'utf8');
check('a held line is not an answer: the watch and the recent lines skip channel held', /event_type=eq\.assistant&channel=neq\.held/.test(src('api/wa-morning.js')) && /in\.\(owner_in,assistant\)&channel=neq\.held/.test(src('api/wa-hook.js')));
check('a sign request goes at once (held, it would stay pending with no buttons)', OWNER_NOW_KINDS.indexOf('sign') >= 0);
check('trustee hazards and near misses go as hazard', /sendToOwner\(env, to, text, \{ kind: 'hazard'/.test(src('api/trustee-notify.js')));
check('the "no answer yet" watch goes as watchdog', /sendToOwner\(env, to, v\.text, \{ kind: 'watchdog'/.test(src('api/wa-morning.js')));
check('every send in wa-hook (answers to Michael) is a reply', src('api/wa-hook.js').split('\n').filter((x) => /\b(sendToOwner|sendDocToOwner)\(/.test(x) && !/^\s*import/.test(x)).every((x) => x.indexOf("kind: 'reply'") >= 0));
check('the morning update is morning (it is what carries the list)', /kind: 'morning', windowOpen: open, choices: open \? MORNING_CHOICES/.test(src('api/wa-morning.js')));
check('a held send is not noted as the last message (Michael would answer one he never saw)', !/if \((r|s|sent)\.ok\) await noteLastOut/.test(src('api/routine-db.js') + src('api/wa-morning.js') + src('api/works.js')));

// ---------- 2. the rule ----------
console.log('\n2. Friday and Saturday only, held kinds only');
const IL = (s) => Date.parse(s); // UTC stamps; Israel is +2 in November
const THU = IL('2026-11-05T12:00:00Z'), FRI_EARLY = IL('2026-11-05T22:30:00Z'), FRI = IL('2026-11-06T09:00:00Z'), SAT = IL('2026-11-07T15:00:00Z'), SAT_LATE = IL('2026-11-07T21:30:00Z'), SUN = IL('2026-11-07T22:30:00Z');
check('weekendIL: Thursday no, Friday 00:30 Israel yes, Saturday yes, Saturday 23:30 yes, Sunday 00:30 no',
  !weekendIL(THU) && weekendIL(FRI_EARLY) && weekendIL(FRI) && weekendIL(SAT) && weekendIL(SAT_LATE) && !weekendIL(SUN));
check('every held kind waits on Saturday when Michael has not written', OWNER_HELD_KINDS.every((k) => holdForWeekend(k, SAT, 0)));
check('every NOW kind goes on Saturday', OWNER_NOW_KINDS.every((k) => !holdForWeekend(k, SAT, 0)));
check('an unknown or missing kind goes (an urgent message is never stuck)', !holdForWeekend(undefined, SAT, 0) && !holdForWeekend('xyz', SAT, 0));
check('a held kind 30 minutes after a message of his goes (a reply)', !holdForWeekend('agent', SAT, SAT - 30 * 60000));
check('a held kind 2 hours after his message waits', holdForWeekend('agent', SAT, SAT - 2 * 3600000));
check('Sunday to Thursday nothing waits', OWNER_HELD_KINDS.every((k) => !holdForWeekend(k, THU, 0) && !holdForWeekend(k, SUN, 0)));
check('wa_me: urgent hazard / incident / watchdog by name, anything else is agent', waMeKind({ urgent: 'incident' }) === 'incident' && waMeKind({ urgent: 'hazard' }) === 'hazard'
  && waMeKind({ urgent: 'watchdog' }) === 'watchdog' && waMeKind({ urgent: 'reply' }) === 'agent' && waMeKind({}) === 'agent' && WA_ME_URGENT.every((k) => OWNER_NOW_KINDS.indexOf(k) >= 0));
check('the assistant can read the held list ("what was held")', STATE_READ.indexOf('weekend_held') >= 0 && STATE_READ.indexOf('weekend_held_last') >= 0);

// ---------- 3. the Sunday list ----------
console.log('\n3. the Sunday list');
let l = [];
for (let i = 0; i < WEEKEND_MAX + 5; i++) l = weekendAdd(l, { at: 'a' + i, kind: 'agent', text: 'line ' + i });
check('weekendAdd: at most WEEKEND_MAX, the oldest out', l.length === WEEKEND_MAX && l[0].text === 'line 5');
check('weekendAdd: the same text once', weekendAdd(JSON.stringify([{ text: 'x', at: '1' }]), { text: 'x', at: '2' }).length === 1);
const prom = JSON.stringify([{ id: 'p-20261106100000-abcd', status: 'done' }, { id: 'p-20261106100000-efgh', status: 'open' }]);
const dev = JSON.stringify([{ id: 'dev-20261106100000-aaaa', status: 'done' }]);
const held = [
  { text: 'reminder of a kept promise', kind: 'reminder', ref: 'p-20261106100000-abcd' },
  { text: 'reminder of an open promise', kind: 'reminder', ref: 'p-20261106100000-efgh' },
  { text: 'a dev request that was done', kind: 'reminder', ref: 'dev dev-20261106100000-aaaa' },
  { text: 'a check on a kept promise', kind: 'agent', ref: 'promise:p-20261106100000-abcd' },
].concat(Array.from({ length: 12 }, (_, i) => ({ text: 'report ' + i, kind: 'agent' })));
const w = weekendList(JSON.stringify(held), prom, dev);
check('closed reminders dropped (promise kept, dev request done), open one kept', w.dropped === 2 && w.lines[0] === 'reminder of an open promise', w);
check('a result about a closed item (not a reminder) is kept: it is what he should hear', w.lines.indexOf('a check on a kept promise') >= 0);
check('10 lines at most, and how many more', w.lines.length === WEEKEND_SHOW && WEEKEND_SHOW === 10 && w.more === 4 && w.total === 14, w);
check('an internal id is cut from a line', weekendList(JSON.stringify([{ text: 'done dev-20261106100000-zzzz now' }]), '[]', '[]').lines[0].indexOf('dev-2026') < 0);
const full = weekendText(w, false), compact = weekendText(w, true);
check('the text: a heading with the count, lines, "and 4 more"', /מסוף השבוע \(14\):/.test(full) && full.split('\n- ').length === 11 && full.indexOf('ועוד 4') >= 0, full);
check('compact (template, one line): no new lines', compact.indexOf('\n') < 0 && compact.indexOf('ועוד 4') >= 0);
const longW = { lines: Array.from({ length: 10 }, (_, i) => 'a long report line number ' + i + ' ' + 'x'.repeat(90)), more: 0, total: 10 };
const fit = weekendText(longW, true, 400);
check('room left (the template is 1000 characters): only what fits, the rest counted in "and N more", never cut by WhatsApp', fit.length <= 400 && /ועוד \d+/.test(fit) && fit.indexOf('number 0') >= 0 && fit.indexOf('number 9') < 0, fit);
const none = weekendText(longW, true, 60);
check('no room for a line: the heading and "write what was held"', none.length <= 80 && none.indexOf('(10)') >= 0 && none.indexOf('number') < 0, none);
check('keyboard characters only', !/[–—‘’“”…־]/.test(full + compact));
check('nothing held = nothing added', weekendText({ lines: [] }, false) === '' && weekendText(null, true) === '');

// ---------- 4. with fetch ----------
console.log('\n4. the send itself (fetch mocked)');
const ENV = { META_PHONE_NUMBER_ID: 'P1', META_ACCESS_TOKEN: 'mt', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://sb.example' };
let calls = [], ownerInAt = null, ownerInFail = false, writeFail = false, state = null, lostRace = false, casReads = 0;
const realNow = Date.now;
globalThis.fetch = async (u, o = {}) => {
  calls.push({ u: String(u), o });
  u = String(u);
  if (u.indexOf('event_type=eq.owner_in') >= 0) return ownerInFail ? new Response('{}', { status: 500 }) : new Response(JSON.stringify(ownerInAt ? [{ ts: ownerInAt }] : []));
  // the held list goes through stateCas: read with updated_at, then PATCH (row exists) or POST (first write)
  if (u.indexOf('key=eq.' + WEEKEND_KEY) >= 0 && (o.method || 'GET') === 'GET') { casReads++; return new Response(JSON.stringify(state ? [{ value: state, updated_at: '2026-01-01T00:00:00.000Z' }] : [])); }
  if (u.indexOf('key=eq.' + WEEKEND_KEY) >= 0 && o.method === 'PATCH') {
    if (writeFail) return new Response('{}', { status: 500 });
    if (lostRace) { lostRace = false; state = JSON.stringify(JSON.parse(state || '[]').concat([{ at: 'x', kind: 'agent', text: 'written by another send in between' }])); return new Response('[]'); }
    state = JSON.parse(o.body).value; return new Response('[{}]');
  }
  if (u.indexOf('server_state?on_conflict=key') >= 0) {
    const b = JSON.parse(o.body)[0];
    if (b.key === WEEKEND_KEY) { if (writeFail) return new Response('{}', { status: 500 }); state = b.value; return new Response('[{}]', { status: 201 }); }
    return new Response('', { status: 201 });
  }
  if (u.indexOf('server_state?key=eq.') >= 0) return new Response('[]');
  if (u.indexOf('notifications_log') >= 0) return new Response(u.indexOf('select=') >= 0 ? '[]' : '', { status: u.indexOf('select=') >= 0 ? 200 : 201 });
  if (u.endsWith('/P1/messages')) return new Response(JSON.stringify({ messages: [{ id: 'wamid.X' }] }));
  if (u.endsWith('/P1/media')) return new Response(JSON.stringify({ id: 'M1' }));
  return new Response('{}', { status: 404 });
};
const meta = () => calls.filter((c) => /graph\.facebook\.com/.test(c.u)).length;
const at = (ms) => { Date.now = () => ms; };
(async () => {
  try {
    at(SAT);
    let r = await sendToOwner(ENV, '9725', 'reminder: the report for the committee', { kind: 'reminder', ref: 'p-20261106100000-efgh', windowOpen: true });
    check('Saturday, a reminder: kept, nothing to Meta', r.ok && r.held && r.via === 'held' && meta() === 0, r);
    const kept = JSON.parse(state);
    check('kept with its kind, ref and Israel-time text', kept.length === 1 && kept[0].kind === 'reminder' && kept[0].ref === 'p-20261106100000-efgh', kept);
    calls = [];
    r = await sendToOwner(ENV, '9725', 'a new hazard from a trustee', { kind: 'hazard', windowOpen: true });
    check('Saturday, a hazard: to Meta at once, the held list not even read', r.ok && !r.held && meta() === 1 && !calls.some((c) => c.u.indexOf('event_type=eq.owner_in') >= 0), r);
    calls = [];
    for (const k of OWNER_NOW_KINDS) await sendToOwner(ENV, '9725', 'urgent ' + k + ' ' + Math.random(), { kind: k, windowOpen: true });
    check('Saturday, every NOW kind reaches Meta', meta() === OWNER_NOW_KINDS.length, meta());
    calls = [];
    r = await sendToOwner(ENV, '9725', 'no kind at all, sent anyway', { windowOpen: true });
    check('Saturday, no kind: sent (fail-open)', r.ok && !r.held && meta() === 1);
    calls = [];
    ownerInAt = new Date(SAT - 20 * 60000).toISOString();
    r = await sendToOwner(ENV, '9725', 'the answer to what he asked 20 minutes ago', { kind: 'agent', windowOpen: true });
    check('Saturday, an agent line 20 minutes after his message: sent', r.ok && !r.held && meta() === 1, r);
    calls = []; ownerInAt = null; ownerInFail = true;
    r = await sendToOwner(ENV, '9725', 'owner_in read fails: sent, not lost', { kind: 'agent', windowOpen: true });
    check('Saturday, the read of his last message fails: sent', r.ok && !r.held && meta() === 1, r);
    calls = []; ownerInFail = false; writeFail = true;
    r = await sendToOwner(ENV, '9725', 'the held list cannot be written: sent, not lost', { kind: 'agent', windowOpen: true });
    check('Saturday, the write fails: sent', r.ok && !r.held && meta() === 1, r);
    writeFail = false; calls = []; lostRace = true; casReads = 0;
    r = await sendToOwner(ENV, '9725', 'held while another send wrote the list', { kind: 'agent', windowOpen: true });
    const both = JSON.parse(state).map((x) => x.text);
    check('two holds at once: the second reads again and both lines stay (compare-and-swap)', r.held && casReads === 2 && both.indexOf('written by another send in between') >= 0 && both.indexOf('held while another send wrote the list') >= 0, both);
    calls = [];
    r = await sendDocToOwner(ENV, '9725', new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'form.pdf', '', true, { kind: 'file', path: 'a/b/c/form.pdf' });
    check('Saturday, a file an agent sends: kept as a line with the file name, nothing to Meta', r.held && meta() === 0 && JSON.parse(state).some((x) => x.text.indexOf('form.pdf') >= 0), r);
    calls = [];
    r = await sendDocToOwner(ENV, '9725', new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'asked.pdf', '', true, { kind: 'reply', path: 'a/asked.pdf' });
    check('Saturday, a file he asked for: sent', r.ok && !r.held && meta() === 2, r);
    calls = []; at(THU);
    r = await sendToOwner(ENV, '9725', 'a Thursday reminder goes as always', { kind: 'reminder', windowOpen: true });
    check('Thursday, a reminder: sent, no extra reads', r.ok && !r.held && meta() === 1 && !calls.some((c) => c.u.indexOf('owner_in') >= 0), r);
    check('WEEKEND_QUIET=off (Cloudflare env): nothing kept, no reads', (await weekendHold(Object.assign({}, ENV, { WEEKEND_QUIET: 'off' }), 'reminder', 'x', null, SAT)) === null);
    const evN = weekendHold(ENV, 'reminder', 'x', null, SUN);
    check('Sunday 00:30: weekendHold keeps nothing', (await evN) === null);
  } finally { Date.now = realNow; }
  console.log('\nweekend-owner-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
