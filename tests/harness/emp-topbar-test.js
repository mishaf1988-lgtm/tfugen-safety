// Trustee (employee) mode top bar: no action icons, the logo alone, bigger; the
// manager's top bar unchanged.
const path = require('path'); const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
const LOGO = fs.readFileSync(require('path').resolve(__dirname, '../../logo.jpg'));
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); if (/\/logo\.jpg$/.test(u)) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: LOGO }); return u.startsWith('file://') ? r.continue() : r.abort(); });
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(800);
  const vis = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return 'missing'; const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 ? 'visible' : 'hidden'; }, sel);
  await page.evaluate(() => { localStorage.removeItem('tfgn_trustee_name'); window.sbGet = () => Promise.resolve(null); doEmpLogin(); });
  await page.waitForTimeout(300);
  const e = { actions: await vis('.topbar-actions'), menu: await vis('#menu-btn'), home: await vis('#home-btn'), notif: await vis('#notif-btn'), tasks: await vis('#my-tasks-btn'), more: await vis('#more-menu-btn'), logo: await page.evaluate(() => { const r = document.querySelector('.topbar-left img').getBoundingClientRect(); return { h: Math.round(r.height), cx: Math.round(r.left + r.width / 2) }; }) };
  check('trustee mode: menu / home / notifications / my-tasks / ⋯ are all gone', e.actions !== 'visible' && e.menu !== 'visible' && e.home !== 'visible' && e.notif !== 'visible' && e.tasks !== 'visible' && e.more !== 'visible', e);
  check('trustee mode: the logo is 54px tall and centred', e.logo.h === 54 && Math.abs(e.logo.cx - 187) < 12, e.logo);
  const click = await page.evaluate(() => { window.scrollTo(0, 400); const before = CUR; document.querySelector('.topbar-left').click(); return { before, after: CUR, y: window.scrollY }; });
  check('tapping the logo in trustee mode just scrolls to the top, does not navigate', click.before === 'emp-home' && click.after === 'emp-home' && click.y === 0, click);
  await page.screenshot({ path: OUT + '/emp-topbar-375.png', clip: { x: 0, y: 0, width: 375, height: 140 } });
  await page.evaluate(() => { document.body.classList.remove('emp-mode'); localStorage.removeItem('tfgn_emp_mode'); window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash'); });
  await page.waitForTimeout(200);
  const m = { actions: await vis('.topbar-actions'), menu: await vis('#menu-btn'), home: await vis('#home-btn'), search: await vis('#gsearch-btn'), more: await vis('#more-menu-btn'), logoH: await page.evaluate(() => Math.round(document.querySelector('.topbar-left img').getBoundingClientRect().height)), nav: await page.evaluate(() => { goPage('tasks'); document.querySelector('.topbar-left').click(); return CUR; }) };
  // 🔍 moved into the ☰ sheet in favour of 🏠 (Michael's call) — home-button-test covers both.
  check('manager: actions back with 🏠 in place of 🔍, logo 48px, tapping the logo goes home', m.actions === 'visible' && m.menu === 'visible' && m.home === 'visible' && m.search === 'missing' && m.more === 'visible' && m.logoH === 48 && m.nav === 'dash', m);
  await browser.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
