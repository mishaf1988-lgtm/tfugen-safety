// Staying logged in across a reload.
//
// Michael, 2026-09-21: on the iPhone, pulling down from the top of the screen
// drops him on the page with the login on it. That gesture is a reload, and a
// reload should have put him back where he was -- supabase-js is created with
// persistSession:true and the session is sitting in localStorage.
//
// It never got that far. The boot block is an inline script in the body, so it
// runs while the parser is still inside the document; supabase-js is loaded
// with <script defer>, which by definition has not run yet at that moment. So
// _sbBoot() found no library, proceed(null) ran, and the login screen appeared
// without the saved session ever being looked at. Every single reload asked
// for the password again -- and on a home-screen app a reload is one careless
// swipe.
//
// The second half of the same bug: nothing on this path ever hid #login, which
// is display:flex;position:fixed;inset:0;z-index:1000. That stayed invisible
// only because this path had never once reached a logged-in user.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const ORIGIN = 'https://tapugan.test';
const EMP_KEY = 'tfgn_emp_mode';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// A stand-in for supabase-js. `session` is what getSession() hands back.
const stub = (session) => `
window.__made = 0;
window.supabase = { createClient: function () {
  window.__made++;
  return { auth: {
    getSession: function () { return Promise.resolve({ data: { session: ${JSON.stringify(session)} } }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    signInAnonymously: function () { return Promise.resolve({ data: { session: null }, error: null }); },
    signOut: function () { return Promise.resolve({}); },
  } };
} };
`;

