// 6.5: the 12-month NCR trend chart lived only inside the NCR-agent panel.
// It now also appears on the dashboard (in the foldable stats section), for a
// manager, when there is NCR data. This drives the real rDash and checks the
// card shows the chart with data and hides when there is none.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // The card exists in the stats section, hidden until rDash fills it.
  const present = await page.evaluate(() => ({
    card: !!document.getElementById('dash-trend12-card'),
    body: !!document.getElementById('dash-trend12'),
    inStats: (() => { const t = document.getElementById('dash-stats-title'); if (!t) return false; let el = t.nextElementSibling; while (el) { if (el.id === 'dash-trend12-card') return true; el = el.nextElementSibling; } return false; })(),
  }));
  check('the dashboard has a trend card', present.card && present.body);
  check('and it sits inside the foldable stats section', present.inStats);

  // Empty: no NCR data -> card stays hidden (the chart returns '').
  const empty = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'mgr', role: 'מנהל' }; _applyRoleGates();
    DB.ncr = [];
    rDash();
    const c = document.getElementById('dash-trend12-card');
    return { display: c ? c.style.display : '?', html: document.getElementById('dash-trend12').innerHTML };
  });
  check('with no NCR data the trend card is hidden', empty.display === 'none' && empty.html === '', empty);

  // With 12 months of NCR data -> card shows and renders the SVG chart + legend.
  const filled = await page.evaluate(() => {
    const rows = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 10);
      const iso = d.toISOString().split('T')[0];
      rows.push({ id: 'o' + i, num: 'NCR-' + (100 + i), s: 'פתוח', p: 'גבוה', d: 'x', sd: iso, ts: iso });
      if (i % 2 === 0) rows.push({ id: 'c' + i, num: 'NCR-' + (200 + i), s: 'סגור', p: 'נמוך', d: 'x', sd: iso, cd: iso, ts: iso });
    }
    DB.ncr = rows;
    rDash();
    const c = document.getElementById('dash-trend12-card');
    const b = document.getElementById('dash-trend12');
    return { display: c ? c.style.display : '?', hasSvg: /<svg/.test(b.innerHTML), hasLegend: /12 חודשים/.test(b.innerHTML), len: b.innerHTML.length };
  });
  check('with 12 months of NCR data the card shows', filled.display === '', filled);
  check('and it renders the SVG trend chart', filled.hasSvg, filled);
  check('with the 12-month legend', filled.hasLegend, filled);

  // Folds with the stats section (dataset.folded, like its siblings).
  const folded = await page.evaluate(() => {
    // close the stats section
    if (_dashStatsOpen()) _dashStatsToggle();
    const c = document.getElementById('dash-trend12-card');
    const open = c.style.display !== 'none';
    if (!_dashStatsOpen()) _dashStatsToggle(); // reopen
    return { hiddenWhenClosed: !open };
  });
  check('it folds away when the stats section is collapsed', folded.hiddenWhenClosed, folded);

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
