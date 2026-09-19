// A2 check: the equipment page header is two buttons; ⋯ opens a menu whose
// entries call the original functions; the summary strip is near the top.
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
    window._currentUser = { username: 'admin' };
    // Spy on every action the menu is supposed to reach.
    window.__calls = {};
    ['_eqiPdfPick','openEqiXl','openEqiXl2','_eqiPrintAll','_eqiExportCsv','_eqiPrintQrSheet','_eqiAutoTasksRun','delAllEqi','_eqiOpenNew'].forEach(n => { window[n] = function () { window.__calls[n] = (window.__calls[n] || 0) + 1; }; });
    goPage('eqi');
  });

  console.log('\n1. header');
  const h = await page.evaluate(() => {
    const row = document.querySelector('#pg-eqi .row');
    const btns = Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim());
    const title = document.querySelector('#pg-eqi .page-title');
    const strip = document.getElementById('eqi-summary');
    return { btns, stripTop: strip.getBoundingClientRect().top - title.getBoundingClientRect().top, hasMore: !!document.getElementById('eqi-more-btn') };
  });
  check('title row has exactly 2 buttons: ⋯ more + add', h.btns.length === 2 && /עוד/.test(h.btns[0]) && /הוסף/.test(h.btns[1]), h.btns);
  check('summary strip within ~420px of the title (was pushed below 9 buttons)', h.stripTop < 420, h.stripTop);

  console.log('\n2. menu');
  await page.click('#eqi-more-btn');
  await page.waitForTimeout(120);
  const m = await page.evaluate(() => {
    const menu = document.getElementById('eqi-more-menu');
    if (!menu) return null;
    const items = Array.from(menu.querySelectorAll('button')).map(b => ({ text: b.textContent.trim(), red: b.style.color !== 'rgb(34, 34, 34)' }));
    const seps = menu.querySelectorAll('div').length;
    const r = menu.getBoundingClientRect();
    return { items, seps, inViewport: r.left >= 0 && r.right <= 375 };
  });
  check('menu opens with 8 actions, 3 separators, fits the 375px viewport', m && m.items.length === 8 && m.seps === 3 && m.inViewport, m);
  check('delete-all is last and red', m && /מחק הכל/.test(m.items[7].text) && m.items[7].red, m && m.items[7]);
  check('order: PDF AI, Excel, full import, print, CSV, QR, tasks, delete', m && ['PDF', 'Excel', 'מאגר', 'הדפס', 'CSV', 'QR', 'משימות', 'מחק'].every((w, i) => m.items[i].text.includes(w)), m && m.items.map(i => i.text));
  // click each item in turn (menu closes after each click, so reopen)
  const expected = ['_eqiPdfPick', 'openEqiXl', 'openEqiXl2', '_eqiPrintAll', '_eqiExportCsv', '_eqiPrintQrSheet', '_eqiAutoTasksRun', 'delAllEqi'];
  for (let i = 0; i < expected.length; i++) {
    if (!(await page.$('#eqi-more-menu'))) { await page.click('#eqi-more-btn'); await page.waitForTimeout(80); }
    await page.evaluate((i) => document.querySelectorAll('#eqi-more-menu button')[i].click(), i);
    await page.waitForTimeout(40);
  }
  const calls = await page.evaluate(() => ({ calls: window.__calls, menuStillOpen: !!document.getElementById('eqi-more-menu') }));
  check('each item calls its original function exactly once and closes the menu', expected.every(n => calls.calls[n] === 1) && !calls.menuStillOpen, calls);
  await page.click('#eqi-more-btn'); await page.waitForTimeout(80);
  await page.keyboard.press('Escape'); await page.waitForTimeout(80);
  check('Escape closes the menu', !(await page.$('#eqi-more-menu')));
  await page.click('#eqi-more-btn'); await page.waitForTimeout(80);
  await page.mouse.click(30, 700); await page.waitForTimeout(80);
  check('click outside closes the menu', !(await page.$('#eqi-more-menu')));
  await page.evaluate(() => document.querySelector('#pg-eqi .row .btn-p').click());
  check('"+ add" still opens the new-equipment flow', (await page.evaluate(() => window.__calls._eqiOpenNew)) === 1);
  await page.click('#eqi-more-btn'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/eqi-header-menu-375.png' });

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