const ADMIN = { access_token: 'tok', user: { email: 'mishaf1988@gmail.com', is_anonymous: false } };
// The app's admin is admin@tfugen.local; every other named user is
// <username>@tfugen.local with a row in app_users that carries the role.
const REAL_ADMIN = { access_token: 'tok', user: { email: 'admin@tfugen.local', is_anonymous: false } };
const MANAGER = { access_token: 'tok', user: { email: 'dani@tfugen.local', is_anonymous: false } };
const LOCAL_DB = { app_users: [{ id: 'dani', username: 'dani', role: '\u05de\u05e0\u05d4\u05dc', full_name: '\u05d3\u05e0\u05d9', active: true }] };
const ANON = { access_token: 'anon', user: { email: null, is_anonymous: true } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });

  // o.session   what the library reports, or null
  // o.lib       'ok' | 'dead' (the request fails) | 'hang' (it never answers)
  // o.emp       the device is a trustee's
  const boot = async (o) => {
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept().catch(() => {}));
    // The default lock since 2026-09-21 is «every open», which would send every
    // case here to the login screen and prove nothing about the restore. This
    // suite is about the restore, so it runs under the timed lock.
    await p.addInitScript(() => { try { localStorage.setItem('tfgn_app_prefs', JSON.stringify({ lockMin: 720 })); localStorage.setItem('tfgn_last_seen', String(Date.now())); } catch (e) {} });
    // Since 2026-09-21 the trustee screen sits behind a shared code. A phone
    // without it gets the code screen, which is correct and is covered in
    // trustee-gate-client-test; this case is about the restore, so the phone
    // arrives already knowing the code.
    if (o.emp) await p.addInitScript((k) => { try { localStorage.setItem(k, '1'); localStorage.setItem('tfgn_emp_code', 'RIGHT'); } catch (e) {} }, EMP_KEY);
    if (o.db) await p.addInitScript((d) => { try { localStorage.setItem('tfgn2', JSON.stringify(d)); } catch (e) {} }, o.db);
    await p.route('**/*', async (r) => {
      const u = r.request().url();
      if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: SRC });
      if (/supabase-js/.test(u)) {
        if (o.lib === 'dead') return r.abort();
        if (o.lib === 'hang') return; // held open: no response, no error, ever
        return r.fulfill({ contentType: 'application/javascript', body: stub(o.session || null) });
      }
      if (/sw\.js$/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
      return r.abort();
    });
    const t0 = Date.now();
    await p.goto(ORIGIN + '/', { waitUntil: 'commit' });
    // What is being measured is the decision, so the wait has to be for the
    // decision -- not for the login screen, which the stylesheet already shows
    // (#login is display:flex by default). The tell is an INLINE display: both
    // showLogin and hideLogin set one, and nothing else does. Waiting on the
    // computed value instead made cases 2-5 pass before a line of script ran.
    await p.waitForFunction(() => {
      const l = document.getElementById('login');
      return !!(l && l.style.display);
    }, null, { timeout: o.lib === 'hang' ? 20000 : 10000 }).catch(() => {});
    const r = await p.evaluate(() => ({
      decided: !!document.getElementById('login').style.display,
      login: document.getElementById('login').style.display || '(never set)',
      app: getComputedStyle(document.getElementById('app')).display,
      isAdmin: typeof _isAdmin !== 'undefined' ? _isAdmin : '?',
      role: typeof _role === 'function' ? _role() : '?',
      who: (typeof _currentUser !== 'undefined' && _currentUser) ? _currentUser.username : null,
      emp: document.body.classList.contains('emp-mode'),
      made: window.__made || 0,
      wired: !!(window.doLogin && typeof window.doLogin === 'function'),
      empFlag: (function () { try { return localStorage.getItem('tfgn_emp_mode'); } catch (e) { return '?'; } })(),
      gate: (function () { const m = document.getElementById('m-emp-gate'); return m ? getComputedStyle(m).display : '(none)'; })(),
      onDash: (typeof CUR !== 'undefined') ? CUR : '?',
    }));
    r.ms = Date.now() - t0;
    if (o.db) {
      // the profile merge runs 900ms after the restore, as it does after login
      await p.waitForTimeout(1100);
      const late = await p.evaluate(() => ({ role: _role(), who: _currentUser && _currentUser.username }));
      r.role = late.role; r.who = late.who;
    }
    await p.close();
    return r;
  };

  console.log('\n1. a reload with a live session goes back into the app');
  {
    const r = await boot({ session: ADMIN, lib: 'ok' });
    // The bug: this used to be login:'flex', app:'none', isAdmin:false.
    check('the app is shown', r.app === 'block', r);
    check('...and the login screen is not left covering it', r.login === 'none', r);
    check('...and the user is the admin again, not a stranger', r.isAdmin === true, r);
    check('...it did ask the library for the session', r.made === 1, r.made);
  }

  console.log('\n1b. and it knows who came back');
  {
    // doLogin builds _currentUser from the form. The restore path never did,
    // and _role() reads a null user as 'reporter' -- so the admin came back
    // to the reporter's menus. Invisible until the restore actually ran.
    const r = await boot({ session: REAL_ADMIN, lib: 'ok' });
    check('the admin is the admin after a reload', r.who === 'admin' && r.role === 'admin', { who: r.who, role: r.role });
    const m = await boot({ session: MANAGER, lib: 'ok', db: LOCAL_DB });
    await new Promise((r2) => setTimeout(r2, 0));
    check('a manager is named from the session', m.who === 'dani', m.who);
    check('...and gets the manager role from the local app_users row', m.role === 'manager', m.role);
  }

  console.log('\n2. with no session it still asks for a password');
  {
    const r = await boot({ session: null, lib: 'ok' });
    check('the boot actually decided, rather than leaving the default on screen', r.decided, r);
    check('...the login screen is shown', r.login === 'flex', r);
    check('...and nobody is admitted', r.isAdmin === false && r.app === 'none', r);
  }

  console.log('\n3. an anonymous session is not a login');
  {
    // Anonymous sessions are how a trustee posts without an account. Treating
    // one as a signed-in user would hand the whole app to anyone with a link.
    const r = await boot({ session: ANON, lib: 'ok' });
    check('it is not mistaken for a logged-in user', r.isAdmin === false, r);
    check('...and the login screen is shown', r.decided && r.login === 'flex', r);
  }

  console.log('\n4. when the library cannot be loaded at all');
  {
    const r = await boot({ session: ADMIN, lib: 'dead' });
    check('it falls back to the login screen', r.decided && r.login === 'flex', r);
    check('...quickly, not after a wait (' + r.ms + 'ms)', r.ms < 5000, r.ms);
  }

  console.log('\n5. and when the request hangs instead of failing');
  {
    // A stalled connection never fires DOMContentLoaded, so waiting for it
    // alone would leave a blank screen for as long as the phone is on a bad
    // signal. There is a cap.
    const r = await boot({ session: ADMIN, lib: 'hang' });
    check('it gives up and shows the login screen', r.decided && r.login === 'flex', r);
    // The cap is 8s. Under 5s would mean something else let it through early,
    // which is how this very case passed at 0ms before the wait was fixed.
    check('...after the cap, and not forever (' + (r.ms / 1000).toFixed(1) + 's)',
      r.ms > 5000 && r.ms < 15000, r.ms);
  }

  console.log('\n6. a trustee reopening the app');
  {
    // Trustees have no account; the device remembers what it is. This branch
    // never hid the login overlay either, and the overlay is fixed, full
    // screen, z-index 1000 -- it would have sat on top of everything.
    const r = await boot({ session: null, lib: 'ok', emp: true });
    check('the trustee screen is shown', r.app === 'block' && r.emp === true, r);
    check('...with no red login screen on top of it', r.login === 'none', r);
    check('...and no admin rights come with it', r.isAdmin === false, r);
  }

  console.log('\n7. the password box still works when it is shown');
  {
    const r = await boot({ session: null, lib: 'ok' });
    check('the login handler is in place', r.wired, r);
  }

  console.log('\nZ. a restored manager is not sent to the trustee gate (2026-09-22)');
  {
    // Michael opened the app and was asked for the trustees' shared code
    // instead of his own dashboard. EMP_KEY is sticky — one visit to the
    // ?emp=1 link sets it for good — and a fresh password login clears it,
    // but a RESTORED session did not, so the leftover flag routed the manager
    // into the kiosk and the gate demanded a code he does not use.
    const r = await boot({ session: ADMIN, lib: 'ok', emp: true });
    check('signed in as a manager, not the kiosk', r.isAdmin === true && r.app === 'block', r);
    check('the leftover kiosk flag is cleared, not obeyed', r.empFlag === null && r.emp === false, { empFlag: r.empFlag, emp: r.emp });
    check('no code screen, and he lands on the dashboard', r.gate === 'none' || r.gate === '(none)', r.gate);
    check('...on the dashboard, not the trustee home', r.onDash !== 'emp-home', r.onDash);
  }

  {
    // The trustee side is untouched: no admin session, flag set, gate asks.
    const r = await boot({ session: ANON, lib: 'ok', emp: true });
    check('a real trustee device still goes to the trustee screen', r.isAdmin === false && r.emp === true, { isAdmin: r.isAdmin, emp: r.emp });
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
