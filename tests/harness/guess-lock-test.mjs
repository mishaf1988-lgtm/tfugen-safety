// The guessing lock (10/10/2026, the security review for Michael: "מבחינת אבטחת מידע זה תקין?"):
// every attempt at the HR code or the trustee code counts first (guess_hit), ten from one address in
// an hour and the eleventh is refused even with the right code, a right code clears the count, the
// first lock is kept for the weekly mail, and a database that cannot count does not shut HR out.
import { onRequest, makePermToken, GUESS_LIMIT, guessKey } from './_build/talk.mjs';
import { guessLocksLine, passwordAgeLines } from './_build/weekly-digest.mjs';
import fs from 'fs';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', TRUSTEE_NOTIFY_SECRET: 'nsec', TRUSTEE_CODE: '482913' };
const IND = { id: 'ind1', d: '2026-10-11', title: 'קליטה', body: 'x', s: 'פורסמה', kind: 'induction', link_v: 0 };
const w = { counts: {}, clears: [], locks: null, rpcDown: false };
globalThis.fetch = async (url, init) => {
  const u = String(url), m = (init && init.method) || 'GET';
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u === SB + '/rest/v1/rpc/guess_hit') { if (w.rpcDown) return new Response('x', { status: 500 }); const k = JSON.parse(init.body).p_key; w.lastKey = k; w.counts[k] = (w.counts[k] || 0) + 1; return j(w.counts[k]); }
  if (u === SB + '/rest/v1/rpc/guess_clear') { const k = JSON.parse(init.body).p_key; w.clears.push(k); w.counts[k] = 0; return new Response(null, { status: 204 }); }
  if (u.startsWith(SB + '/rest/v1/server_state') && m === 'POST') { const b = JSON.parse(init.body); if (b.key === 'guess_locks') w.locks = JSON.parse(b.value); return new Response(null, { status: 201 }); }
  if (u.includes('key=eq.guess_locks')) return j(w.locks ? [{ value: JSON.stringify(w.locks) }] : []);
  if (u.includes('key=eq.induction_code')) return j([{ value: '246810' }]);
  if (u.includes('key=eq.trustee_code')) return j([]);
  if (u.startsWith(SB + '/rest/v1/toolbox_talks')) return j([IND]);
  return j({ error: 'unexpected ' + u }, 599);
};
const k = await makePermToken(ENV, 'ind1', 0);
const code = async (val, ip) => { const fd = new FormData(); fd.append('k', k); fd.append('l', 'he'); fd.append('icode', val); const r = await onRequest({ request: new Request('https://tapugan-safety.pages.dev/api/talk', { method: 'POST', body: fd, headers: { 'cf-connecting-ip': ip || '1.2.3.4' } }), env: ENV }); return { st: r.status, h: await r.text() }; };

console.log('\n1. the HR code');
{
  check('the limit is 10', GUESS_LIMIT === 10);
  const key = await guessKey('ind', new Request('https://x', { headers: { 'cf-connecting-ip': '1.2.3.4' } }));
  check('the key is a hash of the address, not the address', /^guess:ind:[0-9a-f]{16}$/.test(key) && !key.includes('1.2.3.4'), key);
  let r = await code('246810');
  check('the right code: 303, and the count is cleared', r.st === 303 && w.clears.includes(key), [r.st, w.clears]);
  for (let i = 0; i < 10; i++) await code('000000');
  r = await code('246810');
  check('ten wrong in the hour: the eleventh is refused even with the right code (429), says so, no field', r.st === 429 && r.h.includes('יותר מדי ניסיונות') && !r.h.includes('name="icode"'), [r.st, r.h.slice(-400)]);
  check('...the first lock is kept for the weekly mail', w.locks && w.locks.length === 1 && w.locks[0].s === 'ind' && w.locks[0].at, w.locks);
  await code('246810');
  check('...and a later attempt does not add another lock entry', w.locks.length === 1);
  r = await code('246810', '5.6.7.8');
  check('another address is not locked', r.st === 303);
  w.rpcDown = true;
  r = await code('246810', '9.9.9.9');
  check('the count cannot be read: the check goes on (HR not shut out)', r.st === 303);
  w.rpcDown = false;
}

console.log('\n2. the trustee code');
{
  const src = fs.readFileSync(new URL('../../functions/api/trustee-gate.js', import.meta.url), 'utf8').replace("from '../_shared.js'", "from './_shared.mjs'");
  fs.writeFileSync(new URL('./_build/trustee-gate-g.mjs', import.meta.url), src);
  const { onRequest: gate } = await import('./_build/trustee-gate-g.mjs');
  const g = async (c, ip) => { const r = await gate({ request: new Request('https://tapugan-safety.pages.dev/api/trustee-gate', { method: 'POST', body: JSON.stringify({ code: c }), headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev', 'cf-connecting-ip': ip || '7.7.7.7' } }), env: ENV }); let b = null; try { b = await r.json(); } catch (e) { b = null; } return { st: r.status, b }; };
  check('the right code opens', (await g('482913')).st === 200);
  for (let i = 0; i < 10; i++) await g('000000');
  const r = await g('482913');
  check('ten wrong: the eleventh refused (429) with a message', r.st === 429 && /יותר מדי ניסיונות/.test(r.b.message), r);
  check('...the lock is logged as the trustee code', w.locks.some((x) => x.s === 'tru'));
}

console.log('\n3. the weekly mail');
{
  const now = Date.parse('2026-10-11T08:00:00Z');
  check('no locks: no line', guessLocksLine('', now) === null && guessLocksLine('[]', now) === null);
  const L = guessLocksLine(JSON.stringify([{ at: '2026-10-10T10:00:00Z', s: 'ind' }, { at: '2026-10-09T10:00:00Z', s: 'tru' }, { at: '2026-09-20T10:00:00Z', s: 'ind' }]), now);
  check('this week only, by code, red, and what to do', L && L.red && /: 2 \(/.test(L.text) && /משאבי אנוש: 1/.test(L.text) && /נאמנים: 1/.test(L.text) && L.text.includes('🔐 קודים'), L);
}

console.log('\n4. a password not changed for a year (weekly mail)');
{
  const now = Date.parse('2026-10-11T08:00:00Z');
  const fresh = { induction_code: { value: 'x', at: '2026-10-10T10:00:00Z' }, trustee_code: { value: 'y', at: '2026-10-10T10:00:00Z' } };
  check('both changed this year: no line', passwordAgeLines(fresh, {}, now) === null);
  const L = passwordAgeLines({ induction_code: { value: 'x', at: '2025-09-01T10:00:00Z' }, trustee_code: { value: 'y', at: '2025-10-01T10:00:00Z' } }, {}, now);
  check('both over a year: two red lines, with the date', L && L.length === 2 && L.every((x) => x.red) && /01\/09\/2025/.test(L[0].text) && /01\/10\/2025/.test(L[1].text), L);
  const C = passwordAgeLines({ induction_code: { value: 'x', at: '2026-10-10T10:00:00Z' } }, { TRUSTEE_CODE: '482913' }, now);
  check('the trustee password still in Cloudflare: one plain line', C && C.length === 1 && !C[0].red && /Cloudflare/.test(C[0].text), C);
  const N = passwordAgeLines({}, {}, now);
  check('no HR password at all: red, the form is closed', N && N.length === 1 && N[0].red && /סגור/.test(N[0].text), N);
  check('never the value itself', !JSON.stringify(passwordAgeLines({ induction_code: { value: 'secret123', at: '2020-01-01T00:00:00Z' } }, {}, now)).includes('secret123'));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
