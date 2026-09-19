// Renders the REAL index.html in headless Chromium at phone width, seeds DB
// scenarios, calls rDash(), and asserts the P1#1 home-declutter behaviour.
// External network is blocked (Supabase / CDNs), so the app runs on local
// state only — exactly the "offline cache" path.
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

async function renderHome(page, seed) {
  return page.evaluate((seed) => {
    const out = {};
    try {
      // Bypass the login overlay purely for rendering; no auth involved.
      const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
      // #app is display:none until login; reveal it and let .main grow so a
      // full-page screenshot shows the whole home (test-only styling).
      const app = document.getElementById('app'); if (app) app.style.display = 'block';
      const mn = document.getElementById('main'); if (mn) { mn.style.height = 'auto'; mn.style.overflow = 'visible'; }
      const emp = document.getElementById('emp-home'); if (emp) emp.classList.remove('on');
      // Seed the in-memory DB.
      Object.keys(seed).forEach(k => { DB[k] = seed[k]; });
      ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
      window.CUR = 'dash';
      goPage('dash');
      rDash();
      if (typeof _applyRoleGates === 'function') { try { _applyRoleGates(); } catch (e) { out.roleGateErr = String(e); } }
      const vis = (id) => { const el = document.getElementById(id); if (!el) return null; return getComputedStyle(el).display !== 'none'; };
      out.kpiTiles = Array.from(document.querySelectorAll('#dash-kpis .kpi')).map(el => ({ label: el.querySelector('.kpi-label').textContent, val: el.querySelector('.kpi-val').textContent }));
      out.kpisVisible = vis('dash-kpis');
      out.kpiAccVisible = vis('dash-kpi-acc');
      out.qa = Array.from(document.querySelectorAll('#dash-qa .qa-btn')).map(b => ({ text: b.textContent.trim().replace(/\s+/g, ' '), visible: getComputedStyle(b).display !== 'none' }));
      out.cards = {};
      ['dash-weekly-card','dash-month-card','dash-totals-card','dash-auds-card','dash-rounds-card','dash-stats-title','dash-recent-card','dash-exp-card','dash-critical-card','dash-itp-card'].forEach(id => { out.cards[id] = vis(id); });
      out.roundReminder = !!document.getElementById('dash-round-reminder');
      out.onDash = document.body.classList.contains('on-dash');
      out.askFabVisible = vis('ask-fab');
      out.aiCardsInAgents = !!document.querySelector('#pg-agents #dash-ai-weekly-card') && !!document.querySelector('#pg-agents #dash-ai-today-card');
      out.aiCardsInDash = !!document.querySelector('#pg-dash #dash-ai-weekly-card');
      out.oldStrip = !!document.querySelector('#pg-dash .monthly-strip') || !!document.getElementById('k1');
      out.dashHeight = document.getElementById('pg-dash').scrollHeight;
      out.todayCount = (document.getElementById('today-count') || {}).textContent;
      out.errors = window.__errs || [];
    } catch (e) { out.fatal = String(e && e.stack || e); }
    return out;
  }, seed);
}

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  // Block every network request — the file must render on its own.
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith('file://')) route.continue(); else route.abort(); });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ---------- Scenario A: empty operational data (post-reset reality) ----------
  console.log('\nA. empty ops data (what production looks like right now)');
  const A = await renderHome(page, { ncr: [], inc: [], tasks: [], rsk: [], ptw: [], docs: [], tr: [], emp: [], near_miss: [], rounds: [], auds: [], equip_inspections: [], ppe: [], ctr: [] });
  check('no fatal error in render', !A.fatal, A.fatal);
  check('0 KPI tiles and strip hidden', A.kpiTiles.length === 0 && A.kpisVisible === false, A.kpiTiles);
  check('leading-indicators accordion hidden', A.kpiAccVisible === false);
  check('6 quick actions rendered', A.qa.length === 6, A.qa);
  check('mandatory three are first: emergency / today tasks / morning round',
    /חירום/.test(A.qa[0].text) && /משימות/.test(A.qa[1].text) && /סבב/.test(A.qa[2].text), A.qa.map(q => q.text));
  check('weekly / month / totals / audits / rounds cards hidden',
    A.cards['dash-weekly-card'] === false && A.cards['dash-month-card'] === false && A.cards['dash-totals-card'] === false && A.cards['dash-auds-card'] === false && A.cards['dash-rounds-card'] === false, A.cards);
  check('stats section title hidden', A.cards['dash-stats-title'] === false);
  check('no round-reminder banner (Today list owns it)', A.roundReminder === false);
  check('body.on-dash set and floating AI button hidden', A.onDash === true && A.askFabVisible === false, { onDash: A.onDash, fab: A.askFabVisible });
  check('AI cards live in agents page, not in dash', A.aiCardsInAgents === true && A.aiCardsInDash === false);
  check('old monthly strip / k1..k8 gone', A.oldStrip === false);
  await page.screenshot({ path: OUT + '/home-A-empty.png', fullPage: true });
  console.log('  dash height (px, full page):', A.dashHeight);

  // ---------- Scenario B: busy plant — verify cap of 6 and ordering ----------
  console.log('\nB. busy data — cap 6, urgent first, empty-hiding stays correct');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().split('T')[0];
  const ago = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };
  const ahead = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  const B = await renderHome(page, {
    ncr: [{ id: 'n1', num: 'NCR-0001', s: 'פתוח', p: 'קריטי', d: 'x', ts: ago(2) }, { id: 'n2', num: 'NCR-0002', s: 'פתוח', p: 'גבוה', d: 'y', ts: ago(3) }, { id: 'n3', num: 'NCR-0003', s: 'בטיפול', p: 'בינוני', d: 'z', ts: ago(4) }],
    tasks: [{ id: 't1', title: 'late 1', status: 'פתוח', due: ago(5), ts: ago(9) }, { id: 't2', title: 'late 2', status: 'פתוח', due: ago(1), ts: ago(3) }],
    equip_inspections: [{ id: 'e1', n: 'מלגזה', code: 'FL-1', e: ago(10) }, { id: 'e2', n: 'אוטוקלאב', code: 'AC-1', e: ahead(200) }],
    rsk: [{ id: 'r1', d: 'סיכון', p: 4, sv: 4 }],
    inc: [{ id: 'i1', d: 'תקרית', dt: ago(20) + 'T08:00', sv: 'קל' }, { id: 'i2', d: 'תקרית 2', dt: ago(40) + 'T08:00', sv: 'קל' }],
    near_miss: [{ id: 'm1', descr: 'כמעט', d: iso(today), s: 'פתוח' }],
    ptw: [{ id: 'p1', s: 'פתוח' }],
    docs: [{ id: 'd1', n: 'נוהל', s: 'בתוקף', e: ahead(100) }],
    emp: [{ id: 'w1', n: 'עובד' }],
    tr: [], rounds: [], auds: [{ id: 'a1', n: 'ביקורת', d: ago(3), s: 'הושלם' }], ppe: [], ctr: [],
  });
  check('no fatal error in render', !B.fatal, B.fatal);
  check('exactly 6 KPI tiles (cap)', B.kpiTiles.length === 6, B.kpiTiles);
  // overdue = 2 manual tasks + 1 virtual task from the expired forklift (e1) = 3
  check('ordered urgent-first: NCR, overdue tasks (incl. virtual), expired, critical risks, incidents, near-miss',
    B.kpiTiles.map(t => t.val).join(',') === '3,3,1,1,2,1', B.kpiTiles);
  check('lower-priority PTW / docs / employees dropped by the cap',
    !B.kpiTiles.some(t => /PTW|הרשאות|מסמכים|עובדים/.test(t.label)), B.kpiTiles.map(t => t.label));
  check('leading-indicators accordion visible (equipment data exists)', B.kpiAccVisible === true);
  check('weekly / month / totals / audits cards visible now', B.cards['dash-weekly-card'] === true && B.cards['dash-month-card'] === true && B.cards['dash-totals-card'] === true && B.cards['dash-auds-card'] === true, B.cards);
  check('rounds card still hidden (rounds never used)', B.cards['dash-rounds-card'] === false);
  check('stats section title visible (critical-NCR card has rows)', B.cards['dash-stats-title'] === true && B.cards['dash-critical-card'] === true, B.cards);
  await page.screenshot({ path: OUT + '/home-B-busy.png', fullPage: true });
  console.log('  dash height (px, full page):', B.dashHeight);

  // ---------- Regression: leaving the dash restores the floating button ----------
  console.log('\nC. navigation regression');
  const C = await page.evaluate(() => { goPage('tasks'); const fab = document.getElementById('ask-fab'); return { onDash: document.body.classList.contains('on-dash'), fabVisible: fab ? getComputedStyle(fab).display !== 'none' : null, cur: window.CUR }; });
  // P1#2 (2026-09-18): the chat FAB is hidden on every page now (header ⋯ menu instead).
  check('off the dash: on-dash removed; chat FAB stays hidden everywhere (P1#2)', C.onDash === false && C.fabVisible === false, C);
  const C2 = await page.evaluate(() => { goPage('dash'); return document.body.classList.contains('on-dash'); });
  check('back on dash: on-dash set again', C2 === true);

  const realErrs = errs.filter(e => !/net::ERR_FAILED|Failed to load resource|supabase|web-vitals|ERR_BLOCKED/i.test(e));
  check('no unexpected page errors (network-blocked ones ignored)', realErrs.length === 0, realErrs.slice(0, 5));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
