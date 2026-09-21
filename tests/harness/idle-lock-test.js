// The app locks itself after a spell of not being used.
//
// Michael, 2026-09-21: «למה זה מכניס אותי ללא סיסמה לאפליקציה?»
//
// Until that morning the app asked for the password on every open. Not by
// design -- a bug meant the saved session was never read, so it always decided
// nobody was logged in. Fixing that bug removed a protection nobody had meant
// to build and he had come to rely on. He chose the middle answer: stay signed
// in while the app is in use, ask again after it has been left alone.
//
// Two things this has to get right, and they pull against each other. It must
// actually lock -- an idle lock that quietly does nothing is worse than none,
// because he believes he has one. And it must never lock a trustee, who has no
// password to come back with; a locked-out trustee is a hazard nobody reports.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const ORIGIN = 'https://tapugan.test';
const EMP_KEY = 'tfgn_emp_mode';
const SEEN_KEY = 'tfgn_last_seen';
const PREFS_KEY = 'tfgn_app_prefs';
const MIN = 60 * 1000;
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const ADMIN = { access_token: 'tok', user: { email: 'mishaf1988@gmail.com', is_anonymous: false } };
const stub = (session) => `
window.__signedOut = 0;
window.supabase = { createClient: function () {
  return { auth: {
    getSession: function () { return Promise.resolve({ data: { session: ${JSON.stringify(session)} } }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    signInAnonymously: function () { return Promise.resolve({ data: { session: null }, error: null }); },
    signOut: function () { window.__signedOut++; return Promise.resolve({}); },
  } };
} };
`;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });

  // o.idleMin   how long ago the app was last touched, in minutes (null = never stamped)
  // o.lockMin   the saved preference, if any
  // o.emp       a trustee's device
  // o.session   what the library reports (defaults to a live admin session)
  const boot = async (o) => {
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept().catch(() => {}));
    await p.addInitScript((s) => {
      try {
        // Pages in one browser context share localStorage, so every case has
        // to start from a known state. Without this, the delay chosen in case
        // 4 was still in force in cases 8 and 9 -- which is how they failed,
        // and how they could just as easily have passed for the wrong reason.
        [s.seenKey, s.empKey, s.prefsKey, 'tfgn_emp_code'].forEach(function (k) { localStorage.removeItem(k); });
        if (s.idle !== null) localStorage.setItem(s.seenKey, String(Date.now() - s.idle));
        // The trustee screen sits behind a shared code since 2026-09-21. This
        // case is about the lock never touching a trustee, not about the gate,
        // so the phone already knows the code.
        if (s.emp) { localStorage.setItem(s.empKey, '1'); localStorage.setItem('tfgn_emp_code', 'RIGHT'); }
        // Since Michael asked for a lock on every open, that is the default. The
        // timed cases seed 30 minutes explicitly; lockMin:null means "whatever
        // the app defaults to", for the cases about the default itself.
        if (s.lockMin !== null) localStorage.setItem(s.prefsKey, JSON.stringify({ lockMin: s.lockMin }));
      } catch (e) {}
    }, {
      seenKey: SEEN_KEY, empKey: EMP_KEY, prefsKey: PREFS_KEY,
      idle: o.idleMin === undefined || o.idleMin === null ? null : o.idleMin * MIN,
      emp: !!o.emp, lockMin: (o.lockMin === undefined ? 30 : o.lockMin),
    });
    await p.route('**/*', (r) => {
      const u = r.request().url();
      if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: SRC });
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: stub('session' in o ? o.session : ADMIN) });
      if (/sw\.js$/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
      return r.abort();
    });
    await p.goto(ORIGIN + '/', { waitUntil: 'commit' });
    // Wait for the boot to decide: only showLogin/hideLogin set an inline
    // display on #login, and the stylesheet default is flex.
    await p.waitForFunction(() => {
      const l = document.getElementById('login');
      return !!(l && l.style.display);
    }, null, { timeout: 10000 }).catch(() => {});
    return p;
  };

  const state = (p) => p.evaluate((k) => ({
    login: document.getElementById('login').style.display || '(never set)',
    app: getComputedStyle(document.getElementById('app')).display,
    isAdmin: typeof _isAdmin !== 'undefined' ? _isAdmin : '?',
    emp: document.body.classList.contains('emp-mode'),
    signedOut: window.__signedOut || 0,
    stamp: (function () { try { return localStorage.getItem(k); } catch (e) { return 'ERR'; } })(),
    mins: typeof _lockMinutes === 'function' ? _lockMinutes() : '?',
  }), SEEN_KEY);

  console.log('\n1. used a minute ago: straight in');
  {
    const p = await boot({ idleMin: 1 });
    const r = await state(p);
    check('the app opens without a password', r.app === 'block' && r.isAdmin === true, r);
    check('...and nothing was signed out', r.signedOut === 0, r);
    check('...and the visit is recorded, so the clock restarts', Number(r.stamp) > Date.now() - 20000, r.stamp);
    await p.close();
  }

  console.log('\n2. left alone for an hour: the password is asked for again');
  {
    const p = await boot({ idleMin: 60 });
    const r = await state(p);
    check('the login screen is shown', r.login === 'flex' && r.app === 'none', r);
    // Showing a login screen while quietly keeping the session alive would be
    // theatre: the token would still be on the device.
    check('...and the session is really dropped, not just hidden', r.signedOut === 1, r);
    check('...and nobody is admin any more', r.isAdmin === false, r);
    await p.close();
  }

  console.log('\n3. the default is half an hour, and it is the real boundary');
  {
    const under = await boot({ idleMin: 29 });
    const ru = await state(under);
    check('29 minutes is still inside', ru.app === 'block' && ru.isAdmin === true, ru);
    check('...with the 30 that was chosen in force', ru.mins === 30, ru.mins);
    await under.close();
    const over = await boot({ idleMin: 31 });
    const ro = await state(over);
    check('31 minutes is outside', ro.login === 'flex' && ro.isAdmin === false, ro);
    await over.close();
  }

  console.log('\n3b. the default is a lock on every open');
  {
    // Michael, the same afternoon: «נעילה אחרי כל כניסה לאפליקציה, לא להשאיר
    // פתוח». So a phone that has never chosen anything asks every time --
    // used a minute ago or not.
    const p1 = await boot({ idleMin: 1, lockMin: null });
    const r = await state(p1);
    check('used a minute ago, no choice made: the password is asked for', r.login === 'flex' && r.isAdmin === false, r);
    check('...and the session really dropped', r.signedOut === 1, r.signedOut);
    check('...because the default is «every open»', r.mins === -1, r.mins);
    await p1.close();
    const p2 = await boot({ idleMin: null, lockMin: -1 });
    const fresh = await state(p2);
    check('a phone never stamped asks too -- every open means every open', fresh.login === 'flex', fresh);
    await p2.close();
    const p3 = await boot({ idleMin: 1, lockMin: -1 });
    const chosen = await state(p3);
    check('chosen explicitly it behaves the same', chosen.login === 'flex' && chosen.signedOut === 1, chosen);
    // "Chosen explicitly" proves nothing while the default is the same value:
    // a build that dropped -1 on the floor and fell back to the default
    // passed this. So the default is moved out of the way and -1 has to
    // survive on its own.
    const own = await p3.evaluate(() => {
      window._LOCK_DEFAULT_MIN = 30;
      localStorage.setItem('tfgn_app_prefs', JSON.stringify({ lockMin: -1 }));
      return _lockMinutes();
    });
    check('...and -1 is read as a choice, not mistaken for «unset»', own === -1, own);
    await p3.close();
  }

  console.log('\n3c. «every open»: coming back is an open, a camera round trip is not');
  {
    // On iOS a home-screen app resumes without reloading, so a phone in
    // this mode has to lock on resume too -- but the page also goes hidden
    // for the seconds a camera or a share sheet is up, and locking the form
    // somebody was in the middle of is not what "do not leave it open" meant.
    const p = await boot({ idleMin: 1, lockMin: 30 });
    const r = await p.evaluate(async (k) => {
      try { localStorage.setItem('tfgn_app_prefs', JSON.stringify({ lockMin: -1 })); } catch (e) {}
      const out = {};
      localStorage.setItem(k, String(Date.now() - 20 * 1000));           // 20 seconds away
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 120));
      out.afterSeconds = { app: getComputedStyle(document.getElementById('app')).display, isAdmin: _isAdmin };
      localStorage.setItem(k, String(Date.now() - 3 * 60 * 1000));       // three minutes away
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 120));
      out.afterMinutes = { login: document.getElementById('login').style.display, isAdmin: _isAdmin, signedOut: window.__signedOut || 0 };
      return out;
    }, SEEN_KEY);
    check('twenty seconds away: still in', r.afterSeconds.app === 'block' && r.afterSeconds.isAdmin === true, r.afterSeconds);
    check('three minutes away: locked', r.afterMinutes.login === 'flex' && r.afterMinutes.isAdmin === false && r.afterMinutes.signedOut === 1, r.afterMinutes);
    await p.close();
  }

  console.log('\n4. the delay is his to change');
  {
    const p = await boot({ idleMin: 60, lockMin: 720 });
    const r = await state(p);
    check('with 12 hours chosen, an hour away is nothing', r.app === 'block' && r.isAdmin === true, r);
    check('...and the setting is what is in force', r.mins === 720, r.mins);
    await p.close();
    const never = await boot({ idleMin: 60 * 24 * 30, lockMin: 0 });
    const rn = await state(never);
    // 0 has to mean never, not "fall back to the default", or choosing it
    // would silently do the opposite of what it says.
    check('«never» after a month away still walks in', rn.app === 'block' && rn.isAdmin === true, rn);
    check('...and it is not mistaken for unset', rn.mins === 0, rn.mins);
    await never.close();
    const short = await boot({ idleMin: 20, lockMin: 15 });
    const rs = await state(short);
    check('15 minutes chosen, 20 away: locked', rs.login === 'flex' && rs.isAdmin === false, rs);
    await short.close();
  }

  console.log('\n5. a device that has never been stamped is not locked out');
  {
    // The first load after this ships has no stamp, and neither does a phone
    // whose storage was cleared. Treating «unknown» as «expired» would lock
    // everyone out once, for no reason.
    const p = await boot({ idleMin: null });
    const r = await state(p);
    check('it opens', r.app === 'block' && r.isAdmin === true, r);
    check('...and starts the clock from now', Number(r.stamp) > Date.now() - 20000, r.stamp);
    await p.close();
  }
  {
    // A stamp in the future means the clock moved, not that time passed.
    const p = await boot({ idleMin: -600 });
    const r = await state(p);
    check('a stamp from the future does not lock anyone out', r.app === 'block' && r.isAdmin === true, r);
    await p.close();
  }

  console.log('\n6. a trustee is never locked out');
  {
    // No password, no way back in. Whatever the delay says.
    const p = await boot({ idleMin: 60 * 24 * 7, session: null, emp: true, lockMin: 15 });
    const r = await state(p);
    check('a week later the trustee screen still opens', r.app === 'block' && r.emp === true, r);
    check('...with no login screen on top', r.login === 'none', r);
    check('...and nothing was signed out from under them', r.signedOut === 0, r);
    await p.close();
  }

  console.log('\n7. coming back to an app that was left open');
  {
    // On iOS a home-screen app usually resumes WITHOUT reloading, so a check
    // that only runs at startup would almost never run at all. This is the
    // case that matters most on his phone, and the easiest one to miss.
    const p = await boot({ idleMin: 1 });
    const r = await p.evaluate(async (k) => {
      const before = { app: getComputedStyle(document.getElementById('app')).display, isAdmin: _isAdmin };
      // Backdate the stamp: the app sat in the background for two hours.
      localStorage.setItem(k, String(Date.now() - 120 * 60 * 1000));
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 150));
      return {
        before: before,
        login: document.getElementById('login').style.display,
        app: getComputedStyle(document.getElementById('app')).display,
        isAdmin: _isAdmin, signedOut: window.__signedOut || 0,
      };
    }, SEEN_KEY);
    check('it was open and signed in to begin with', r.before.app === 'block' && r.before.isAdmin === true, r.before);
    check('...and resuming after two hours locks it', r.login === 'flex' && r.app === 'none', r);
    check('...dropping the session with it', r.signedOut === 1 && r.isAdmin === false, r);
    await p.close();
  }
  {
    const p = await boot({ idleMin: 1 });
    const r = await p.evaluate(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 150));
      return { app: getComputedStyle(document.getElementById('app')).display, isAdmin: _isAdmin, signedOut: window.__signedOut || 0 };
    });
    check('...while a quick switch away and back does not', r.app === 'block' && r.isAdmin === true && r.signedOut === 0, r);
    await p.close();
  }

  console.log('\n8. using the app keeps it awake');
  {
    const p = await boot({ idleMin: 20 });
    const r = await p.evaluate(async (k) => {
      const was = localStorage.getItem(k);
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r2) => setTimeout(r2, 60));
      return { was: Number(was), now: Number(localStorage.getItem(k)) };
    }, SEEN_KEY);
    check('a tap pushes the lock back', r.now > r.was, r);
    await p.close();
  }
  {
    // ...but not from the login screen, where a tap is somebody trying to get
    // in, not somebody already in.
    const p = await boot({ idleMin: 60 });
    const r = await p.evaluate(async (k) => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r2) => setTimeout(r2, 60));
      return { isAdmin: _isAdmin, stamp: localStorage.getItem(k) };
    }, SEEN_KEY);
    check('tapping on the login screen does not start the clock', !r.isAdmin && !r.stamp, r);
    await p.close();
  }

  console.log('\n9. the setting is reachable, and it saves');
  {
    const p = await boot({ idleMin: 1, lockMin: null });
    const r = await p.evaluate((k) => {
      const sel = document.getElementById('mvis-lock');
      if (!sel) return { missing: true };
      _modVisOpen();
      const shown = sel.value;
      sel.value = '120';
      _modVisSaveFromUI();
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(k) || '{}').lockMin; } catch (e) {}
      return { shown: shown, saved: saved, mins: _lockMinutes(), opts: [].map.call(sel.options, function (o) { return o.value; }) };
    }, PREFS_KEY);
    check('the choice is in the settings screen', !r.missing, r);
    check('...showing what is in force («every open» by default)', r.shown === '-1', r);
    check('...and «never» is one of the choices', (r.opts || []).indexOf('0') >= 0, r.opts);
    check('...and so is «every open»', (r.opts || []).indexOf('-1') >= 0, r.opts);
    check('changing it saves and takes effect', r.saved === 120 && r.mins === 120, r);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
