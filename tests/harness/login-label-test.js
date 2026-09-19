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
  check('login screen: the no-password button now reads 🦺 דיווח נאמני בטיחות (ללא סיסמה); "דיווח מהיר" is gone', /🦺 דיווח נאמני בטיחות \(ללא סיסמה\)/.test(l.txt) && l.vis && !l.quick, l);
  await page.screenshot({ path: OUT + '/login-375.png' });
  const m = await page.evaluate(() => { const lg = document.getElementById('login'); lg.style.display = 'none'; document.getElementById('app').style.display = 'block'; window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash'); const more = document.querySelector('.topbar [onclick*="_topMoreMenu"], .topbar [onclick*="MoreMenu"], #more-btn, [id*="more"]'); return { hasMore: !!more, id: more && more.id, oc: more && more.getAttribute('onclick') }; });
  const items = await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('.topbar button')).find(b => /⋯|…/.test(b.textContent)); if (!btn) return null; btn.click(); const its = Array.from(document.querySelectorAll('div[style*="z-index:9999"] button, div[style*="z-index: 9999"] button')).map(b => b.textContent.trim()); document.body.click(); return its; });
  check('header ⋯ menu: entry reads 🦺 דיווח נאמני בטיחות (no more "מצב עובד")', items && items.some(t => /דיווח נאמני בטיחות/.test(t)) && !items.some(t => /מצב עובד/.test(t)), items);
  const click = await page.evaluate(() => { const find = () => Array.from(document.querySelectorAll('div[style*="z-index:9999"] button, div[style*="z-index: 9999"] button')).find(b => /דיווח נאמני בטיחות/.test(b.textContent)); let it = find(); if (!it) { Array.from(document.querySelectorAll('.topbar button')).find(b => /⋯|…/.test(b.textContent)).click(); it = find(); } it.click(); return { emp: document.body.classList.contains('emp-mode'), only: document.getElementById('pg-emp-home').classList.contains('tru-only'), cur: CUR }; });
  check('choosing it enters the trustee screen', click.emp && click.only && click.cur === 'emp-home', click);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
