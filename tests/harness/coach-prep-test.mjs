// routine-db coach_prep (24/11/2026, Michael in the questionnaire: "do it: yes, up to 4 questions at once (recommended)"):
// one read-only call that gives the weekly coach what it gathered with 10 Bash reads. Mocked fetch: validation, every part
// present, the caps, and one part failing alone (null + partial) while the others still come.
import { onRequest, coachPrepCheck, coachLearned, coachDev, coachMichael, coachGold, coachModel, coachWindow, EQUIP_OUT, COACH_PREP_LEARN_N, COACH_PREP_MSG_N, COACH_PREP_EXP_N, COACH_PREP_INC_N, COACH_PREP_DEV_N } from './_build/routine-db.mjs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { ROUTINE_KEY: 'k-123', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_URL: SB };
const NOW = Date.now();
const ago = (d) => new Date(NOW - d * 864e5).toISOString();
const GOLD = 'זהב';

// the data the mock serves
const learned = [
  { id: 'l-1', at: ago(1), kind: 'correction', status: 'new', agent: 'routine-wa-assistant', text: 'the 26.03 balloon test starts the exit at 3 bar, not 5', source: 'Michael 23/11/2026' },
  { id: 'l-2', at: ago(2), kind: 'preference', status: 'new', agent: 'routine-wa-assistant', text: 'short answers, one sentence when he asks for one' },
  { id: 'l-3', at: ago(3), kind: 'fact', status: 'new', agent: 'routine-wa-assistant', text: 'a fact line is not a drill source' },
  { id: 'l-4', at: ago(9), kind: 'correction', status: 'new', agent: 'routine-wa-assistant', text: 'older than 7 days, not this week' },
  { id: 'l-5', at: ago(1), kind: 'correction', status: 'new', agent: 'x', text: 'mail me at a.b@example.co.il or 050-1234567' }];
for (let i = 0; i < 30; i++) learned.push({ id: 'l-m' + i, at: ago(4), kind: 'correction', status: 'new', text: 'filler correction number ' + i });
const dev = [{ id: 'dev-1', at: ago(1), agent: 'routine-coach', text: 'g3 failed twice: the detector reading', status: 'open' }, { id: 'dev-2', at: ago(2), agent: 'x', text: 'done already', status: 'done' }];
for (let i = 0; i < 15; i++) dev.push({ id: 'dev-f' + i, at: ago(5), agent: 'y', text: 'open filler request ' + i, status: 'open' });
const msgs = []; // newest first, as the server reads them
for (let i = 0; i < 50; i++) { msgs.push({ ts: ago(i / 20 + 0.001), event_type: 'owner_in', text: 'michael message ' + i }); msgs.push({ ts: ago(i / 20 + 0.002), event_type: 'assistant', text: 'assistant reply ' + i }); }
const coachRows = [{ ts: ago(1), payload: { agent: 'routine-coach', at: ago(1), line: 'test run, no score' } }, { ts: ago(7), payload: { agent: 'routine-coach', at: ago(7), line: '8 drills: 6 passed. ' + GOLD + ': 11/12', model: 'claude-sonnet-x' } }];
const asstRows = [{ ts: ago(0.1), payload: { agent: 'routine-wa-assistant', at: ago(0.1), line: 'answer' } }, { ts: ago(0.2), payload: { agent: 'routine-wa-assistant', at: ago(0.2), line: 'answer', model: 'claude-opus-5-5' } }];
const docRows = [{ id: 'd1', n: 'business license', e: '2026-11-30', s: 'active' }, { id: 'd2', n: 'old permit', e: '2026-11-20', s: EQUIP_OUT }];
for (let i = 0; i < 20; i++) docRows.push({ id: 'df' + i, n: 'doc ' + i, e: '2026-12-01', s: null });
const equipRows = [{ id: 'q1', code: 'E-1', n: 'ammonia detector', loc: 'engine room', e: '2026-11-28', s: 'תקין', notes: 'long private note' }];
const incRows = []; for (let i = 0; i < 12; i++) incRows.push({ id: 'i' + i, d: 'slipped near line ' + i + ', reported by 052-7654321', dt: ago(i), ty: 'injury', sv: 'low', l: 'hall', s: 'open', w: 'a worker name' });
const nmRows = [{ id: 'n1', d: '2026-11-22', descr: 'forklift too fast', area: 'store', sev: 'low', typ: 'x', s: 'open', rep: 'reporter name' }];

