// The shared code on the trustee screen -- what the trustee sees.
//
// Michael chose one code for everybody. The phone asks for it once and
// remembers it; every later open re-checks it behind the screen, so changing
// the code in Cloudflare signs every phone out. A phone with no reception
// still opens, because that is a trustee on the plant floor, not an intruder,
// and the offline outbox was built for exactly that person.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const ORIGIN = 'https://tapugan.test';
const EMP_KEY = 'tfgn_emp_mode';
const CODE_KEY = 'tfgn_emp_code';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const STUB = `
window.supabase = { createClient: function () { return { auth: {
  getSession: function () { return Promise.resolve({ data: { session: null } }); },
  onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
  signInAnonymously: function () { return Promise.resolve({ data: { session: { access_token: 'anon', user: { id: 'a', is_anonymous: true } } }, error: null }); },
  signOut: function () { return Promise.resolve({}); },
} }; } };`;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });

  // o.stored   a code the phone already remembers
  // o.server   'ok' | 'wrong' | 'unset' | 'down'   how /api/trustee-gate answers
  // o.emp      open as the trustee screen (?emp=1 remembered)
  const open = async (o) => {
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept().catch(() => {}));
    const gateCalls = [];
    await p.addInitScript((a) => {
      try {
        localStorage.removeItem(a.empKey); localStorage.removeItem(a.codeKey);
        if (a.emp) localStorage.setItem(a.empKey, '1');
        if (a.stored) localStorage.setItem(a.codeKey, a.stored);
      } catch (e) {}
    }, { empKey: EMP_KEY, codeKey: CODE_KEY, emp: !!o.emp, stored: o.stored || '' });
    await p.route('**/*', async (r) => {
      const u = r.request().url();
      if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: SRC });
      if (/supabase-js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
      if (/sw\.js$/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
      if (/\/api\/trustee-gate$/.test(u)) {
        let sent = null; try { sent = JSON.parse(r.request().postData() || '{}').code; } catch (e) {}
        gateCalls.push(sent);
        if (o.server === 'down') return r.abort();
        if (o.server === 'unset') return r.fulfill({ status: 503, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'not configured', message: 'הקוד עדיין לא הוגדר' }) });
        if (o.server === 'wrong' || sent !== 'RIGHT') return r.fulfill({ status: 403, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'wrong code', message: 'קוד שגוי' }) });
        return r.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true, remember: !!o.remember }) });
      }
      return r.abort();
    });
    await p.goto(ORIGIN + '/', { waitUntil: 'load' });
    await p.waitForTimeout(600);
    p.__gate = gateCalls;
    return p;
  };
  const state = (p) => p.evaluate((k) => ({
    gate: getComputedStyle(document.getElementById('m-emp-gate')).display,
    emp: document.body.classList.contains('emp-mode'),
    app: getComputedStyle(document.getElementById('app')).display,
    login: getComputedStyle(document.getElementById('login')).display,
    err: (document.getElementById('emp-gate-err') || {}).textContent || '',
    stored: (function () { try { return localStorage.getItem(k); } catch (e) { return null; } })(),
    home: !!document.querySelector('#pg-emp-home') && getComputedStyle(document.querySelector('#pg-emp-home')).display !== 'none',
  }), CODE_KEY);
  const type = async (p, code) => {
    await p.fill('#emp-gate-code', code);
    await p.click('#emp-gate-btn');
    await p.waitForTimeout(300);
  };

  console.log('\n1. the first time, the screen asks for the code');
  {
    const p = await open({ emp: true, server: 'ok' });
    const s = await state(p);
    check('the code screen is up', s.gate !== 'none', s);
    check('...and nothing was remembered yet', !s.stored, s.stored);
    // The app used to sit behind the code screen, dimmed but readable, showing
    // a shell no trustee ever sees. The guide screenshot is what showed it.
    check('...with nothing of the app showing behind it', s.app === 'none', s.app);
    await p.close();
  }

  console.log('\n2. a wrong code says so and asks again');
  {
    const p = await open({ emp: true, server: 'ok' });
    await type(p, 'NOPE');
    const s = await state(p);
    check('still on the code screen', s.gate !== 'none', s);
    check('...with the reason in Hebrew', /שגוי/.test(s.err), s.err);
    check('...and nothing remembered', !s.stored, s.stored);
    check('the guess went to the server, not to a check in the page', p.__gate.length === 1 && p.__gate[0] === 'NOPE', p.__gate);
    await p.close();
  }

  console.log('\n3. the right code opens the trustee screen, and is not written down');
  {
    // Michael, 2026-09-21: «אני רוצה הזנה של קוד כל פעם מחדש». The plant policy
    // comes from the server, and the default is not to remember.
    const p = await open({ emp: true, server: 'ok' });
    await type(p, 'RIGHT');
    const s = await state(p);
    check('the code screen is gone', s.gate === 'none', s);
    check('...the trustee screen is showing', s.emp && s.app === 'block', s);
    check('...and nothing was stored on the phone', !s.stored, s.stored);
    await p.close();
  }

  console.log('\n3b. so the next open asks again');
  {
    const p = await open({ emp: true, server: 'ok' });
    const s = await state(p);
    check('a fresh open wants the code', s.gate !== 'none' && s.app === 'none', s);
    await p.close();
  }

  console.log('\n4. unless the plant says the phone may remember it');
  {
    const p = await open({ emp: true, server: 'ok', remember: true });
    await type(p, 'RIGHT');
    const s = await state(p);
    check('with remember on, the code is kept', s.stored === 'RIGHT', s.stored);
    await p.close();
    const p2 = await open({ emp: true, stored: 'RIGHT', server: 'ok', remember: true });
    const s2 = await state(p2);
    check('...and the next open goes straight in', s2.gate === 'none' && s2.emp && s2.app === 'block', s2);
    check('...having re-checked it with the server', p2.__gate.length === 1 && p2.__gate[0] === 'RIGHT', p2.__gate);
    await p2.close();
  }

  console.log('\n4b. turning remembering off reaches phones that already did');
  {
    // The policy changed under a phone that had been allowed to remember. It
    // keeps the session it is in and is asked on the next open, like everyone.
    // The stored code has to be one the server still ACCEPTS, or this measures
    // a rejection instead of a policy change. It did, the first time.
    const p = await open({ emp: true, stored: 'RIGHT', server: 'ok', remember: false });
    await p.waitForTimeout(250);
    const s = await state(p);
    check('this session is not interrupted', s.app === 'block' && s.gate === 'none', s);
    check('...but the stored code is dropped', !s.stored, s.stored);
    await p.close();
  }

  console.log('\n5. changing the code in Cloudflare signs the phone out');
  {
    // The phone remembers the old code; the server now refuses it.
    const p = await open({ emp: true, stored: 'OLD', server: 'wrong' });
    const s = await state(p);
    check('the code screen comes back', s.gate !== 'none', s);
    check('...and the old code is forgotten', !s.stored, s.stored);
    await p.close();
  }

  console.log('\n5b. coming back to a screen that is not allowed to remember');
  {
    const p = await open({ emp: true, server: 'ok' });
    await type(p, 'RIGHT');
    const r = await p.evaluate(async () => {
      const out = {};
      // Seconds away: a camera, or a share sheet. Not a departure.
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 120));
      out.quick = { gate: getComputedStyle(document.getElementById('m-emp-gate')).display, app: getComputedStyle(document.getElementById('app')).display };
      // Two minutes away, with a report half written and a photo on it. The
      // form is never taken away -- losing it loses the hazard report.
      window._empGateSeen = Date.now() - 2 * 60 * 1000;
      const m = document.getElementById('m-tru');
      if (m) m.style.display = 'block';
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 120));
      out.busy = { gate: getComputedStyle(document.getElementById('m-emp-gate')).display };
      if (m) m.style.display = 'none';
      // Two minutes away with nothing open: the code again.
      window._empGateSeen = Date.now() - 2 * 60 * 1000;
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r2) => setTimeout(r2, 120));
      out.away = { gate: getComputedStyle(document.getElementById('m-emp-gate')).display, app: getComputedStyle(document.getElementById('app')).display };
      return out;
    });
    check('a few seconds away changes nothing', r.quick.gate === 'none' && r.quick.app === 'block', r.quick);
    check('...and a form being written is never interrupted', r.busy.gate === 'none', r.busy);
    check('...but coming back later asks for the code', r.away.gate !== 'none' && r.away.app === 'none', r.away);
    await p.close();
  }

  console.log('\n6. no reception is not a wrong code');
  {
    const p = await open({ emp: true, stored: 'RIGHT', server: 'down', remember: true });
    const s = await state(p);
    check('the trustee screen opens anyway', s.gate === 'none' && s.emp && s.app === 'block', s);
    check('...and the code is kept for next time', s.stored === 'RIGHT', s.stored);
    check('...without the server having answered at all', p.__gate.length === 1, p.__gate);
    await p.close();
  }

  console.log('\n7. a code nobody has set yet');
  {
    const p = await open({ emp: true, server: 'unset' });
    await type(p, 'RIGHT');
    const s = await state(p);
    check('the screen stays and says the code was not set up', s.gate !== 'none' && /לא הוגדר/.test(s.err), s.err);
    await p.close();
  }

  console.log('\n8. the login screen button also goes through the code');
  {
    const p = await open({ emp: false, server: 'ok' });
    const before = await state(p);
    check('the login screen is showing', before.login !== 'none', before.login);
    const label = await p.evaluate(() => (document.getElementById('login-emp-btn') || {}).textContent || '');
    // The guide and the card were written from this label. It promised no
    // password; that is no longer true.
    check('the trustee button no longer promises "no password"', !/ללא סיסמה/.test(label), label);
    await p.click('#login-emp-btn');
    await p.waitForTimeout(300);
    const s = await state(p);
    check('pressing it asks for the code', s.gate !== 'none', s);
    // btn alone has no background of its own and falls back to the browser's
    // grey, which on a phone reads as a disabled button. The guide screenshot
    // is what showed it.
    const styled = await p.evaluate(() => {
      const bg = getComputedStyle(document.getElementById('emp-gate-btn')).backgroundColor;
      const m = bg.match(/\d+/g) || [];
      return { bg, red: Number(m[0]) > 150 && Number(m[1]) < 90 && Number(m[2]) < 90 };
    });
    check('...and the entry button looks like the primary action, not a disabled one', styled.red, styled);
    check('...and going back returns to the login screen', true);
    await p.click('#m-emp-gate .btn-s');
    await p.waitForTimeout(200);
    const back = await state(p);
    check('back: login screen, no trustee mode left behind', back.login !== 'none' && !back.emp && back.gate === 'none', back);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
