// C1 check: print media hides the chrome added this round, keeps the data,
// and the header ⋯ "print this page" path inserts a title header and calls
// window.print exactly once; record PDFs still go through printReport.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().split('T')[0];
  await page.evaluate((today) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', s: 'פתוח', p: 'קריטי', d: 'x', ts: today }];
    DB.equip_inspections = [{ id: 'e1', n: 'מלגזה', code: 'FL-1', e: '2026-01-01' }];
    DB.inc = [{ id: 'i1', d: 'תקרית', dt: today + 'T08:00', sv: 'קל' }];
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates();
    window.__prints = 0; window.print = function () { window.__prints++; };
  }, iso(today));
  const disp = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'missing'; }, sel);
  const cc = () => page.evaluate(() => getComputedStyle(document.getElementById('pg-dash')).columnCount);

  console.log('\n1. screen vs print on the home page');
  await page.evaluate(() => { goPage('dash'); rDash(); });
  const screenQa = await disp('.dash-qa'), screenFab = await disp('#cap-fab'), screenCc = await cc();
  check('screen: quick actions + report FAB visible, home in 2 columns at 1200px', screenQa !== 'none' && screenFab !== 'none' && screenCc === '2', { screenQa, screenFab, screenCc });
  await page.emulateMedia({ media: 'print' });
  const p = { qa: await disp('.dash-qa'), fab: await disp('#cap-fab'), menu: await disp('#menu-btn'), topbar: await disp('.topbar'), bnav: await disp('#bnav'), cc: await cc(), kpis: await disp('#dash-kpis'), today: await disp('.today-list') };
  check('print: quick actions, FAB, ☰, top bar, bottom nav hidden', p.qa === 'none' && p.fab === 'none' && p.menu === 'none' && p.topbar === 'none' && p.bnav === 'none', p);
  check('print: single column; KPI strip and Today list still print', p.cc === '1' && p.kpis !== 'none' && p.today !== 'none', p);

  console.log('\n1b. floaters (QA after #556): SW update pill, scroll-top, NCR agent overlay, any inline-fixed element');
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => {
    // the same pill the service-worker handler creates
    if (!document.getElementById('sw-update-pill')) { const pill = document.createElement('div'); pill.id = 'sw-update-pill'; pill.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:24px;z-index:9999;display:flex'; pill.textContent = 'עדכון זמין'; document.body.appendChild(pill); }
    const st = document.getElementById('scroll-top-btn'); if (st) st.style.display = 'block';
    const anyFixed = document.createElement('div'); anyFixed.id = 'test-any-fixed'; anyFixed.setAttribute('style', 'position: fixed; top: 10px; left: 10px; background: red'); anyFixed.textContent = 'x'; document.body.appendChild(anyFixed);
    openNCRAgent();
  });
  const fs = { pill: await disp('#sw-update-pill'), st: await disp('#scroll-top-btn'), any: await disp('#test-any-fixed'), agent: await disp('#ncr-agent-modal') };
  check('screen: update pill, scroll-top, inline-fixed element and the NCR agent overlay are visible', fs.pill !== 'none' && fs.st !== 'none' && fs.any !== 'none' && fs.agent !== 'none', fs);
  await page.emulateMedia({ media: 'print' });
  const fp = { pill: await disp('#sw-update-pill'), st: await disp('#scroll-top-btn'), any: await disp('#test-any-fixed'), agent: await disp('#ncr-agent-modal'), fab: await disp('#cap-fab'), ask: await disp('#ask-fab'), page: await disp('.page.on') };
  check('print: all of them hidden (incl. the generic inline-fixed net); the page content still prints', fp.pill === 'none' && fp.st === 'none' && fp.any === 'none' && fp.agent === 'none' && fp.fab === 'none' && fp.ask === 'none' && fp.page !== 'none', fp);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { document.getElementById('ncr-agent-modal').style.display = 'none'; document.getElementById('test-any-fixed').remove(); });

  console.log('\n1c. structural net (v2): nothing at body level except #app, nothing in #app except #main');
  await page.emulateMedia({ media: 'print' });
  const sn = await page.evaluate(() => {
    const vis = (el) => getComputedStyle(el).display !== 'none';
    const bodyLeak = Array.from(document.body.children).filter(el => el.id !== 'app' && el.tagName !== 'SCRIPT' && vis(el)).map(el => el.tagName + '#' + el.id + '.' + el.className);
    const appLeak = Array.from(document.getElementById('app').children).filter(el => el.id !== 'main' && vis(el)).map(el => el.tagName + '#' + el.id + '.' + el.className);
    return { bodyLeak, appLeak, main: vis(document.getElementById('main')), page: vis(document.querySelector('.page.on')) };
  });
  check('print: zero visible body-level elements besides #app, zero in #app besides #main; the active page prints', sn.bodyLeak.length === 0 && sn.appLeak.length === 0 && sn.main && sn.page, sn);
  await page.emulateMedia({ media: 'screen' });

  console.log('\n2. print with a modal open, and the EQI page');
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { _invOpen('i1'); });
  await page.emulateMedia({ media: 'print' });
  const m = { modal: await disp('#m-inv'), overlay: await disp('#ov-inv') };
  check('an open modal and its overlay do not print', m.modal === 'none' && m.overlay === 'none', m);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => { closeModal('m-inv'); goPage('eqi'); rEqi(); });
  await page.emulateMedia({ media: 'print' });
  const e = await page.evaluate(() => { const pills = Array.from(document.querySelectorAll('#eqi-summary button')).map(b => ({ t: b.textContent.trim(), d: getComputedStyle(b).display })); const more = getComputedStyle(document.getElementById('eqi-more-btn')).display; return { pills, more }; });
  check('EQI: summary pills print (counts), export button and ⋯ do not', e.pills.filter(x => /ייצוא/.test(x.t)).every(x => x.d === 'none') && e.pills.filter(x => !/ייצוא/.test(x.t)).every(x => x.d !== 'none') && e.more === 'none', e);
  await page.emulateMedia({ media: 'screen' });

  console.log('\n3. header ⋯ → print this page');
  const pp = await page.evaluate(() => new Promise((res) => { goPage('ncr'); rNcr(); _printPage(); setTimeout(() => { const h = document.getElementById('print-header'); const out = { prints: window.__prints, header: h ? h.textContent.replace(/\s+/g, ' ').trim() : null, first: h && h.parentElement.firstChild === h }; window.dispatchEvent(new Event('afterprint')); setTimeout(() => { out.removed = !document.getElementById('print-header'); res(out); }, 50); }, 200); }));
  check('window.print called once, header injected at the top with the page title, user and date', pp.prints === 1 && pp.first && /אי התאמות|NCR|אי-התאמ/.test(pp.header) && /מיכאל/.test(pp.header) && /20\d\d/.test(pp.header), pp);
  check('header removed after printing', pp.removed === true, pp);
  check('header carries the build stamp so QA can tell which build printed', /2026-09-18\.v2/.test(pp.header), pp.header);

  console.log('\n4. record PDF path still there');
  const rec = await page.evaluate(() => { let opened = 0; const o = window.open; window.open = function () { opened++; return { document: { open() {}, write() {}, close() {} }, focus() {}, print() {} }; }; try { printReport('ncr', 'n1'); } catch (e) { return { err: String(e) }; } window.open = o; return { opened, viewPdfBtn: !!document.getElementById('view-pdf'), tables: Object.keys(VIEW_CONFIG).length }; });
  check('printReport("ncr", id) renders into its own window; view page keeps its PDF button; 23 record types covered', rec.opened >= 1 && rec.viewPdfBtn && rec.tables === 23, rec);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