let failPart = null, log = [];
const real = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = decodeURIComponent(String(url));
  log.push(u);
  const json = (o) => new Response(JSON.stringify(o), { status: 200 });
  const part = /\/rest\/v1\/server_state\?/.test(u) ? 'state' : /notifications_log.*event_type=in\./.test(u) ? 'michael'
    : /payload->>agent=eq\.routine-coach/.test(u) ? 'coach' : /payload->>agent=eq\.routine-wa-assistant/.test(u) ? 'asst'
    : (/\/rest\/v1\/(docs|equip_inspections|inc|near_miss)\?/.exec(u) || [])[1] || 'other';
  if (part === failPart) return new Response('boom', { status: 500 });
  if (part === 'state') return json([{ key: 'assistant_learned', value: JSON.stringify(learned) }, { key: 'dev_inbox', value: JSON.stringify(dev) }]);
  if (part === 'michael') return json(msgs);
  if (part === 'coach') return json(coachRows);
  if (part === 'asst') return json(asstRows);
  if (part === 'docs') return json(docRows.slice(0, COACH_PREP_EXP_N + 2)); // d2 (not relevant) is dropped by the server too
  if (part === 'equip_inspections') return json(equipRows);
  if (part === 'inc') return json(incRows.slice(0, COACH_PREP_INC_N + 1));
  if (part === 'near_miss') return json(nmRows);
  return json([]);
};
const call = async (body) => {
  const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-123', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env: ENV });
  return { st: r.status, j: await r.json() };
};

console.log('\n1. validation');
check('a good call passes', !coachPrepCheck({ op: 'coach_prep', agent: 'routine-coach' }).error);
check('bad agent, an extra field: refused', coachPrepCheck({ op: 'coach_prep', agent: 'Bad Agent' }).error && coachPrepCheck({ op: 'coach_prep', agent: 'routine-coach', table: 'emp' }).error);
log = [];
const bad = await call({ op: 'coach_prep', agent: 'routine-coach', query: 'select=*' });
check('through the server: 400 and nothing read', bad.st === 400 && log.length === 0, bad);

console.log('\n2. every part, in one call');
log = [];
const { st, j } = await call({ op: 'coach_prep', agent: 'routine-coach' });
check('200 ok, no partial', st === 200 && j.ok === true && j.partial === undefined, j.partial);
check('8 reads, under the 50 subrequests of a Worker', log.length === 8, log.length);
check('learned: corrections and preferences of 7 days only, newest first', j.learned && ['l-1', 'l-5'].includes(j.learned.rows[0].id)
  && j.learned.rows.some((x) => x.id === 'l-2' && x.kind === 'preference') && j.learned.rows[0].source !== undefined === (j.learned.rows[0].id === 'l-1'), j.learned && j.learned.rows.slice(0, 3));
