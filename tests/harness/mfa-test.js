// Two-step sign-in (2026-09-24), the browser half.
//
// The database half is the mfa_required policy on every table: a user who has
// a verified second factor reads nothing at aal1 (verified on the live DB, see
// migrations/2026-09-24_viewer_mfa_active.sql). So what matters here is that no
// path that signs in with a password gets past it without the code -- the
// login, the saved session on open, and "change password", which signs in
// again to check the current one -- and that someone WITHOUT a factor never
// sees any of it.
//
// supabase-js is replaced by a stand-in that keeps the same state the server
// does: the factors, and the assurance level of the current session.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const ORIGIN = 'https://tapugan.test';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const GOOD = '123456';

const stub = (o) => `
(function(){
  var S = window.__sb = { factors: ${JSON.stringify(o.factors || [])}, aal: ${JSON.stringify(o.aal || 'aal1')},
    session: ${JSON.stringify(o.session || null)}, signOuts: 0, updates: [], verifies: 0, enrolls: 0, n: 0 };
  function sess(email){ return { access_token: 'tok-' + S.aal, user: { email: email, is_anonymous: false, user_metadata: {} } }; }
  function verified(){ return S.factors.filter(function(f){ return f.status === 'verified' && f.factor_type === 'totp'; }); }
  window.supabase = { createClient: function(){ return { auth: {
    getSession: function(){ if (S.session) S.session.access_token = 'tok-' + S.aal; return Promise.resolve({ data: { session: S.session } }); },
    onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; },
    signInAnonymously: function(){ return Promise.resolve({ data: { session: null }, error: null }); },
    signOut: function(){ S.signOuts++; S.session = null; S.aal = 'aal1'; return Promise.resolve({}); },
    signInWithPassword: function(c){
      if (c.password !== 'right-pw') return Promise.resolve({ data: {}, error: { message: 'Invalid login credentials' } });
      S.aal = 'aal1'; S.session = sess(c.email);
      return Promise.resolve({ data: { session: S.session, user: S.session.user }, error: null });
    },
    updateUser: function(u){ S.updates.push({ aal: S.aal, keys: Object.keys(u) }); return Promise.resolve({ data: { user: {} }, error: null }); },
    mfa: {
      getAuthenticatorAssuranceLevel: function(){ return Promise.resolve({ data: { currentLevel: S.session ? S.aal : null, nextLevel: verified().length ? 'aal2' : S.aal } }); },
      listFactors: function(){ return Promise.resolve({ data: { all: S.factors.slice(), totp: verified() } }); },
      enroll: function(){ S.enrolls++; var f = { id: 'f' + (++S.n), status: 'unverified', factor_type: 'totp' }; S.factors.push(f);
        return Promise.resolve({ data: { id: f.id, type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/Tapugan%20Safety:admin?secret=JBSWY3DPEHPK3PXP' } } }); },
      challengeAndVerify: function(a){ S.verifies++;
        var f = S.factors.filter(function(x){ return x.id === a.factorId; })[0];
        if (!f || a.code !== '${GOOD}') return Promise.resolve({ data: null, error: { message: 'Invalid TOTP code entered' } });
        f.status = 'verified'; S.aal = 'aal2'; return Promise.resolve({ data: {}, error: null }); },
      unenroll: function(a){ S.factors = S.factors.filter(function(x){ return x.id !== a.factorId; }); return Promise.resolve({ data: { id: a.factorId }, error: null }); },
    },
  } }; } };
})();
`;

