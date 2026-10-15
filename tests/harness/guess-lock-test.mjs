// The guessing lock (10/10/2026, the security review for Michael: "מבחינת אבטחת מידע זה תקין?"):
// every attempt at the HR code or the trustee code counts first (guess_hit), ten from one address in
// an hour and the eleventh is refused even with the right code, a right code clears the count, the
// first lock is kept for the weekly mail, and a database that cannot count does not shut HR out.
import { onRequest, makePermToken, GUESS_LIMIT, guessKey } from './_build/talk.mjs';
import { guessLocksLine, passwordAgeLines } from './_build/weekly-digest.mjs';
import { ipBucket } from './_build/_shared.mjs';
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
  if (u.startsWith(SB + '/rest/v1/oauth_tokens')) return j([{ user_email: 'sviva@tapugan.co.il', refresh_token: 'r', access_token: 'at', expires_at: new Date(Date.now() + 3600e3).toISOString(), scope: 'Files.ReadWrite Mail.Send' }]);
  if (u === 'https://graph.microsoft.com/v1.0/me/sendMail') { w.mails = (w.mails || []).concat([JSON.parse(init.body)]); return new Response(null, { status: 202 }); }
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
  const lm = (w.mails || []).map((x) => x.message);
  check('the lock: one mail to Michael, which password and what to do, never the address', lm.length === 1 && lm[0].toRecipients[0].emailAddress.address === 'sviva@tapugan.co.il' && /נעילה על ניחוש סיסמה: סיסמת משאבי אנוש/.test(lm[0].subject) && /פתח עכשיו/.test(lm[0].body.content) && !JSON.stringify(lm).includes('1.2.3.4'), lm.map((x) => x.subject));
  check('IPv6: the same /64 is one bucket, written short or long, any case', ipBucket('2001:db8:1:2:aaaa:bbbb:cccc:dddd') === ipBucket('2001:0DB8:0001:0002::1') && ipBucket('2001:db8:1:2::') === ipBucket('2001:db8:1:2:0:0:0:9'));
  check('IPv6: another /64 is another bucket', ipBucket('2001:db8:1:3::1') !== ipBucket('2001:db8:1:2::1'));
  check('an IPv4 inside an IPv6 keeps its own bucket (not 0:0:0:0 for everyone)', new Set(['::ffff:1.2.3.4', '::ffff:5.6.7.8', '::ffff:0102:0304', '::ffff:0506:0708', '64:ff9b::1.2.3.4', '64:ff9b::5.6.7.8']).size === new Set(['::ffff:1.2.3.4', '::ffff:5.6.7.8', '::ffff:0102:0304', '::ffff:0506:0708', '64:ff9b::1.2.3.4', '64:ff9b::5.6.7.8'].map(ipBucket)).size, ['::ffff:1.2.3.4', '::ffff:0102:0304', '::1'].map(ipBucket));
  check('edge inputs do not throw and stay distinct: ::1, ::, zone, junk, none', ipBucket('::1') !== ipBucket('::') && ipBucket('fe80::1%eth0') === ipBucket('fe80::2') && ipBucket('1:2:3:4:5:6:7:8:9') === '1:2:3:4:5:6:7:8:9' && ipBucket(undefined) === 'none' && ipBucket('1.2.3.4') === '1.2.3.4');
  const gsrc = ['talk', 'trustee-gate'].map((f) => fs.readFileSync(new URL('../../functions/api/' + f + '.js', import.meta.url), 'utf8'));
  check('both copies of guessKey count by ipBucket', gsrc.every((x) => x.includes('ipBucket(request.headers.get(')));
  r = await code('246810', '5.6.7.8');
  check('another address is not locked', r.st === 303);
  w.rpcDown = true;
  r = await code('246810', '9.9.9.9');
  check('the count cannot be read: the check goes on (HR not shut out)', r.st === 303);
  w.rpcDown = false;
}

console.log('\n2. the trustee code');
{
  const src = fs.readFileSync(new URL('../../functions/api/trustee-gate.js', import.meta.url), 'utf8').replace("from '../_shared.js'", "from './_shared.mjs'").replace("from '../_onedrive.js'", "from './_onedrive.mjs'");
  fs.writeFileSync(new URL('./_build/trustee-gate-g.mjs', import.meta.url), src);
  const { onRequest: gate } = await import('./_build/trustee-gate-g.mjs');
  const g = async (c, ip) => { const r = await gate({ request: new Request('https://tapugan-safety.pages.dev/api/trustee-gate', { method: 'POST', body: JSON.stringify({ code: c }), headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev', 'cf-connecting-ip': ip || '7.7.7.7' } }), env: ENV }); let b = null; try { b = await r.json(); } catch (e) { b = null; } return { st: r.status, b }; };
  check('the right code opens', (await g('482913')).st === 200);
  for (let i = 0; i < 10; i++) await g('000000');
  const r = await g('482913');
  check('ten wrong: the eleventh refused (429) with a message', r.st === 429 && /יותר מדי ניסיונות/.test(r.b.message), r);
  check('...the lock is logged as the trustee code', w.locks.some((x) => x.s === 'tru'));
  // 15/10/2026: the lock record and the mail go through waitUntil, so the eleventh guess is not held up.
  const jobs = [], m0 = (w.mails || []).length;
  const gw = async (c) => (await gate({ request: new Request('https://tapugan-safety.pages.dev/api/trustee-gate', { method: 'POST', body: JSON.stringify({ code: c }), headers: { 'Content-Type': 'application/json', origin: 'https://tapugan-safety.pages.dev', 'cf-connecting-ip': '8.8.8.8' } }), env: ENV, waitUntil: (p) => jobs.push(p) })).status;
  for (let i = 0; i < 10; i++) await gw('000000');
  const st11 = await gw('000000');
  check('with waitUntil: the lock mail is handed to it, not awaited inline', st11 === 429 && jobs.length === 1 && (w.mails || []).length === m0, [st11, jobs.length]);
  await Promise.all(jobs);
  check('...and it still goes out', (w.mails || []).length === m0 + 1);
}

console.log('\n3. the weekly mail');
{
  const now = Date.parse('2026-10-11T08:00:00Z');
  check('no locks: no line', guessLocksLine('', now) === null && guessLocksLine('[]', now) === null);
  const L = guessLocksLine(JSON.stringify([{ at: '2026-10-10T10:00:00Z', s: 'ind' }, { at: '2026-10-09T10:00:00Z', s: 'tru' }, { at: '2026-09-20T10:00:00Z', s: 'ind' }]), now);
  check('this week only, by code, red, and what to do', L && L.red && /: 2 \(/.test(L.text) && /משאבי אנוש: 1/.test(L.text) && /נאמנים: 1/.test(L.text) && L.text.includes('משתמשים וסיסמאות'), L);
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
