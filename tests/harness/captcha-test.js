// Cloudflare Turnstile on sign-in (30/09/2026, security review, finding 4).
//
// Anyone with the publishable key could mint anonymous sessions for free, and
// the page itself minted one for every visitor to the login screen. What this
// proves, with supabase-js and the Turnstile script both replaced by stand-ins:
//   1. empty key (the default in the repo): nothing changes -- no Turnstile
//      script is fetched, no widget, sign-ins carry no token;
//   2. opening the page no longer signs in anonymously; a saved session is
//      still picked up so the token is ready before the first read;
//   3. with a key: the anonymous sign-in (kiosk gate) and the password login
//      each carry a FRESH token (tokens are single-use);
//   4. with a key but the script blocked (offline, filtered): the sign-in
//      still goes ahead, without a token, instead of hanging.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const SRC0 = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const ORIGIN = 'https://tapugan.test';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const KEY_LINE = "var TURNSTILE_SITEKEY='';";
if (!SRC0.includes(KEY_LINE)) { console.log('HARNESS ERROR: TURNSTILE_SITEKEY line not found (the repo default must be an empty key)'); process.exit(1); }
const withKey = (src) => src.replace(KEY_LINE, "var TURNSTILE_SITEKEY='0x-test-key';");

// supabase-js stand-in: records what each sign-in was called with.
const stub = (o) => `
(function(){
  var S = window.__sb = { session: ${JSON.stringify(o.session || null)}, anon: [], pw: [], n: 0 };
  window.supabase = { createClient: function(){ return { auth: {
    getSession: function(){ return Promise.resolve({ data: { session: S.session } }); },
    onAuthStateChange: function(){ return { data: { subscription: { unsubscribe: function(){} } } }; },
    signInAnonymously: function(a){ S.anon.push(a === undefined ? null : a); S.session = { access_token: 'anon-' + (++S.n), user: { is_anonymous: true } }; return Promise.resolve({ data: { session: S.session }, error: null }); },
    signInWithPassword: function(c){ S.pw.push(c); return Promise.resolve({ data: {}, error: { message: 'Invalid login credentials' } }); },
    signOut: function(){ S.session = null; return Promise.resolve({}); },
    mfa: { getAuthenticatorAssuranceLevel: function(){ return Promise.resolve({ data: { currentLevel: null, nextLevel: null } }); },
           listFactors: function(){ return Promise.resolve({ data: { all: [], totp: [] } }); } },
  } }; } };
})();
`;

