// P1#2 nav check: renders the REAL index.html in headless Chromium at phone
// width with the network blocked and verifies: bottom nav hidden on every
// page, only the report FAB floats, main padding shortened, ☰ opens the right
// sheet per role, brand tap goes home, sheet navigation still works.
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
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
  });

  console.log('\n1. layout on several pages');
  for (const p of ['dash', 'tasks', 'ncr']) {
    const r = await page.evaluate((p) => {
      goPage(p);
      const cs = (id) => { const el = document.getElementById(id); return el ? getComputedStyle(el) : null; };
      const b = cs('bnav'), a = cs('ask-fab'), c = cs('cap-fab'), m = getComputedStyle(document.getElementById('main'));
      return { cur: window.CUR, bnav: b && b.display, askFab: a && a.display, capFab: c && c.display, capBottom: c && c.bottom, mainPadBottom: m.paddingBottom, menuBtn: !!document.getElementById('menu-btn') && getComputedStyle(document.getElementById('menu-btn')).display !== 'none' };
    }, p);
    check(p + ': bottom nav hidden', r.bnav === 'none', r);
    check(p + ': chat FAB hidden, report FAB visible at bottom 24px', r.askFab === 'none' && r.capFab !== 'none' && r.capBottom === '24px', r);
    check(p + ': main padding-bottom 112px (was 170)', r.mainPadBottom === '112px', r);
    check(p + ': ☰ present in top bar', r.menuBtn === true, r);
  }
  await page.evaluate(() => goPage('tasks'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/nav-tasks-375.png' });

  console.log('\n2. ☰ per role');
  const asReporter = await page.evaluate(() => { window._currentUser = null; _menuOpen(); const rs = document.getElementById('m-reports-sheet'), ms = document.getElementById('m-modules-sheet'); const out = { reports: rs.style.display, modules: ms.style.display }; closeModal('m-reports-sheet'); return out; });
  check('reporter (no user): ☰ opens the reports sheet, not modules', asReporter.reports === 'block' && asReporter.modules !== 'block', asReporter);
  const asAdmin = await page.evaluate(() => { window._currentUser = { username: 'admin' }; _menuOpen(); const rs = document.getElementById('m-reports-sheet'), ms = document.getElementById('m-modules-sheet'); return { reports: rs.style.display, modules: ms.style.display, hasReportsEntry: !!Array.from(ms.querySelectorAll('.sheet-btn')).find(b => /דיווחים/.test(b.textContent)), modListHasReports: _modList().some(x => /דיווחים/.test(x.label)) }; });
  check('admin: ☰ opens the modules sheet', asAdmin.modules === 'block' && asAdmin.reports !== 'block', asAdmin);
  check('modules sheet has a "reports" entry that is NOT a prefs-module', asAdmin.hasReportsEntry === true && asAdmin.modListHasReports === false, asAdmin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/nav-menu-open-375.png' });

  console.log('\n3. navigation still works without the bottom nav');
  const nav = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#m-modules-sheet .sheet-btn')).find(b => /docs/.test(b.getAttribute('onclick') || ''));
    btn.click();
    const afterDocs = { cur: window.CUR, sheetClosed: document.getElementById('m-modules-sheet').style.display !== 'block' };
    document.querySelector('.topbar-left').click();
    return { afterDocs, afterBrand: window.CUR };
  });
  check('modules sheet → docs page, sheet closes', nav.afterDocs.cur === 'docs' && nav.afterDocs.sheetClosed, nav);
  check('tap on brand/logo → home', nav.afterBrand === 'dash', nav);
  const rep = await page.evaluate(() => { _currentUser = { username: 'admin' }; openModal('m-modules-sheet'); Array.from(document.querySelectorAll('#m-modules-sheet .sheet-btn')).find(b => /דיווחים/.test(b.textContent)).click(); const rs = document.getElementById('m-reports-sheet'); const out = { reports: rs.style.display, modules: document.getElementById('m-modules-sheet').style.display }; closeModal('m-reports-sheet'); return out; });
  check('modules sheet → "reports" entry switches to the reports sheet', rep.reports === 'block' && rep.modules !== 'block', rep);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
