// Change password, wrong current password (01/10/2026, seen on the live app).
//
// Admin with a second factor opened "change password", typed a wrong current
// password and a valid new one, and tapped the button once. The error was
// written to #cpw-err and then, about 4 seconds later, the window was gone
// with nothing on screen. The session was fine and the password unchanged.
//
// What this proves, with supabase-js and Turnstile replaced by stand-ins (the
// supabase one is the same as mfa-test.js, the Turnstile one as captcha-test.js):
//   1. the exact flow: opened from the menu, real taps, the production key
//      swapped for a test key so the widget renders before the sign-in;
//   2. the error stays on screen, the window stays open, and what was typed
//      in the three fields is still there, well after 4 seconds;
//   3. none of the things that run on their own closes it: window focus and
//      visibility (each one starts a sync, a backup tick, an idle-lock check),
//      a full sync, a realtime change, the profile and two-step re-check, a
//      tap inside the window;
//   5. the Turnstile box does not stay fixed at the bottom of the screen once
//      it has handed over its token. It did, after a challenge that needed a
//      tap, and covered the menu's change-password entry (found writing this).
//   4. a second try (the leaked-password check already done) behaves the same.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const KEY_RE = /var TURNSTILE_SITEKEY='([^']*)';/;
const SRC0 = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
if (!KEY_RE.test(SRC0)) { console.log('HARNESS ERROR: TURNSTILE_SITEKEY line not found'); process.exit(1); }
const SRC = SRC0.replace(KEY_RE, "var TURNSTILE_SITEKEY='0x-test-key';");
const ORIGIN = 'https://tapugan.test';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const GOOD = '123456';
const ADMIN_EMAIL = 'admin@tfugen.local';
const VERIFIED = [{ id: 'f9', status: 'verified', factor_type: 'totp' }];
const ADMIN = { id: 'admin', username: 'admin', role: 'admin', full_name: 'Admin', active: true };

