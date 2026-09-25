// Visual check of BACKLOG 2.8 / 2.10 / 2.11 / 2.12 / 6.6 on the real index.html,
// Chromium headless 390x844, network blocked, manager role, seeded data.
const path = require('path');
const pw = require('playwright');
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const fs = require('fs'); const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'tfgn-shots'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  OK  ' + l); } else { fail++; console.log('  FAIL ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // Enter as manager, seed 12 notification rows (like the live log) and an empty NCR table (like live).
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'mgr', role: 'מנהל' }; _applyRoleGates();
    try { localStorage.removeItem('tfgn_notif_seen_ts'); localStorage.removeItem('tfgn_dash_stats_open'); } catch (e) {}
    DB.ncr = [];
    DB.notifications_log = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.now() - i * 3600e3 * 5);
      DB.notifications_log.push({ id: 'n' + i, ts: d.toISOString(), event: 'trustee_hazard', channel: i % 2 ? 'whatsapp' : 'email', status: 'sent', to: '9725XXXXXXXX', title: 'דיווח בטיחות חדש ' + i });
    }
    rDash();
    _notifBadge();
  });
  await page.waitForTimeout(300);

  // ---- 2.8 bell + unread badge
  const bell = await page.evaluate(() => { const b = document.getElementById('notif-badge'); const btn = document.getElementById('notif-btn'); return { display: b.style.display, text: b.textContent, title: btn.title, onclick: btn.getAttribute('onclick') }; });
  check('2.8 badge on the bell shows unread count', bell.display !== 'none' && bell.text === '12', bell);
  check('2.8 bell opens the notification center, not settings', /openNotifCenter/.test(bell.onclick), bell);
  await page.screenshot({ path: OUT + '/1-topbar-badge.png', clip: { x: 0, y: 0, width: 390, height: 120 } });
  await page.click('#notif-btn');
  await page.waitForTimeout(400);
  const nc = await page.evaluate(() => { const m = document.getElementById('m-notif'); const acc = document.getElementById('notif-log-acc'); const b = document.getElementById('notif-badge'); return { modalShown: m && m.style.display !== 'none', accOpen: acc ? acc.open : null, badge: b.style.display, rows: (document.getElementById('notif-log-list') || {}).children ? document.getElementById('notif-log-list').children.length : -1, seen: localStorage.getItem('tfgn_notif_seen_ts') }; });
  check('2.8 tap opens modal with the log expanded', nc.modalShown && nc.accOpen === true, nc);
  check('2.8 badge cleared after opening', nc.badge === 'none' && !!nc.seen, nc);
  await page.screenshot({ path: OUT + '/2-notif-center.png' });

  // ---- 2.10 "my number" box inside the same modal
  const me = await page.evaluate(() => { const box = document.getElementById('notif-self-box'); const inp = document.getElementById('notif-self-wa'); const m = document.getElementById('m-notif'); return { box: !!box, inp: !!inp, inModal: !!(box && m && m.contains(box)), placeholder: inp && inp.placeholder }; });
  check('2.10 "my number" box exists inside the notification modal', me.box && me.inp && me.inModal, me);
  await page.evaluate(() => { document.getElementById('notif-self-box').scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/3-my-number.png' });
  await page.evaluate(() => closeModal('m-notif'));

  // ---- 6.6a trend card hidden with empty NCR (live state today)
  const trendEmpty = await page.evaluate(() => document.getElementById('dash-trend12-card').style.display);
  check('6.6 trend card hidden while ncr is empty (the live state today)', trendEmpty === 'none', trendEmpty);
  const sectionEmpty = await page.evaluate(() => getComputedStyle(document.getElementById('dash-stats-title')).display);
  check('2.11 stats heading hides itself when no stat card has data', sectionEmpty === 'none', sectionEmpty);
  await page.evaluate(() => {
    const rows = []; const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 10); const iso = d.toISOString().split('T')[0];
      rows.push({ id: 'o' + i, num: 'NCR-' + (100 + i), s: '\u05e4\u05ea\u05d5\u05d7', p: '\u05d2\u05d1\u05d5\u05d4', d: 'x', sd: iso, ts: iso });
      if (i % 2 === 0) rows.push({ id: 'c' + i, num: 'NCR-' + (200 + i), s: '\u05e1\u05d2\u05d5\u05e8', p: '\u05e0\u05de\u05d5\u05da', d: 'x', sd: iso, cd: iso, ts: iso });
    }
    DB.ncr = rows; rDash();
  });
  await page.waitForTimeout(300);
  // ---- 2.11 stats fold
  const foldBefore = await page.evaluate(() => { const t = document.getElementById('dash-stats-title'); let el = t.nextElementSibling, n = 0, vis = 0; while (el && el.classList && el.classList.contains('card')) { n++; if (el.style.display !== 'none') vis++; el = el.nextElementSibling; } return { n, vis, chev: document.getElementById('dash-stats-chev').textContent }; });
  await page.evaluate(() => { document.getElementById('dash-stats-title').scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/4-stats-open.png' });
  await page.click('#dash-stats-title');
  await page.waitForTimeout(300);
  const foldAfter = await page.evaluate(() => { const t = document.getElementById('dash-stats-title'); let el = t.nextElementSibling, n = 0, vis = 0; while (el && el.classList && el.classList.contains('card')) { n++; if (el.style.display !== 'none') vis++; el = el.nextElementSibling; } return { n, vis, chev: document.getElementById('dash-stats-chev').textContent, key: localStorage.getItem('tfgn_dash_stats_open') }; });
  check('2.11 stats section folds (cards hidden, state saved)', foldBefore.vis > 3 && foldAfter.vis === 0 && foldAfter.key === '0', { before: foldBefore, after: foldAfter });
  await page.screenshot({ path: OUT + '/5-stats-folded.png' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block'; window._currentUser = { username: 'mgr', role: 'מנהל' }; _applyRoleGates(); rDash(); });
  await page.evaluate(() => {
    const rows = []; const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 10); const iso = d.toISOString().split('T')[0];
      rows.push({ id: 'o' + i, num: 'NCR-' + (100 + i), s: '\u05e4\u05ea\u05d5\u05d7', p: '\u05d2\u05d1\u05d5\u05d4', d: 'x', sd: iso, ts: iso });
      if (i % 2 === 0) rows.push({ id: 'c' + i, num: 'NCR-' + (200 + i), s: '\u05e1\u05d2\u05d5\u05e8', p: '\u05e0\u05de\u05d5\u05da', d: 'x', sd: iso, cd: iso, ts: iso });
    }
    DB.ncr = rows; rDash();
  });
  await page.waitForTimeout(300);
  const foldReload = await page.evaluate(() => { const t = document.getElementById('dash-stats-title'); let el = t.nextElementSibling, vis = 0; while (el && el.classList && el.classList.contains('card')) { if (el.style.display !== 'none') vis++; el = el.nextElementSibling; } return vis; });
  check('2.11 fold survives reload', foldReload === 0, foldReload);
  await page.click('#dash-stats-title'); await page.waitForTimeout(200);

  // ---- 2.12 more menu
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#more-menu-btn');
  await page.waitForTimeout(300);
  const menu = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('body > div')).filter(d => /אודות \(v/.test(d.textContent));
    const m = items[items.length - 1]; if (!m) return null;
    const r = m.getBoundingClientRect();
    const seps = m.querySelectorAll('hr, [role="separator"], .sep').length || Array.from(m.children).filter(c => c.tagName === 'HR' || (c.style && c.style.borderTop)).length;
    const about = Array.from(m.querySelectorAll('*')).map(e => e.textContent).find(t => /אודות \(v/.test(t) && t.length < 60);
    return { left: r.left, right: r.right, top: r.top, w: r.width, seps, about, children: m.children.length, ver: APP_VER };
  });
  check('2.12 menu opens and stays inside the 390px viewport', menu && menu.left >= 0 && menu.right <= 390, menu);
  check('2.12 menu is grouped with separators', menu && menu.seps >= 3, menu);
  check('2.12 "about" shows the real APP_VER (not 2026.05.02)', menu && /2026\.09\.20/.test(menu.about) && menu.ver === '2026.09.20', menu);
  await page.screenshot({ path: OUT + '/6-more-menu.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  // ---- 6.6 trend chart shown with data
  await page.evaluate(() => { document.getElementById('dash-trend12-card').scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  const trend = await page.evaluate(() => { const c = document.getElementById('dash-trend12-card'); const b = document.getElementById('dash-trend12'); return { display: c.style.display, svg: /<svg/.test(b.innerHTML), legend: /נפתחו|נסגרו/.test(b.innerHTML) }; });
  check('6.6 trend card renders SVG + legend once NCR data exists', trend.display === '' && trend.svg && trend.legend, trend);
  await page.screenshot({ path: OUT + '/7-trend12.png' });

  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('HARNESS ERROR', e); process.exit(2); });