// Turnstile stand-in: every render hands back a new token, asynchronously,
// like the real widget. Records the options it was rendered with.
const TURNSTILE = `
(function(){
  var n = 0; window.__ts = { renders: [], removed: 0 };
  window.turnstile = {
    render: function(el, o){ window.__ts.renders.push({ sitekey: o.sitekey, appearance: o.appearance, hasEl: !!el }); var id = 'w' + (++n); setTimeout(function(){ o.callback('tok-' + n); }, 10); return id; },
    remove: function(){ window.__ts.removed++; },
    reset: function(){}
  };
})();
`;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const errs = [];
  const boot = async (o) => {
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept().catch(() => {}));
    p.on('pageerror', (e) => errs.push(e.message));
    p.__ts = 0;
    await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('tfgn_app_prefs', JSON.stringify({ lockMin: 720 })); localStorage.setItem('tfgn_last_seen', String(Date.now())); localStorage.setItem('tfgn_mgr_device', '1'); } catch (e) {} });
    await p.route('**/*', async (r) => {
      const u = r.request().url();
      if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: o.key ? withKey(SRC0) : SRC0 });
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: stub(o) });
      if (/challenges\.cloudflare\.com\/turnstile/.test(u)) { p.__ts++; if (o.blockTurnstile) return r.abort(); return r.fulfill({ contentType: 'application/javascript', body: TURNSTILE }); }
      if (/\/rest\/v1\/app_users/.test(u)) return r.fulfill({ contentType: 'application/json', body: '[]' });
      return r.abort();
    });
    await p.goto(ORIGIN + '/', { waitUntil: 'load' });
    await p.waitForFunction(() => { const l = document.getElementById('login'); return !!(l && l.style.display); }, null, { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(800);
    return p;
  };
  const sb = (p) => p.evaluate(() => ({ anon: window.__sb.anon, pw: window.__sb.pw.map((c) => ({ email: c.email, tok: c.options && c.options.captchaToken })), token: window._sbToken, ts: window.__ts || null, widget: !!document.getElementById('captcha') }));
  const login = async (p) => {
    await p.evaluate(() => { document.getElementById('uname').value = 'admin'; document.getElementById('pw').value = 'x'.repeat(10); doLogin(); });
    await p.waitForTimeout(400);
  };

  console.log('\n1. empty key (the repo default): nothing changes');
  let p = await boot({});
  let s = await sb(p);
  check('opening the login screen does not sign in anonymously', s.anon.length === 0, s);
  check('no Turnstile script is fetched, no widget', p.__ts === 0 && !s.widget, { fetched: p.__ts, widget: s.widget });
  await p.evaluate(() => _sbAuth());
  await p.waitForTimeout(100);
  s = await sb(p);
  check('the kiosk gate (_sbAuth) signs in anonymously, as before', s.anon.length === 1, s);
  check('...with no token attached', s.anon[0] === null, s.anon);
  await login(p);
  s = await sb(p);
  check('the password login calls signInWithPassword', s.pw.length === 1 && s.pw[0].email === 'admin@tfugen.local', s.pw);
  check('...with no token attached', s.pw[0].tok === undefined, s.pw);
  check('still no Turnstile script, no widget', p.__ts === 0 && !s.widget, { fetched: p.__ts, widget: s.widget });
  await p.close();

  console.log('\n2. a saved session is picked up on open, without an anonymous sign-in');
  p = await boot({ session: { access_token: 'saved-tok', user: { email: 'admin@tfugen.local', is_anonymous: false } } });
  s = await sb(p);
  check('the token is ready before the first read', s.token === 'saved-tok', s);
  check('and no anonymous user was minted for it', s.anon.length === 0, s.anon);
  await p.close();

  console.log('\n3. with a key: every sign-in carries a fresh token');
  p = await boot({ key: true });
  s = await sb(p);
  check('opening the page: still no sign-in, and the script is not loaded yet', s.anon.length === 0 && p.__ts === 0, { anon: s.anon, fetched: p.__ts });
  await p.evaluate(() => _sbAuth());
  await p.waitForTimeout(300);
  s = await sb(p);
  check('the kiosk gate loads Turnstile once and renders the widget', p.__ts === 1 && s.ts && s.ts.renders.length === 1 && s.widget, { fetched: p.__ts, ts: s.ts, widget: s.widget });
  check('with the site key, invisible unless Cloudflare asks', s.ts.renders[0].sitekey === '0x-test-key' && s.ts.renders[0].appearance === 'interaction-only', s.ts.renders[0]);
  check('the anonymous sign-in carries the token', s.anon.length === 1 && s.anon[0] && s.anon[0].options && s.anon[0].options.captchaToken === 'tok-1', s.anon);
  await login(p);
  await p.waitForTimeout(200);
  s = await sb(p);
  check('the password login carries a NEW token (tokens are single-use)', s.pw.length === 1 && s.pw[0].tok === 'tok-2', s.pw);
  check('the previous widget was removed first, the script fetched only once', s.ts.removed === 1 && p.__ts === 1, { removed: s.ts.removed, fetched: p.__ts });
  await login(p);
  await p.waitForTimeout(200);
  s = await sb(p);
  check('a second login attempt: a third token', s.pw.length === 2 && s.pw[1].tok === 'tok-3', s.pw);
  await p.close();

  console.log('\n4. with a key but the script blocked: the sign-in goes ahead without a token');
  p = await boot({ key: true, blockTurnstile: true });
  await p.evaluate(() => _sbAuth());
  await p.waitForTimeout(500);
  s = await sb(p);
  check('the script was attempted', p.__ts >= 1, { fetched: p.__ts });
  check('the anonymous sign-in still happened, with no token', s.anon.length === 1 && s.anon[0] === null, s.anon);
  await login(p);
  await p.waitForTimeout(300);
  s = await sb(p);
  check('so did the password login', s.pw.length === 1 && s.pw[0].tok === undefined, s.pw);
  await p.close();

  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR', e); process.exit(1); });
