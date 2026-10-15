// Sign-in: no step waits in silence, and every step is timed (15/10/2026).
// Michael: "I type the password and it is stuck". Nobody could tell which step was slow. Now each
// step that waits on a server (password, second-factor check, the code check, the approval read)
// has a limit (_LG_WAIT_MS) and, past it, a line that names the step and stays on screen. Each
// sign-in keeps its step times on the device (_LG_KEY, last 10), and the system screen shows them.
// supabase-js is a stand-in assigned to _sbClient; a step "hangs" with a promise that never settles.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith('file://') ? r.continue() : r.abort()));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const o = {};
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const never = () => new Promise(() => {});
    const W = 150;
    _LG_WAIT_MS = W;
    _captcha = () => Promise.resolve(null);
    window.toast = () => {};
    let st;
    const okSess = (email) => ({ data: { session: { access_token: 't', user: { email, user_metadata: {}, app_metadata: {} } }, user: { email, user_metadata: {}, app_metadata: {} } }, error: null });
    const client = (h) => {
      st = { signOuts: 0 };
      return { auth: {
        signInWithPassword: (c) => (h.pw === 'hang' ? never() : Promise.resolve(okSess(c.email))),
        signOut: () => { st.signOuts++; return Promise.resolve({}); },
        getSession: () => Promise.resolve({ data: { session: null } }),
        mfa: {
          getAuthenticatorAssuranceLevel: () => (h.aal === 'hang' ? never() : Promise.resolve({ data: { currentLevel: 'aal1', nextLevel: h.aal2 ? 'aal2' : 'aal1' } })),
          listFactors: () => Promise.resolve({ data: { totp: [{ id: 'f1' }] } }),
          challengeAndVerify: () => (h.verify === 'hang' ? never() : Promise.resolve({ data: {}, error: null })),
        },
      } };
    };
    const login = async (uname, h, wait) => {
      _sbClient = client(h);
      document.getElementById('uname').value = uname;
      document.getElementById('pw').value = 'x';
      doLogin();
      await sleep(wait || W + 150);
      const lb = document.getElementById('login-btn');
      return { err: document.getElementById('pw-err').textContent, btn: lb.textContent, dis: lb.disabled, signOuts: st.signOuts, last: _lgList().slice(-1)[0] };
    };
    try { localStorage.removeItem(_LG_KEY); } catch (e) {}
    o.empty = _sysChkLogin();
    // 1. the password check never answers
    o.pw = await login('admin', { pw: 'hang' });
    // the line stays (the ordinary error line clears after 2.5 seconds)
    await sleep(2700); o.pwStays = document.getElementById('pw-err').textContent;
    // 2. the second-factor check never answers: not "cancelled", the half session is dropped
    o.aal = await login('admin', { aal: 'hang' });
    // 3. the code check never answers: the code window says so and the button works again
    _sbClient = client({ aal2: true, verify: 'hang' });
    document.getElementById('uname').value = 'admin'; document.getElementById('pw').value = 'x';
    doLogin(); await sleep(60);
    o.codeOpen = document.getElementById('m-mfa').style.display;
    o.codeBtn = document.getElementById('login-btn').textContent;
    document.getElementById('mfa-code').value = '123456'; document.getElementById('mfa-ok').click();
    await sleep(W + 100);
    o.codeErr = document.getElementById('mfa-err').textContent; o.codeOk = document.getElementById('mfa-ok').disabled;
    document.getElementById('mfa-cancel').click(); await sleep(50);
    // 4. the approval read never answers
    const realFetch = window.fetch;
    window.fetch = (u) => (String(u).indexOf('app_users') >= 0 ? never() : realFetch(u));
    o.user = await login('dana', {});
    window.fetch = realFetch;
    // 5. a sign-in that goes through: every step timed, and the system screen shows it
    o.ok = await login('admin', {}, 80);
    o.sysOk = _sysChkLogin();
    // 6. a slow password step is flagged
    localStorage.setItem(_LG_KEY, JSON.stringify([{ at: new Date().toISOString(), s: { cf: 100, pw: 9000, mfa: 50 }, total: 9150, res: 'ok' }]));
    o.sysSlow = _sysChkLogin();
    o.kept = (() => { localStorage.setItem(_LG_KEY, '[]'); for (let i = 0; i < 13; i++) { _lgStart(); _lgEnd('ok'); } return _lgList().length; })();
    return o;
  });
  check('the system screen before any sign-in: says nothing was measured', r.empty.s === 'ok' && /עוד לא נמדדה/.test(r.empty.d), r.empty);
  check('password check hangs: a line names the step, the button is back, the try is saved', /בדיקת הסיסמה לא הסתיימה/.test(r.pw.err) && !r.pw.dis && r.pw.btn === 'כניסה' && r.pw.last && r.pw.last.res === 'err' && 'cf' in r.pw.last.s && !('pw' in r.pw.last.s), r.pw);
  check('the line stays on screen past 2.5 seconds', /בדיקת הסיסמה/.test(r.pwStays), r.pwStays);
  check('second-factor check hangs: says so (not "cancelled"), signs the half session out', /האימות הדו-שלבי לא הסתיימה/.test(r.aal.err) && !/בוטלה/.test(r.aal.err) && r.aal.signOuts >= 1 && !r.aal.dis, r.aal);
  check('while the code window is open the button says what it waits for', r.codeOpen === 'block' && /אימות דו-שלבי/.test(r.codeBtn), [r.codeOpen, r.codeBtn]);
  check('code check hangs: the code window says the server did not answer, the button works again', /השרת לא ענה/.test(r.codeErr) && r.codeOk === false, [r.codeErr, r.codeOk]);
  check('approval read hangs: a line names the step', /בדיקת ההרשאה לא הסתיימה/.test(r.user.err) && !r.user.dis && r.user.signOuts >= 1, r.user);
  check('a sign-in that goes through: Cloudflare, password and second factor timed, saved as ok', r.ok.last && r.ok.last.res === 'ok' && ['cf', 'pw', 'mfa'].every((k) => typeof r.ok.last.s[k] === 'number') && typeof r.ok.last.total === 'number', r.ok.last);
  check('the system screen shows the steps of the last sign-in', r.sysOk.s === 'ok' && /בדיקת הסיסמה/.test(r.sysOk.d) && /סה"כ/.test(r.sysOk.d), r.sysOk);
  check('a password step over 5 seconds is a warning with what to do', r.sysSlow.s === 'warn' && /9 ש'/.test(r.sysSlow.d) && r.sysSlow.a, r.sysSlow);
  check('only the last 10 sign-ins are kept', r.kept === 10, r.kept);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
