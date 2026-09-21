const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(800);
  const l = await page.evaluate(() => { const b = document.getElementById('login-emp-btn'); return { txt: b.textContent.replace(/\s+/g, ' ').trim(), vis: getComputedStyle(b).display !== 'none', quick: /דיווח מהיר/.test(document.getElementById('login').textContent) }; });
  // Until 2026-09-21 the label promised «(ללא סיסמה)». There is a shared code
  // in front of the trustee screen now, so the promise came off the button.
  check('login screen: the trustee button reads 🦺 דיווח נאמני בטיחות, with no "no password" promise; "דיווח מהיר" is gone',
    /🦺 דיווח נאמני בטיחות/.test(l.txt) && !/ללא סיסמה/.test(l.txt) && l.vis && !l.quick, l);
  await page.screenshot({ path: OUT + '/login-375.png' });
  // Michael, 2026-09-21, looking at the login screen: «תעיף את הטקסט של
  // ה-user1, תשאיר רק את שם המשתמש, זה נראה יותר מקצועי». And the recovery
  // screen offered a person's first name as the example.
  console.log('\nplaceholders: no worked examples, no names');
  {
    const ph = await page.evaluate(() => ({
      uname: (document.getElementById('uname') || {}).placeholder || '',
      fp: (document.getElementById('fp-username') || {}).placeholder || '',
      all: [...document.querySelectorAll('input[placeholder]')]
        .map((i) => ({ id: i.id, p: i.placeholder }))
        .filter((x) => /yossi|user1/i.test(x.p)),
    }));
    check('the login box asks for a username and stops there', ph.uname === 'שם משתמש', ph.uname);
    // The recovery field takes a USERNAME: it is lowercased, sent to the admin
    // on WhatsApp, and _resolveEmail turns it into username@tfugen.local.
    // Writing "email" there would have people typing an address that goes
    // nowhere, so the neutral English word is the accurate one.
    check('recovery says what the field is, in English, with nobody named', ph.fp === 'username', ph.fp);
    check('and no worked example is left anywhere (' + ph.all.length + ')', ph.all.length === 0, ph.all);
  }

  const m = await page.evaluate(() => { const lg = document.getElementById('login'); lg.style.display = 'none'; document.getElementById('app').style.display = 'block'; window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash'); const more = document.querySelector('.topbar [onclick*="_topMoreMenu"], .topbar [onclick*="MoreMenu"], #more-btn, [id*="more"]'); return { hasMore: !!more, id: more && more.id, oc: more && more.getAttribute('onclick') }; });
  const items = await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('.topbar button')).find(b => /⋯|…/.test(b.textContent)); if (!btn) return null; btn.click(); const its = Array.from(document.querySelectorAll('div[style*="z-index:9999"] button, div[style*="z-index: 9999"] button')).map(b => b.textContent.trim()); document.body.click(); return its; });
  check('header ⋯ menu: entry reads 🦺 דיווח נאמני בטיחות (no more "מצב עובד")', items && items.some(t => /דיווח נאמני בטיחות/.test(t)) && !items.some(t => /מצב עובד/.test(t)), items);
  const click = await page.evaluate(() => { const find = () => Array.from(document.querySelectorAll('div[style*="z-index:9999"] button, div[style*="z-index: 9999"] button')).find(b => /דיווח נאמני בטיחות/.test(b.textContent)); let it = find(); if (!it) { Array.from(document.querySelectorAll('.topbar button')).find(b => /⋯|…/.test(b.textContent)).click(); it = find(); } it.click(); return { emp: document.body.classList.contains('emp-mode'), only: document.getElementById('pg-emp-home').classList.contains('tru-only'), cur: CUR }; });
  check('choosing it enters the trustee screen', click.emp && click.only && click.cur === 'emp-home', click);
  await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
