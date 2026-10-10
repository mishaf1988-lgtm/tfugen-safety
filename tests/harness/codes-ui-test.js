// The codes dialog on the users page (10/10/2026, Michael: "פלטפורמה... לניהול הסיסמות"): lists the
// server codes hidden, shows one on a tap, changes one only after a confirm, and refuses a code
// that is not 4-12 digits before asking the server. The delete password is per device.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    const toasts = [], calls = [];
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    let confirmAns = false, promptAns = null;
    window.confirm = () => confirmAns; window.prompt = () => promptAns;
    window.fetch = (u, init) => { const b = JSON.parse(init.body); calls.push({ u, b, auth: init.headers.Authorization });
      const body = b.op === 'list' ? { codes: [{ key: 'induction_code', label: 'קוד משאבי אנוש (טופס קליטה)', set: true, value: '996322', source: 'app', updated_at: '2026-10-10T16:35:21Z' }, { key: 'trustee_code', label: 'קוד נאמני הבטיחות', set: true, value: null, source: 'cloudflare', updated_at: null }] }
        : { key: b.key, value: b.value || '424242', updated_at: '2026-10-10T18:00:00Z' };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })); };
    goPage('users');
    const o = { btn: !!document.getElementById('codes-btn') };
    openCodes(); await new Promise((res) => setTimeout(res, 50));
    const body = document.getElementById('codes-body');
    o.list = { auth: calls[0] && calls[0].auth, text: body.textContent, hidden: !body.textContent.includes('996322'), cf: body.textContent.includes('Cloudflare'), del: body.textContent.includes('סיסמת המחיקה') };
    _codeShow('induction_code'); o.shown = document.getElementById('code-v-induction_code').textContent;
    _codeShow('induction_code'); o.hiddenAgain = document.getElementById('code-v-induction_code').textContent;
    let n = calls.length; confirmAns = false; _codeSet('trustee_code', 0); await new Promise((res) => setTimeout(res, 30));
    o.noConfirm = calls.length - n;
    n = calls.length; promptAns = '12a4'; _codeSet('trustee_code', 1); await new Promise((res) => setTimeout(res, 30));
    o.badOwn = { calls: calls.length - n, toast: toasts.slice(-1)[0] };
    confirmAns = true; promptAns = '135790'; _codeSet('trustee_code', 1); await new Promise((res) => setTimeout(res, 50));
    o.own = { b: calls.slice(-1)[0].b, text: document.getElementById('code-v-trustee_code') && document.getElementById('code-v-trustee_code').textContent, appNow: body.textContent.includes('מוגדר באפליקציה'), toast: toasts.slice(-1)[0] };
    _codeSet('induction_code', 0); await new Promise((res) => setTimeout(res, 50));
    o.rand = { b: calls.slice(-1)[0].b, text: document.getElementById('code-v-induction_code').textContent };
    _currentUser = { username: 'x', role: 'מנהל' }; n = calls.length; openCodes(); o.mgr = { calls: calls.length - n, toast: toasts.slice(-1)[0] };
    return o;
  });
  check('the codes button on the users page', r.btn);
  check('the list: asked with the login, the HR code hidden, the trustee one "in Cloudflare", the delete password', r.list.auth === 'Bearer tok' && r.list.hidden && r.list.cf && r.list.del, r.list);
  check('"show" shows it, a second tap hides it', r.shown === '996322' && r.hiddenAgain !== '996322', [r.shown, r.hiddenAgain]);
  check('no confirm: nothing sent', r.noConfirm === 0);
  check('my code not 4-12 digits: refused before the server', r.badOwn.calls === 0 && /4 עד 12/.test(r.badOwn.toast), r.badOwn);
  check('my code: sent, shown, now "set in the app"', r.own.b.op === 'set' && r.own.b.key === 'trustee_code' && r.own.b.value === '135790' && r.own.text === '135790' && r.own.appNow && /הוחלף/.test(r.own.toast), r.own);
  check('random: no value sent, the server\'s code shown', r.rand.b.op === 'set' && r.rand.b.value === undefined && r.rand.text === '424242', r.rand);
  check('not an admin: the dialog does not open', r.mgr.calls === 0 && /רק אדמין/.test(r.mgr.toast), r.mgr);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
