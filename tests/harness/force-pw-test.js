// First-login "change password" flow refreshes the token (2026-09-24 red-team).
//
// must_change_password is now enforced by RLS (RESTRICTIVE pwchange_required on
// every table). updateUser clears the flag, but it reaches the JWT only on a
// refresh -- so _pwChangeSubmit must call refreshSession and adopt the new
// token BEFORE it proceeds, or the very next data read is blocked by the policy
// it just satisfied. This drives the real _pwChangeSubmit against a stubbed
// auth client and checks the refresh happened and the token was swapped.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const stub = `
window.__calls = { update: 0, refresh: 0, updateData: null };
window.supabase = { createClient: function () {
  return { auth: {
    getSession: function () { return Promise.resolve({ data: { session: null } }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    signInAnonymously: function () { return Promise.resolve({ data: { session: null }, error: null }); },
    signOut: function () { return Promise.resolve({}); },
    updateUser: function (u) { window.__calls.update++; window.__calls.updateData = u && u.data; return Promise.resolve({ data: { user: {} }, error: null }); },
    // Only after this does the token lose must_change_password.
    refreshSession: function () { window.__calls.refresh++; return Promise.resolve({ data: { session: { access_token: 'tok-refreshed', user: { email: 'admin@tfugen.local' } } }, error: null }); },
  } };
} };
`;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(stub);
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // Stand where doLogin stands when it hits a must_change_password account: a
  // valid (flag-carrying) token in hand, the force-change modal open.
  const out = await page.evaluate(async () => {
    _sbBoot();
    window._sbToken = 'tok-stale-with-flag';
    window._pendingLogin = { lb: null, email: 'admin@tfugen.local', uname: 'admin' };
    document.getElementById('fpc-new').value = 'brand-new-pw-1';
    document.getElementById('fpc-confirm').value = 'brand-new-pw-1';
    _pwChangeSubmit();
    await new Promise((r) => setTimeout(r, 600));
    const vis = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    return { calls: window.__calls, token: window._sbToken, pending: window._pendingLogin, appShown: vis('app'), modalShown: vis('m-force-pw-change') };
  });

  check('updateUser was called to set the new password', out.calls.update === 1, out.calls);
  check('and it cleared must_change_password', out.calls.updateData && out.calls.updateData.must_change_password === false, out.calls);
  check('refreshSession was called after the update', out.calls.refresh === 1, out.calls);
  check('the stale flag-carrying token was swapped for the refreshed one', out.token === 'tok-refreshed', out);
  check('the flow proceeded (pending cleared, app shown, modal hidden)', out.pending === null && out.appShown && !out.modalShown, out);
  check('no page errors', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