const stub = (o) => `
(function(){
  var S = window.__sb = { factors: ${JSON.stringify(o.factors || [])}, aal: ${JSON.stringify(o.aal || 'aal1')},
    session: ${JSON.stringify(o.session || null)}, signOuts: 0, updates: [], verifies: 0, enrolls: 0, n: 0, passkeys: ${JSON.stringify(o.passkeys || [])}, pkLogins: 0 };
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
    // Passkeys (pilot 25/09): the stub keeps the registered passkeys like the
    // server does. A passkey sign-in is aal1 (no TOTP in the session).
    signInWithPasskey: function(){ S.pkLogins++; if (!S.passkeys.length) return Promise.resolve({ data: {}, error: { message: 'webauthn_credential_not_found' } });
      S.aal = 'aal1'; S.session = sess('${ADMIN_EMAIL}'); return Promise.resolve({ data: { session: S.session, user: S.session.user }, error: null }); },
    registerPasskey: function(){ var k = { id: 'pk' + (++S.n), friendly_name: 'iCloud Keychain' }; S.passkeys.push(k); return Promise.resolve({ data: k, error: null }); },
    passkey: { list: function(){ return Promise.resolve({ data: S.passkeys.slice(), error: null }); } },
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

// Turnstile stand-in: the widget is a real fixed box at the bottom of the
// page, like the real one, and hands back a fresh token asynchronously.
const TURNSTILE = `
(function(){
  var n = 0; window.__ts = { renders: 0, removed: 0 };
  window.turnstile = {
    render: function(el, o){ window.__ts.renders++; el.innerHTML = '<div id="ts-box" style="width:300px;height:65px;background:#eee"></div>'; var id = 'w' + (++n); setTimeout(function(){ o.callback('tok-' + n); }, 10); return id; },
    remove: function(){ window.__ts.removed++; var c = document.getElementById('captcha'); if (c) c.innerHTML = ''; }, reset: function(){}
  };
})();
`;

(async () => {
  const browser = await pw.chromium.launch();
  const errs = [];
  const run = async (vp, label) => {
    console.log('\n' + label);
    const ctx = await browser.newContext({ viewport: vp, locale: 'he-IL' });
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept().catch(() => {}));
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('tfgn_app_prefs', JSON.stringify({ lockMin: 30 })); localStorage.setItem('tfgn_last_seen', String(Date.now())); localStorage.setItem('tfgn_mgr_device', '1'); } catch (e) {} });
    await p.route('**/*', async (r) => {
      const u = r.request().url();
      if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: SRC });
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: stub({ factors: VERIFIED }) });
      if (/challenges\.cloudflare\.com\/turnstile/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: TURNSTILE });
      if (/api\.pwnedpasswords\.com/.test(u)) return r.fulfill({ contentType: 'text/plain', body: '0000000000000000000000000000000000A:1' });
      if (/\/rest\/v1\/app_users/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify([ADMIN]) });
      if (/\/rest\/v1\//.test(u)) return r.fulfill({ contentType: 'application/json', body: '[]' });
      return r.abort();
    });
    await p.goto(ORIGIN + '/', { waitUntil: 'load' });
    await p.waitForFunction(() => { const l = document.getElementById('login'); return !!(l && l.style.display); }, null, { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => { document.getElementById('uname').value = 'admin'; document.getElementById('pw').value = 'right-pw'; doLogin(); });
    await p.waitForSelector('#mfa-code', { state: 'visible', timeout: 5000 }).catch(() => {});
    await p.fill('#mfa-code', GOOD); await p.click('#mfa-ok');
    await p.waitForFunction(() => window._sbToken === 'tok-aal2', null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1500);   // the profile (and the two-step re-check) lands 900ms after login
    const st = () => p.evaluate(() => {
      const mo = document.getElementById('m-changepw'), ov = document.getElementById('ov-changepw');
      const v = (id) => (document.getElementById(id) || {}).value;
      return { open: mo.style.display === 'block' && getComputedStyle(mo).display !== 'none', ov: ov.style.display === 'block', fs: mo.classList.contains('is-fullscreen'),
        err: document.getElementById('cpw-err').textContent, cur: v('cpw-current'), nw: v('cpw-new'), cf: v('cpw-confirm'),
        btn: document.getElementById('cpw-submit').disabled, app: document.getElementById('app').style.display !== 'none' && document.getElementById('login').style.display === 'none',
        token: window._sbToken, aal: window.__sb.aal, signOuts: window.__sb.signOuts, updates: window.__sb.updates.length };
    });
    const tsGone = () => p.evaluate(() => { const c = document.getElementById('captcha'); return { renders: window.__ts.renders, removed: window.__ts.removed, h: c ? c.getBoundingClientRect().height : 0 }; });
    let g0 = await tsGone();
    check('after the login, the Turnstile box is gone from the bottom of the screen', g0.renders === 1 && g0.removed === 1 && g0.h === 0, g0);
    const pre = await st();
    check('signed in with the second factor (aal2), window closed', pre.app && pre.token === 'tok-aal2' && !pre.open, pre);

    // 1. Opened the way Michael opens it: the menu, then the entry.
    await p.evaluate(() => _menuOpen());
    await p.click('#m-modules-sheet button[onclick*="_changePwOpen"]');
    await p.waitForTimeout(200);
    await p.fill('#cpw-current', 'wrong-pw');
    await p.fill('#cpw-new', 'new-password-1');
    await p.fill('#cpw-confirm', 'new-password-1');
    await p.click('#cpw-submit');
    await p.waitForFunction(() => /שגויה/.test(document.getElementById('cpw-err').textContent), null, { timeout: 5000 }).catch(() => {});
    let s = await st();
    // On a phone the window is full screen and IS the overlay (openModal hides ov-*).
    const want = (x) => x.open && (x.fs ? !x.ov : x.ov) && /הסיסמה הנוכחית שגויה/.test(x.err) && x.cur === 'wrong-pw' && x.nw === 'new-password-1' && x.cf === 'new-password-1' && !x.btn;
    check('the widget rendered and the sign-in was refused', (await p.evaluate(() => window.__ts.renders)) >= 1 && /שגויה/.test(s.err), s);
    check('right away: the error is shown in the open window, fields kept, button usable', want(s), s);
    await p.waitForTimeout(6000);
    s = await st();
    check('6 seconds later: still open, the error still there, nothing typed is lost', want(s), s);
    check('the session is untouched and nothing was changed', s.app && s.token === 'tok-aal2' && s.aal === 'aal2' && s.signOuts === 0 && s.updates === 0, s);

    // 3. Everything that runs on its own while the window is open.
    const steps = [
      ['window focus (sync, backup, trustee log, idle lock)', () => window.dispatchEvent(new Event('focus'))],
      ['visibility back (idle lock resume)', () => document.dispatchEvent(new Event('visibilitychange'))],
      ['a full sync', () => sbSync(true)],
      ['a realtime change to app_users', () => _rtApply('app_users', { eventType: 'UPDATE', new: { id: 'admin', username: 'admin', role: 'admin', active: true } })],
      ['the profile and two-step re-check', () => { _fetchCurrentUserProfile(); _mfaEnforce(); }],
      ['coming back online', () => window.dispatchEvent(new Event('online'))],
    ];
    for (const [name, fn] of steps) {
      await p.evaluate(fn);
      await p.waitForTimeout(700);
      s = await st();
      check('after ' + name + ': still open with the error and the fields', want(s), s);
    }
    await p.click('#cpw-err');
    s = await st();
    check('a tap inside the window does not close it', want(s), s);
    g0 = await tsGone();
    check('after the refused try, no Turnstile box left over the window either', g0.renders === 2 && g0.removed === 2 && g0.h === 0, g0);

    // 4. A second try: the leaked-password check is skipped this time.
    await p.click('#cpw-submit');
    await p.waitForTimeout(800);
    s = await st();
    check('a second try: the same error, the window still open', want(s), s);
    await p.waitForTimeout(4500);
    s = await st();
    check('...and still open 4.5 seconds later', want(s), s);

    // The buttons that are meant to close it still do.
    await p.click('#m-changepw .modal-footer .btn-s');
    s = await st();
    check('Cancel still closes it', !s.open && !s.ov, s);
    await ctx.close();
  };
  await run({ width: 390, height: 844 }, '1. phone (full screen window)');
  await run({ width: 1280, height: 800 }, '2. desktop (centred window over the overlay)');
  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR', e); process.exit(1); });
