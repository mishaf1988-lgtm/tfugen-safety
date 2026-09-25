// must_change_password lives in app_metadata (2026-09-25, advisor
// rls_references_user_metadata). user_metadata is the user's own to rewrite
// (updateUser({data})), so a policy that reads the flag from there can be
// released by the very user it is meant to hold. This proves, on the real
// functions with fetch mocked and on the migration text:
//   - create-user sends app_metadata.must_change_password=true (and keeps the
//     user_metadata copy for the client / the transition)
//   - reset-password sets the password FIRST and the app_metadata flag in a
//     SECOND request (the trigger clears the flag on a password change, so one
//     combined PUT could wipe what it set), preserving existing app_metadata
//   - the migration: every pwchange_required reads app_metadata, none reads
//     user_metadata, the trigger is BEFORE UPDATE OF encrypted_password, the
//     backfill carries flagged users over, auth.jwt() is wrapped in (select)
//   - doLogin (real index.html in Chromium) opens the forced-change modal on
//     either flag and not when both are absent
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const ORIGIN = 'https://tapugan-safety.pages.dev';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// ESM copies of the two functions, the way run.sh builds the others.
fs.mkdirSync(path.join(__dirname, '_build'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'functions/_shared.js'), path.join(__dirname, '_build/_shared.mjs'));
for (const f of ['create-user', 'reset-password']) {
  const src = fs.readFileSync(path.join(ROOT, 'functions/api/' + f + '.js'), 'utf8').replace("'../_shared.js'", "'./_shared.mjs'");
  fs.writeFileSync(path.join(__dirname, '_build/' + f + '.mjs'), src);
}
const { onRequest: createUser } = await import('./_build/create-user.mjs');
const { onRequest: resetPassword } = await import('./_build/reset-password.mjs');

