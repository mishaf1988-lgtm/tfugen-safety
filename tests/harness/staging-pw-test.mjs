// staging_pw (18/11/2026, dev request from the fault alert): the weekly staging-e2e run sets the test user's
// password through /api/routine-db instead of execute_sql, which waits for a tap in a scheduled run.
// Only the test database, only claude-test@tfugen.local, the password is never echoed.
import { onRequest, stagingPw, STAGING_TEST_EMAIL, STAGING_PW_RE } from './_build/routine-db.mjs';
import { SITE } from './_build/_shared.mjs';

let pass = 0, fail = 0;
const check = (name, ok, info) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name, info ? JSON.stringify(info) : ''); } };

const STG = 'https://abcdefghijklmnopqrst.supabase.co';
let calls = [], users = [{ id: 'u-other', email: 'admin@tfugen.local' }, { id: 'u-test', email: STAGING_TEST_EMAIL }], putStatus = 200;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  calls.push({ url, method: opt.method || 'GET', body: opt.body, key: (opt.headers || {}).apikey });
  if (url.startsWith(STG + '/auth/v1/admin/users?')) return new Response(JSON.stringify({ users }), { status: 200 });
  if (url.startsWith(STG + '/auth/v1/admin/users/')) return new Response('{}', { status: putStatus });
  return new Response('[]', { status: 200 });
};
const ENV = { ROUTINE_KEY: 'k-1', SUPABASE_SERVICE_ROLE_KEY: 'live-key', STAGING_SUPABASE_URL: STG, STAGING_SUPABASE_SERVICE_ROLE_KEY: 'stg-key', WEEKEND_QUIET: 'off' };
const call = async (body, env = ENV) => {
  const r = await onRequest({ request: new Request('https://x/api/routine-db', { method: 'POST', headers: { 'x-routine-key': 'k-1', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch (e) { /* */ }
  return { status: r.status, json, text };
};

(async () => {
  console.log('staging-pw-test');
  // pairs: 3 that must match (the run's token_hex(10), 36 hex, the 64 max) and 3 that must not
  const yes = ['0f1e2d3c4b5a69788796', 'a'.repeat(36), '0123456789abcdef'.repeat(4)];
  const no = ['0f1e2d3c4b5a6978879', '0123456789ABCDEF0123', 'a'.repeat(65)];
  check('STAGING_PW_RE: 3 real passwords match, 3 wrong ones (19 chars, uppercase, 65 chars) do not', yes.every((x) => STAGING_PW_RE.test(x)) && no.every((x) => !STAGING_PW_RE.test(x)));
  check('the test email is claude-test at the login domain', STAGING_TEST_EMAIL === 'claude-test@' + SITE.loginDomain);
  // 1. caller password: set on the test user only, on the test database only, never echoed
  calls = [];
  const pw = 'a1b2c3d4e5f6a7b8c9d0';
  let r = await call({ op: 'staging_pw', agent: 'staging-e2e', pw });
  const put = calls.filter((c) => c.method === 'PUT');
  check('caller pw: ok, one PUT to the test user on the test database with the test key', r.json.ok && r.json.set === 'caller' && put.length === 1
    && put[0].url === STG + '/auth/v1/admin/users/u-test' && put[0].key === 'stg-key' && JSON.parse(put[0].body).password === pw, { r: r.json, put });
  check('caller pw: the password is not in the response', r.text.indexOf(pw) < 0);
  check('nothing reached the live database', calls.every((c) => c.url.startsWith(STG)), calls.map((c) => c.url));

  // 2. no pw = random, 36 hex, not returned
  calls = [];
  r = await call({ op: 'staging_pw', agent: 'staging-e2e' });
  const p2 = calls.filter((c) => c.method === 'PUT');
  const rnd = p2.length ? JSON.parse(p2[0].body).password : '';
  check('no pw: a random 36-hex password is set and not returned', r.json.ok && r.json.set === 'random' && /^[0-9a-f]{36}$/.test(rnd) && r.text.indexOf(rnd) < 0, { r: r.json });

  // 3. refusals
  check('bad pw (short / not hex / not a string) = 400, no PUT', await (async () => {
    calls = [];
    const a = await call({ op: 'staging_pw', pw: 'short' }), b = await call({ op: 'staging_pw', pw: 'Z'.repeat(24) }), c = await call({ op: 'staging_pw', pw: 12345678901234567890 });
    return a.status === 400 && b.status === 400 && c.status === 400 && !calls.some((x) => x.method === 'PUT');
  })());
  check('extra field = 400', (await call({ op: 'staging_pw', pw, email: 'x@y' })).status === 400);
  calls = [];
  r = await call({ op: 'staging_pw', pw }, { ...ENV, STAGING_SUPABASE_URL: SITE.supabaseUrl });
  check('STAGING_SUPABASE_URL = the live database: refused, no call at all', !r.json.ok && calls.length === 0, { r: r.json, calls });
  r = await call({ op: 'staging_pw', pw }, { ...ENV, STAGING_SUPABASE_URL: 'https://evil.example.com' });
  check('STAGING_SUPABASE_URL not a supabase project: refused', !r.json.ok);
  r = await call({ op: 'staging_pw', pw }, { ...ENV, STAGING_SUPABASE_SERVICE_ROLE_KEY: '' });
  check('no staging key: refused with the reason', !r.json.ok && /STAGING_SUPABASE_SERVICE_ROLE_KEY/.test(r.json.error || ''));
  users = [{ id: 'u-other', email: 'admin@tfugen.local' }]; calls = [];
  r = await call({ op: 'staging_pw', pw });
  check('test user missing: refused, no PUT to another user', !r.json.ok && !calls.some((c) => c.method === 'PUT'), r.json);
  users = [{ id: 'u-test', email: STAGING_TEST_EMAIL }]; putStatus = 422;
  r = await call({ op: 'staging_pw', pw });
  check('PUT failed: ok:false with the status', !r.json.ok && /422/.test(r.json.error || ''), r.json);
  putStatus = 200;
  check('stagingPw direct: liveUrl equal to staging = refused', !(await stagingPw(ENV, pw, STG)).ok);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