const ADMIN_EMAIL = 'admin@tfugen.local';
const VERIFIED = [{ id: 'f9', status: 'verified', factor_type: 'totp' }];
const DANI = { id: 'dani', username: 'dani', role: 'מנהל', full_name: 'דני', active: true };
const VERED = { id: 'vered', username: 'vered', role: 'צופה', full_name: 'ורד', active: true };
const USERS = { dani: DANI, vered: VERED };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const errs = [];
  const boot = async (o) => {
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept().catch(() => {}));
    p.on('pageerror', (e) => errs.push(e.message));
    p.__rest = [];
    // A lock long enough that a saved session is judged on its merits.
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('tfgn_app_prefs', JSON.stringify({ lockMin: 720 })); localStorage.setItem('tfgn_last_seen', String(Date.now())); localStorage.setItem('tfgn_mgr_device', '1'); } catch (e) {} });
    await p.route('**/*', async (r) => {
      const u = r.request().url();
      if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: SRC });
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: stub(o) });
      if (/\/rest\/v1\/app_users/.test(u)) { p.__rest.push(await p.evaluate(() => window.__sb.aal).catch(() => '?')); const un = (u.match(/username=eq\.([a-z]+)/) || [])[1]; return r.fulfill({ contentType: 'application/json', body: JSON.stringify(USERS[un] ? [USERS[un]] : [DANI]) }); }
      return r.abort();
    });
    await p.goto(ORIGIN + '/', { waitUntil: 'load' });
    await p.waitForFunction(() => { const l = document.getElementById('login'); return !!(l && l.style.display); }, null, { timeout: 10000 }).catch(() => {});
    return p;
  };
  const state = (p) => p.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    return { codeWin: vis('m-mfa'), app: vis('app') && !vis('login'), login: vis('login'), err: (document.getElementById('login-err') || document.getElementById('lerr') || {}).textContent || '', mfaErr: document.getElementById('mfa-err').textContent, token: window._sbToken, aal: window.__sb.aal, signOuts: window.__sb.signOuts, verifies: window.__sb.verifies };
  });
  const login = async (p, user) => {
    await p.evaluate((user) => { document.getElementById('uname').value = user; document.getElementById('pw').value = 'right-pw'; doLogin(); }, user);
    await p.waitForTimeout(500);
  };
  const code = async (p, c) => { await p.fill('#mfa-code', c); await p.click('#mfa-ok'); await p.waitForTimeout(500); };

  console.log('\n1. no second factor: nothing changes');
  let p = await boot({});
  await login(p, 'admin');
  let s = await state(p);
  check('the admin walks straight in, no code window', s.app && !s.codeWin, s);
  check('with the password-only session, as before', s.token === 'tok-aal1', s);
  // 25/09, Michael: "mandatory for admin and managers". The role is known
  // 900ms after login; from then on the setup window is up and stays up.
  await p.waitForTimeout(1200);
  const must = (pg) => pg.evaluate(() => { const mo = document.getElementById('m-mfa-setup'); const x = mo.querySelector('.close-btn'); return { open: mo.style.display === 'block', xHidden: x.style.display === 'none', must: window._mfaMust, body: document.getElementById('mfa-setup-body').textContent, ovClick: !!document.getElementById('ov-mfa-setup').onclick }; });
  let m = await must(p);
  check('admin without a factor: the setup window opens by itself, mandatory', m.open && m.must && /חובה/.test(m.body), m);
  check('no X, and the overlay does not close it', m.xHidden && !m.ovClick, m);
  await p.evaluate(() => closeModal('m-mfa-setup'));
  await p.click('#ov-mfa-setup', { force: true }).catch(() => {});
  m = await must(p);
  check('closeModal and the overlay leave it open', m.open && m.must, m);
  await p.close();

  console.log('\n1b. the same for a manager and a viewer');
  p = await boot({});
  await login(p, 'dani');
  await p.waitForTimeout(1200);
  m = await must(p);
  check('manager without a factor: mandatory window', m.open && m.must, m);
  await p.close();
  p = await boot({});
  await login(p, 'vered');
  await p.waitForTimeout(1200);
  m = await must(p);
  check('viewer without a factor: mandatory too (everyone with a password, 25/09)', m.open && m.must, m);
  await p.close();

  console.log('\n2. a second factor: the password alone is not enough');
  p = await boot({ factors: VERIFIED });
  await login(p, 'dani');
  s = await state(p);
  check('the code window opens after the password', s.codeWin, s);
  check('the app is not entered yet', !s.app, s);
  check('nothing was read before the code (app_users asked ' + p.__rest.length + ' times)', p.__rest.length === 0, p.__rest);
  await code(p, '000000');
  s = await state(p);
  check('a wrong code is refused and says so (' + s.mfaErr + ')', s.codeWin && !s.app && /שגוי/.test(s.mfaErr), s);
  await code(p, '12');
  s = await state(p);
  check('a short code is refused before asking the server', /6/.test(s.mfaErr) && s.verifies === 1, s);
  await code(p, GOOD);
  s = await state(p);
  check('the right code lets them in', s.app && !s.codeWin, s);
  check('with the aal2 session, not the password-only one', s.token === 'tok-aal2', s);
  // The approval check and the sync that follows both read app_users.
  check('every read of app_users came after the code, at aal2 (' + p.__rest.length + ')', p.__rest.length >= 1 && p.__rest.every((x) => x === 'aal2'), p.__rest);
  await p.close();

  console.log('\n3. giving up at the code window');
  p = await boot({ factors: VERIFIED });
  await login(p, 'admin');
  await p.click('#mfa-cancel');
  await p.waitForTimeout(300);
  s = await state(p);
  const lerr = await p.evaluate(() => Array.from(document.querySelectorAll('#login *')).map((e) => e.children.length ? '' : e.textContent).join(' '));
  check('signed out, still on the login screen', s.signOuts >= 1 && s.login && !s.app && !s.codeWin, s);
  check('and told why', /נדרש קוד אימות/.test(lerr), lerr.slice(0, 200));
  await p.close();

  console.log('\n4. a saved session on open');
  p = await boot({ factors: VERIFIED, aal: 'aal1', session: { access_token: 'x', user: { email: ADMIN_EMAIL, is_anonymous: false } } });
  s = await state(p);
  check('password-only, with a factor: dropped, login screen', s.login && !s.app && s.signOuts === 1, s);
  await p.close();
  p = await boot({ factors: VERIFIED, aal: 'aal2', session: { access_token: 'x', user: { email: ADMIN_EMAIL, is_anonymous: false } } });
  s = await state(p);
  check('already at aal2: straight back in', s.app && s.signOuts === 0, s);
  await p.close();
  p = await boot({ aal: 'aal1', session: { access_token: 'x', user: { email: ADMIN_EMAIL, is_anonymous: false } } });
  s = await state(p);
  check('no factor: straight back in, as before', s.app && s.signOuts === 0, s);
  await p.waitForTimeout(1200);
  m = await must(p);
  check('...and the restored admin meets the mandatory window too', m.open && m.must, m);
  await p.close();

  console.log('\n5. the admin enrols from the mandatory window');
  p = await boot({ factors: [{ id: 'old', status: 'unverified', factor_type: 'totp' }] });
  await login(p, 'admin');
  await p.waitForTimeout(1200);
  let body = await p.evaluate(() => document.getElementById('mfa-setup-body').textContent);
  check('mandatory: straight to enrolment, no extra tap, and says it is mandatory', /חובה/.test(body) && !!(await p.$('#mfa-setup-code')), body.slice(0, 80));
  const en = await p.evaluate(() => ({ uri: (document.getElementById('mfa-setup-uri') || {}).href || '', secret: (document.getElementById('mfa-setup-secret') || {}).textContent || '', qr: !!document.querySelector('#mfa-setup-body img'), factors: window.__sb.factors.map((f) => f.id + ':' + f.status) }));
  check('the one-tap link opens the authenticator app (otpauth://)', /^otpauth:\/\/totp\//.test(en.uri), en);
  check('the key is shown to copy by hand, and the QR for another device', en.secret === 'JBSWY3DPEHPK3PXP' && en.qr, en);
  check('the half-finished attempt from before was cleared first', en.factors.length === 1 && en.factors[0] === 'f1:unverified', en.factors);
  await p.fill('#mfa-setup-code', '999999'); await p.click('#mfa-setup-ok'); await p.waitForTimeout(300);
  const wrong = await p.evaluate(() => ({ body: document.getElementById('mfa-setup-body').textContent, f: window.__sb.factors[0].status, must: window._mfaMust }));
  check('a wrong code does not switch it on, window still mandatory', wrong.f === 'unverified' && /שגוי/.test(wrong.body) && wrong.must, wrong);
  await p.fill('#mfa-setup-code', GOOD); await p.click('#mfa-setup-ok'); await p.waitForTimeout(500);
  const on = await p.evaluate(() => ({ f: window.__sb.factors.map((x) => x.status), token: window._sbToken, must: window._mfaMust, open: document.getElementById('m-mfa-setup').style.display === 'block', x: document.querySelector('#m-mfa-setup .close-btn').style.display }));
  check('the right code switches it on and releases the window', on.f.join() === 'verified' && !on.must && !on.open && on.x === '', on);
  check('this session is now aal2', on.token === 'tok-aal2', on);
  await p.evaluate(() => _mfaSetupOpen());
  await p.waitForTimeout(300);
  const again = await p.evaluate(() => ({ body: document.getElementById('mfa-setup-body').textContent, off: !!document.querySelector('#mfa-setup-body button.btn-s') }));
  check('reopened from the menu: active, and no "switch off" for an admin', /פעיל/.test(again.body) && !again.off && /חובה/.test(again.body), again);
  await p.close();

  console.log('\n5b. a viewer enrols the same way and cannot switch off either');
  p = await boot({});
  await login(p, 'vered');
  await p.waitForTimeout(1200);
  body = await p.evaluate(() => document.getElementById('mfa-setup-body').textContent);
  check('mandatory window for the viewer, already at the code step', /חובה/.test(body) && !!(await p.$('#mfa-setup-code')), body.slice(0, 80));
  await p.fill('#mfa-setup-code', GOOD); await p.click('#mfa-setup-ok'); await p.waitForTimeout(500);
  await p.evaluate(() => _mfaSetupOpen());
  await p.waitForTimeout(300);
  const von = await p.evaluate(() => ({ body: document.getElementById('mfa-setup-body').textContent, off: !!document.querySelector('#mfa-setup-body button.btn-s'), must: window._mfaMust, n: window.__sb.factors.filter((f) => f.status === 'verified').length }));
  check('on, released, and no "switch off" button', /פעיל/.test(von.body) && !von.off && !von.must && von.n === 1, von);
  await p.close();

  console.log('\n5c. the trustee kiosk (anonymous, code only) is untouched');
  p = await boot({});
  const kiosk = await p.evaluate(() => { document.body.classList.add('emp-mode'); window._currentUser = { username: 'x' }; return _mfaRoleMust(); });
  check('_mfaRoleMust is false in kiosk mode', kiosk === false, kiosk);
  await p.close();

  console.log('\n6. change password with a factor: checking the old one signs in again');
  p = await boot({ factors: VERIFIED });
  await login(p, 'admin'); await code(p, GOOD);
  await p.evaluate(() => { _changePwOpen(); document.getElementById('cpw-current').value = 'right-pw'; document.getElementById('cpw-new').value = 'new-password-1'; document.getElementById('cpw-confirm').value = 'new-password-1'; _changePwSubmit(); });
  await p.waitForTimeout(400);
  s = await state(p);
  check('the code is asked for again', s.codeWin && s.aal === 'aal1', s);
  check('and the password is not changed on the password-only session', (await p.evaluate(() => window.__sb.updates.length)) === 0);
  await code(p, GOOD);
  const up = await p.evaluate(() => window.__sb.updates);
  check('after the code, the change goes through at aal2', up.length === 1 && up[0].aal === 'aal2', up);
  check('and the app keeps the aal2 session', (await state(p)).token === 'tok-aal2');
  await p.close();

  console.log('\n7. words people read');
  const a = SRC.indexOf('// ---- Two-step sign-in (2026-09-24)');
  const b = SRC.indexOf('\nfunction doLogin(', a);
  const dec = (t) => t.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  const m1 = SRC.match(/<div class="modal" id="m-mfa"[\s\S]*?\n<\/div>/);
  const m2 = SRC.match(/<div class="modal" id="m-mfa-setup"[\s\S]*?\n<\/div>/);
  const words = dec(SRC.slice(a, b)) + dec(m1 ? m1[0] : '') + dec(m2 ? m2[0] : '');
  const bad = words.match(/[—–־«»“”„‘’←→↔·…]/g);
  check('keyboard characters only in every new message (' + (a > 0 && m1 && m2 ? 'found' : 'MISSING') + ')', a > 0 && b > a && m1 && m2 && !bad, bad);
  check('the settings entry is in the menu', /_mfaSetupOpen\(\)" data-kw=/.test(SRC));

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
