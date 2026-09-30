// Leaked passwords (30/09/2026): Supabase checks them only on the Pro plan, so
// the app asks the Pwned Passwords range API itself before a password change.
// Drives the real _pwChangeSubmit (first login) and _changePwSubmit (self
// service) against a stubbed auth client and a routed range API.
const path = require('path');
const crypto = require('crypto');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').toUpperCase();
const LEAKED = 'password1234', CLEAN = 'Zq-7-tapugan-unique';

const stub = `
window.__calls = { update: 0, signIn: 0 };
window.supabase = { createClient: function () {
  return { auth: {
    getSession: function () { return Promise.resolve({ data: { session: null } }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    signInAnonymously: function () { return Promise.resolve({ data: { session: null }, error: null }); },
    signOut: function () { return Promise.resolve({}); },
    signInWithPassword: function () { window.__calls.signIn++; return Promise.resolve({ data: { session: { access_token: 'tok', user: {} } }, error: null }); },
    mfa: { getAuthenticatorAssuranceLevel: function () { return Promise.resolve({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }); } },
    updateUser: function () { window.__calls.update++; return Promise.resolve({ data: { user: {} }, error: null }); },
    refreshSession: function () { return Promise.resolve({ data: { session: { access_token: 'tok-refreshed', user: { email: 'admin@tfugen.local' } } }, error: null }); },
  } };
} };
`;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errs = [], asked = [];
  let mode = 'ok';
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(stub);
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    if (u.startsWith('https://api.pwnedpasswords.com/range/')) {
      asked.push({ u, pad: r.request().headers()['add-padding'] });
      if (mode === 'down') return r.abort();
      const L = sha(LEAKED);
      return r.fulfill({ status: 200, contentType: 'text/plain', body: '0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n' + L.slice(5) + ':52579\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0\r\n' });
    }
    return r.abort();
  });
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const first = (p) => page.evaluate(async (p) => {
    _sbBoot();
    window.__calls.update = 0;
    window._sbToken = 'tok-stale';
    window._pendingLogin = { lb: null, email: 'admin@tfugen.local', uname: 'admin' };
    document.getElementById('fpc-new').value = p;
    document.getElementById('fpc-confirm').value = p;
    _pwChangeSubmit();
    await new Promise((r) => setTimeout(r, 900));
    return { update: window.__calls.update, err: document.getElementById('fpc-err').textContent };
  }, p);

  let o = await first(LEAKED);
  check('first login, leaked password: not saved, and says how many times it leaked', o.update === 0 && /52579/.test(o.err) && /דליפות/.test(o.err), o);
  check('only the first 5 characters of the SHA-1 went out, with padding', asked.length === 1 && asked[0].u.endsWith('/range/' + sha(LEAKED).slice(0, 5)) && !asked[0].u.includes(LEAKED) && asked[0].pad === 'true', asked);
  o = await first(CLEAN);
  check('first login, clean password: saved', o.update === 1 && o.err === '', o);
  mode = 'down';
  o = await first(CLEAN + 'x');
  check('service down: the change goes ahead, as before', o.update === 1, o);
  mode = 'ok';

  const self = (p) => page.evaluate(async (p) => {
    window.__calls.update = 0;
    window._currentUser = { username: 'admin', role: 'admin' };
    _changePwOpen();
    document.getElementById('cpw-current').value = 'old-password-1';
    document.getElementById('cpw-new').value = p;
    document.getElementById('cpw-confirm').value = p;
    _changePwSubmit();
    await new Promise((r) => setTimeout(r, 900));
    return { update: window.__calls.update, err: document.getElementById('cpw-err').textContent };
  }, p);
  o = await self(LEAKED);
  check('self-service change, leaked password: not saved', o.update === 0 && /52579/.test(o.err), o);
  o = await self(CLEAN + 'y');
  check('self-service change, clean password: saved', o.update === 1, o);
  check('no page errors', errs.length === 0, errs);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
