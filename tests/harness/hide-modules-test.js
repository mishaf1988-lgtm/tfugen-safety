// Empty modules hidden for everyone (Michael, 10/10/2026, questionnaire): round, ptw, ppe, ctr,
// wst, prj, rsk, ncr. Hidden = off the modules sheet, the home quick actions, the reports sheet
// and the dashboard tiles. Data stays; "hidden modules" (admin) opens the display settings, and
// ticking one there brings it back on this device.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const HIDE = ['round', 'ptw', 'ppe', 'ctr', 'wst', 'prj', 'rsk', 'ncr'];

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(900);
  const r = await page.evaluate((HIDE) => {
    try { localStorage.removeItem(_APP_PREFS_KEY); } catch (e) {}
    document.body.classList.add('role-manager');
    _appPrefsApply();
    const vis = (b) => b.style.display !== 'none';
    const sheetKey = (k) => Array.from(document.querySelectorAll('#m-modules-sheet .sheet-btn')).filter((b) => (b.getAttribute('onclick') || '').indexOf("'" + k + "'") >= 0);
    const out = {};
    out.sheetHidden = HIDE.filter((k) => sheetKey(k).length && sheetKey(k).every((b) => !vis(b)));
    out.sheetHas = HIDE.filter((k) => sheetKey(k).length);
    out.docsVisible = sheetKey('docs').some(vis);
    const qa = Array.from(document.querySelectorAll('.qa-btn'));
    out.roundQa = qa.filter((b) => /goPage\('round'\)/.test(b.getAttribute('onclick') || '')).map(vis);
    out.ncrQa = qa.filter((b) => b.dataset.mod === 'ncr').map(vis);
    out.tasksQa = qa.filter((b) => /goPage\('tasks'\)/.test(b.getAttribute('onclick') || '')).map(vis);
    const rep = Array.from(document.querySelectorAll('#m-reports-sheet .sheet-btn'));
    out.repRound = rep.filter((b) => /'round'\)/.test(b.getAttribute('onclick') || '')).map(vis);
    out.repInc = rep.filter((b) => /'inc'\)/.test(b.getAttribute('onclick') || '')).map(vis);
    const host = document.getElementById('dash-kpis');
    _renderDashKpis({ ncrOpen: 3, critRisks: 2, ptwOpen: 1, incYear: 5 });
    out.kpi = host ? host.textContent : '';
    // the "today" list: no morning-round line while rounds are hidden (10/10/2026)
    DB.rounds = []; DB.tasks = []; _renderToday();
    out.todayRound = (document.getElementById('today-items') || {}).textContent || '';
    out.todayCount = (document.getElementById('today-count') || {}).textContent || '';
    // bring rsk back from the settings screen
    _modVisOpen();
    const cb = document.querySelector('#mvis-list input[data-modkey="rsk"]');
    out.rskUnticked = cb ? !cb.checked : null;
    if (cb) cb.checked = true;
    _modVisSaveFromUI();
    out.rskBack = sheetKey('rsk').some(vis);
    out.ncrStill = sheetKey('ncr').every((b) => !vis(b));
    _renderDashKpis({ ncrOpen: 3, critRisks: 2 });
    out.kpi2 = host ? host.textContent : '';
    const p = _appPrefs(); p.modulesShown = Object.assign({}, p.modulesShown || {}, { round: true }); p.modulesHidden = Object.assign({}, p.modulesHidden || {}, { round: false }); _appPrefsSet(p); _renderToday();
    out.todayRound2 = (document.getElementById('today-items') || {}).textContent || '';
    return out;
  }, HIDE);
  check('all 8 modules found on the sheet', r.sheetHas.length === 8, r.sheetHas);
  check('all 8 hidden on the sheet by default', r.sheetHidden.length === 8, r.sheetHidden);
  check('other modules stay (docs)', r.docsVisible);
  check('home quick action "סבב בוקר" hidden', r.roundQa.length && r.roundQa.every((v) => !v), r.roundQa);
  check('home quick action "NCR חדש" hidden', r.ncrQa.length && r.ncrQa.every((v) => !v), r.ncrQa);
  check('home quick action tasks stays', r.tasksQa.length && r.tasksQa.every(Boolean), r.tasksQa);
  check('reports sheet: round hidden, incidents stay', r.repRound.every((v) => !v) && r.repInc.every(Boolean), [r.repRound, r.repInc]);
  check('dashboard: no NCR / risk / PTW tile', !/NCR|RPN|PTW/.test(r.kpi), r.kpi);
  check('settings list a hidden module unticked', r.rskUnticked === true);
  check('ticking it brings it back, the rest stay hidden', r.rskBack && r.ncrStill, r);
  check('...and its tile comes back', /RPN/.test(r.kpi2) && !/NCR/.test(r.kpi2), r.kpi2);
  check('today list: no morning-round line while rounds are hidden', !/סבב בוקר/.test(r.todayRound), [r.todayRound, r.todayCount]);
  check('...and it comes back when rounds are shown', /סבב בוקר/.test(r.todayRound2), r.todayRound2);
  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