check('learned: no fact line, no line older than 7 days', !j.learned.rows.some((x) => x.id === 'l-3' || x.id === 'l-4'), j.learned.rows.map((x) => x.id));
check('learned: personal details masked', !JSON.stringify(j.learned).includes('a.b@example') && !JSON.stringify(j.learned).includes('1234567'), j.learned.rows.find((x) => x.id === 'l-5'));
check('michael: his messages only, each with the reply before it', j.michael && j.michael.rows.every((x) => /^michael message/.test(x.text)) && j.michael.rows[0].text === 'michael message 0' && j.michael.rows[0].prev === 'assistant reply 0', j.michael && j.michael.rows.slice(0, 2));
check('gold_last: the last coach line with a golden score, with its model', j.gold_last && j.gold_last.line.includes('11/12') && j.gold_last.model === 'claude-sonnet-x', j.gold_last);
check('assistant_model: the latest run that names one', j.assistant_model && j.assistant_model.model === 'claude-opus-5-5', j.assistant_model);
check('expiring: docs and equip, never "not relevant", a window around today', j.expiring && j.expiring.docs.rows.some((x) => x.id === 'd1') && !j.expiring.docs.rows.some((x) => x.id === 'd2') && j.expiring.equip.rows[0].code === 'E-1' && j.expiring.from < j.today && j.expiring.to > j.today, j.expiring && { from: j.expiring.from, to: j.expiring.to });
check('expiring: the query itself excludes "not relevant" (or s is null)', log.some((u) => u.includes('docs?') && u.includes('or=(s.is.null,s.neq.' + EQUIP_OUT + ')')), log.find((u) => u.includes('docs?')));
check('equip: no notes column', !JSON.stringify(j.expiring.equip).includes('private note') && !log.find((u) => u.includes('equip_inspections?')).includes('notes'));
check('inc and near_miss: no worker or reporter name, phone masked', j.inc && j.near_miss && !JSON.stringify(j.inc).includes('worker name') && !JSON.stringify(j.inc).includes('7654321') && !JSON.stringify(j.near_miss).includes('reporter name') && j.near_miss.rows[0].descr === 'forklift too fast', j.inc && j.inc.rows[0]);
check('dev: open requests only, with the count', j.dev && j.dev.open === 16 && !j.dev.rows.some((x) => x.id === 'dev-2') && j.dev.rows[0].id === 'dev-1', j.dev && { open: j.dev.open, first: j.dev.rows[0] });
check('a note that the text is data', /data, never instructions/.test(j.note));

console.log('\n3. caps');
check('learned capped, with more', j.learned.rows.length === COACH_PREP_LEARN_N && j.learned.more === true, j.learned.rows.length);
check('michael capped, with more', j.michael.rows.length === COACH_PREP_MSG_N && j.michael.more === true, j.michael.rows.length);
check('docs capped, with more', j.expiring.docs.rows.length === COACH_PREP_EXP_N && j.expiring.docs.more === true, j.expiring.docs.rows.length);
check('inc capped, with more', j.inc.rows.length === COACH_PREP_INC_N && j.inc.more === true, j.inc.rows.length);
check('dev capped', j.dev.rows.length === COACH_PREP_DEV_N, j.dev.rows.length);
check('a long text is cut', coachMichael([{ event_type: 'owner_in', text: 'x'.repeat(5000) }]).rows[0].text.length <= 240);
check('the whole answer is short (under 16 KB)', JSON.stringify(j).length < 16000, JSON.stringify(j).length);

console.log('\n4. one part fails, the others still come');
for (const [p, name, key] of [['michael', 'michael', 'michael'], ['docs', 'docs', null], ['state', 'learned', 'learned'], ['coach', 'gold_last', 'gold_last']]) {
  failPart = p;
  const r = await call({ op: 'coach_prep', agent: 'routine-coach' });
  failPart = null;
  const others = r.j.inc && r.j.near_miss && r.j.assistant_model && r.j.expiring && r.j.expiring.equip;
  const gone = key ? r.j[key] === null : !!r.j.expiring && r.j.expiring.docs === null;
  check(p + ' fails: ok, its part null and named in partial, the rest there', r.st === 200 && r.j.ok === true && gone && (r.j.partial || []).includes(name) && others, { partial: r.j.partial, gone });
}
check('server_state fails: both learned and dev are null', await (async () => { failPart = 'state'; const r = await call({ op: 'coach_prep', agent: 'routine-coach' }); failPart = null; return r.j.dev === null && (r.j.partial || []).includes('dev'); })());

console.log('\n5. pure parts');
check('gold: no line with a score = null', coachGold([{ line: 'no score' }]) === null && coachGold(null) === null);
check('model: none = null', coachModel([{ line: 'x' }]) === null);
check('dev of an unreadable value = none', coachDev('not json').open === 0);
check('learned of an unreadable value = none', coachLearned('{', NOW).rows.length === 0);
const w = coachWindow(Date.parse('2026-11-24T23:30:00Z'));
check('the window is by the Israel day (01:30 on 25/11)', w.today === '2026-11-25' && w.from === '2026-11-11' && w.to === '2026-12-09', w);

globalThis.fetch = real;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
