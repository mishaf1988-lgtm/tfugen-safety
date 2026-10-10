// The passwords card on the users page (10/10/2026, Michael: "פלטפורמה... לניהול הסיסמות", "ממשקי
// השינוי סיסמה צריכים לשבת במקום אחד עם המשתמשים", "סיסמה, לא קוד במספרים"): loads with the page,
// the server passwords hidden until a tap, a change only after a confirm, a password that is not 8+
// letters and digits refused before asking the server, the delete dialog's hint leads here.
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
    window.fetch = (u, init) => { if (String(u) !== '/api/codes') return Promise.resolve(new Response('[]', { status: 200 })); const b = JSON.parse(init.body); calls.push({ u, b, auth: init.headers.Authorization });
      const body = b.op === 'list' ? { codes: [{ key: 'induction_code', label: 'קוד משאבי אנוש (טופס קליטה)', set: true, value: '996322', source: 'app', updated_at: '2026-10-10T16:35:21Z' }, { key: 'trustee_code', label: 'קוד נאמני הבטיחות', set: true, value: null, source: 'cloudflare', updated_at: null }], recent: [{ ts: '2026-10-10T17:05:00Z', who: 'admin', key: 'trustee_code', label: 'קוד נאמני הבטיחות' }] }
        : { key: b.key, value: (b.value || 'k7m3x9p2qa').toLowerCase(), updated_at: '2026-10-10T18:00:00Z' };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })); };
    goPage('users');
    await new Promise((res) => setTimeout(res, 80));
    const card = document.getElementById('codes-card');
    const o = { btn: !!card && getComputedStyle(card).display !== 'none' && card.closest('#pg-users') !== null && !document.getElementById('m-codes') && !document.getElementById('codes-btn') };
    const body = document.getElementById('codes-body');
    o.list = { auth: calls[0] && calls[0].auth, text: body.textContent, hidden: !body.textContent.includes('996322'), cf: body.textContent.includes('Cloudflare'), del: body.textContent.includes('סיסמת המחיקה') };
    o.recent = body.textContent;
    _codeShow('induction_code'); o.shown = document.getElementById('code-v-induction_code').textContent;
    _codeShow('induction_code'); o.hiddenAgain = document.getElementById('code-v-induction_code').textContent;
    let n = calls.length; confirmAns = false; _codeSet('trustee_code', 0); await new Promise((res) => setTimeout(res, 30));
    o.noConfirm = calls.length - n;
    n = calls.length; promptAns = 'abcdefgh'; _codeSet('trustee_code', 1); await new Promise((res) => setTimeout(res, 30));
    o.badOwn = { calls: calls.length - n, toast: toasts.slice(-1)[0] };
    confirmAns = true; promptAns = 'Tapugan2026'; _codeSet('trustee_code', 1); await new Promise((res) => setTimeout(res, 50));
    o.own = { b: calls.slice(-1)[0].b, text: document.getElementById('code-v-trustee_code') && document.getElementById('code-v-trustee_code').textContent, appNow: body.textContent.includes('מוגדרת באפליקציה'), toast: toasts.slice(-1)[0] };
    _codeSet('induction_code', 0); await new Promise((res) => setTimeout(res, 50));
    o.rand = { b: calls.slice(-1)[0].b, text: document.getElementById('code-v-induction_code').textContent };
    // the delete dialog's hint: the admin goes to the users page
    goPage('dash'); window.cancelDel = window.cancelDel || function () {}; _delPwFromHint(); await new Promise((res) => setTimeout(res, 200));
    o.hint = document.getElementById('pg-users').classList.contains('active') || getComputedStyle(document.getElementById('pg-users')).display !== 'none';
    _currentUser = { username: 'x', role: 'מנהל' }; n = calls.length; openCodes(); o.mgr = { calls: calls.length - n, toast: toasts.slice(-1)[0] };
    _codesLoad(true); o.mgrCard = getComputedStyle(document.getElementById('codes-card')).display;
    return o;
  });
  check('the passwords card is part of the users page (no button, no dialog)', r.btn);
  check('the list: asked with the login, the HR code hidden, the trustee one "in Cloudflare", the delete password', r.list.auth === 'Bearer tok' && r.list.hidden && r.list.cf && r.list.del, r.list);
  check('the last changes at the bottom, in Israel time (17:05Z = 20:05)', /החלפות אחרונות/.test(r.recent) && /10\/10\/2026 20:05 \| קוד נאמני הבטיחות \| admin/.test(r.recent), r.recent);
  check('"show" shows it, a second tap hides it', r.shown === '996322' && r.hiddenAgain !== '996322', [r.shown, r.hiddenAgain]);
  check('no confirm: nothing sent', r.noConfirm === 0);
  check('a password without a digit: refused before the server', r.badOwn.calls === 0 && /8 תווים לפחות/.test(r.badOwn.toast), r.badOwn);
  check('my code: sent, shown, now "set in the app"', r.own.b.op === 'set' && r.own.b.key === 'trustee_code' && r.own.b.value === 'Tapugan2026' && r.own.text === 'tapugan2026' && r.own.appNow && /הוחלפה/.test(r.own.toast), r.own);
  check('random: no value sent, the server\'s code shown', r.rand.b.op === 'set' && r.rand.b.value === undefined && r.rand.text === 'k7m3x9p2qa', r.rand);
  check('the delete dialog\'s hint leads the admin to the users page', r.hint);
  check('not an admin: nothing asked, the card hidden', r.mgr.calls === 0 && /רק אדמין/.test(r.mgr.toast) && r.mgrCard === 'none', r);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