const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
function world(existingUser) {
  const w = { calls: [] };
  globalThis.fetch = async (url, init) => {
    const u = String(url); const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    w.calls.push({ u: u.replace(SB, ''), method, body });
    if (u.startsWith(SB + '/auth/v1/user')) return json({ id: 'adm', email: 'admin@tfugen.local' });
    if (u.startsWith(SB + '/auth/v1/admin/users?')) return json({ users: existingUser ? [existingUser] : [] });
    if (u.startsWith(SB + '/auth/v1/admin/users')) return json({ id: existingUser ? existingUser.id : 'new-id' });
    if (u.startsWith(SB + '/rest/v1/')) return json([]);
    return json({});
  };
  return w;
}
const call = (fn, body) => fn({ request: new Request(ORIGIN + '/api/x', { method: 'POST', headers: { origin: ORIGIN, authorization: 'Bearer tok', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env: ENV });

console.log('\n1. create-user');
{
  const w = world(null);
  const r = await call(createUser, { username: 'dani', full_name: 'Dani', role: 'מנהל' });
  const j = await r.json();
  const create = w.calls.find((c) => c.u === '/auth/v1/admin/users' && c.method === 'POST');
  check('the user is created (200)', r.status === 200 && j.success === true, { status: r.status, j });
  check('app_metadata.must_change_password=true is sent with the create', create && create.body.app_metadata && create.body.app_metadata.must_change_password === true, create && create.body);
  check('the user_metadata copy is still there for the client', create && create.body.user_metadata && create.body.user_metadata.must_change_password === true && create.body.user_metadata.username === 'dani', create && create.body.user_metadata);
}

console.log('\n2. reset-password');
{
  const w = world({ id: 'u-dani', email: 'dani@tfugen.local', user_metadata: { username: 'dani', full_name: 'Dani' }, app_metadata: { provider: 'email', providers: ['email'] } });
  const r = await call(resetPassword, { username: 'dani' });
  const j = await r.json();
  const puts = w.calls.filter((c) => c.u === '/auth/v1/admin/users/u-dani' && c.method === 'PUT');
  check('the reset succeeds and returns a temporary password', r.status === 200 && j.success === true && /^[a-z0-9]{8}$/.test(j.password || ''), { status: r.status, j });
  check('two PUTs: password first, app_metadata flag second', puts.length === 2 && 'password' in puts[0].body && !('app_metadata' in puts[0].body) && !('password' in puts[1].body) && puts[1].body.app_metadata && puts[1].body.app_metadata.must_change_password === true, puts.map((p) => Object.keys(p.body)));
  check('the first PUT keeps the legacy user_metadata flag and the existing keys', puts[0] && puts[0].body.user_metadata && puts[0].body.user_metadata.must_change_password === true && puts[0].body.user_metadata.username === 'dani', puts[0] && puts[0].body.user_metadata);
  check('the second PUT preserves the existing app_metadata (provider)', puts[1] && puts[1].body.app_metadata.provider === 'email', puts[1] && puts[1].body.app_metadata);

  // the flag request fails -> the endpoint says so instead of reporting success
  const w2 = world({ id: 'u-dani', email: 'dani@tfugen.local', user_metadata: {}, app_metadata: {} });
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => { const b = init && init.body ? JSON.parse(init.body) : null; if (b && b.app_metadata) return new Response('nope', { status: 500 }); return inner(url, init); };
  const r2 = await call(resetPassword, { username: 'dani' });
  const j2 = await r2.json();
  check('a failed flag write is reported as a failure, not success', r2.status === 502 && /flag failed/.test(j2.error || ''), { status: r2.status, j2 });
  void w2;
}

console.log('\n3. the migration');
{
  const mig = fs.readFileSync(path.join(ROOT, 'migrations/2026-09-25_pwchange_app_metadata.sql'), 'utf8');
  const code = mig.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const policyLines = code.split('\n').filter((l) => /must_change_password/.test(l) && /USING|WITH CHECK/.test(l));
  check('every pwchange_required USING / WITH CHECK reads app_metadata (' + policyLines.length + ' lines)', policyLines.length >= 4 && policyLines.every((l) => /'app_metadata'/.test(l)), policyLines.filter((l) => !/'app_metadata'/.test(l)));
  check('none of them reads user_metadata', !policyLines.some((l) => /user_metadata/.test(l)));
  check('auth.jwt() is wrapped in (select ...) so the initplan warning goes too', policyLines.every((l) => /\(select auth\.jwt\(\)\)/.test(l)));
  check('the policies are still RESTRICTIVE', /CREATE POLICY pwchange_required ON public\.%I AS RESTRICTIVE/.test(code) && /CREATE POLICY pwchange_required ON storage\.objects AS RESTRICTIVE/.test(code));
  check('the trigger fires only when encrypted_password changes', /BEFORE UPDATE OF encrypted_password ON auth\.users/.test(code) && /NEW\.encrypted_password IS DISTINCT FROM OLD\.encrypted_password/.test(code));
  check('the trigger removes the app_metadata flag', /NEW\.raw_app_meta_data := NEW\.raw_app_meta_data - 'must_change_password'/.test(code));
  check('users flagged in user_metadata today are carried over to app_metadata', /UPDATE auth\.users[\s\S]*raw_app_meta_data[\s\S]*must_change_password[\s\S]*WHERE[\s\S]*raw_user_meta_data ->> 'must_change_password'/.test(code));
  // GoTrue updates auth.users as supabase_auth_admin, which has no USAGE on
  // schema private: without the two grants every password change would fail.
  check('the trigger function has an empty search_path and is not callable by users', /SET search_path = ''/.test(code) && !/SECURITY DEFINER/.test(code) && /REVOKE ALL ON FUNCTION private\.clear_must_change_password\(\) FROM public, anon, authenticated/.test(code));
  check('supabase_auth_admin (the role that runs the trigger) gets USAGE on private and EXECUTE on the function', /GRANT USAGE ON SCHEMA private TO supabase_auth_admin/.test(code) && /GRANT EXECUTE ON FUNCTION private\.clear_must_change_password\(\) TO supabase_auth_admin/.test(code));
}

console.log('\n4. doLogin honours either flag (real index.html)');
{
  const HTML = 'file://' + path.resolve(ROOT, 'index.html');
  const browser = await pw.chromium.launch();
  const results = {};
  for (const [name, user] of Object.entries({
    app: { user_metadata: {}, app_metadata: { must_change_password: true } },
    legacy: { user_metadata: { must_change_password: true }, app_metadata: {} },
    clean: { user_metadata: { must_change_password: false }, app_metadata: {} },
  })) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.addInitScript(`window.supabase = { createClient: function () { return { auth: {
      getSession: function () { return Promise.resolve({ data: { session: null } }); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
      signInAnonymously: function () { return Promise.resolve({ data: { session: null }, error: null }); },
      signOut: function () { return Promise.resolve({}); },
      signInWithPassword: function () { return Promise.resolve({ data: { session: { access_token: 'tok', user: ${JSON.stringify(user)} }, user: ${JSON.stringify(user)} }, error: null }); },
      mfa: { getAuthenticatorAssuranceLevel: function () { return Promise.resolve({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }); }, listFactors: function () { return Promise.resolve({ data: { totp: [], all: [] }, error: null }); } },
    } }; } };`);
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    results[name] = await page.evaluate(async () => {
      _sbBoot();
      const u = document.getElementById('uname');
      const p = document.getElementById('pw');
      if (u) u.value = 'dani'; if (p) p.value = 'whatever123';
      try { doLogin(); } catch (e) { return { threw: e.message }; }
      await new Promise((r) => setTimeout(r, 700));
      const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
      return { modal: vis('m-force-pw-change'), pending: !!window._pendingLogin, errs: [] };
    });
    results[name].errs = errs;
    await ctx.close();
  }
  await browser.close();
  check('app_metadata flag alone opens the forced-change modal', results.app.modal && results.app.pending, results.app);
  check('legacy user_metadata flag alone still opens it', results.legacy.modal && results.legacy.pending, results.legacy);
  check('no flag: no modal', !results.clean.modal && !results.clean.pending, results.clean);
  check('no page errors', Object.values(results).every((r) => r.errs.length === 0), Object.values(results).map((r) => r.errs.slice(0, 2)));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
