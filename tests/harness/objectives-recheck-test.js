// BACKLOG 9.25 stage 2 + BACKLOG 13 (Michael, 02/10/2026).
// Objectives: four 2026 targets measured from existing data, a card in the
// management review and clause 6.2 of the ISO report; an empty register is
// "no data", never 0%. Recheck: a high-severity tour hazard closed on or after
// _THZ_RCK_FROM shows on the expiry page 30 days after closing, until marked
// "held" (recheck_d) or reopened; a hazard closed again needs a new check.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._role = () => 'admin'; window._isAdminUser = () => true; _isAdmin = true;
    window.__upd = []; window.sbIns = function () {}; window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._thzToday = () => '2026-10-02';
    DB.ncr = []; DB.tr = []; DB.drl = []; DB.auds = [];
    // 5 closed with a due date: 4 on time (80%)
    DB.tour_hazards = [
      { id: 'h1', n: 1, sev: 'גבוהה', s: 'סגור', descr: 'מטף חסום', dept: 'ייצור', due: '2026-09-20', closed_d: '2026-09-15' },
      { id: 'h2', n: 2, sev: 'גבוהה', s: 'סגור', descr: 'ישן', due: '2026-08-10', closed_d: '2026-08-01' },
      { id: 'h3', n: 3, sev: 'בינונית', s: 'סגור', descr: 'בינוני', due: '2026-09-20', closed_d: '2026-09-10' },
      { id: 'h4', n: 4, sev: 'גבוהה', s: 'סגור', descr: 'נבדק', due: '2026-09-25', closed_d: '2026-09-20', recheck_d: '2026-09-30' },
      { id: 'h5', n: 5, sev: 'גבוהה', s: 'סגור', descr: 'נסגר שוב', due: '2026-09-01', closed_d: '2026-09-28', recheck_d: '2026-09-10' },
      { id: 'h6', n: 6, sev: 'גבוהה', s: 'פתוח', descr: 'פתוח', due: '2026-10-10', closed_d: null }];
  });

  console.log('\n1. objectives: measured, and empty registers are "no data"');
  let r = await page.evaluate(() => _objMeasure());
  const by = {}; r.forEach((o) => { by[o.k] = o; });
  check('hazards 4/5 = 80% = at target', by.thz.n === 4 && by.thz.d === 5 && by.thz.p === 80 && by.thz.st === 'ok', by.thz);
  check('NCR, drills+audits, training: no data (na, no percent)', ['ncr', 'rec', 'tr'].every((k) => by[k].st === 'na' && by[k].p === null), r);
  r = await page.evaluate(() => {
    DB.ncr = [{ id: 'n1', s: 'סגור', u: '2026-09-10', cd: '2026-09-12' }, { id: 'n2', s: 'סגור', u: '2026-09-10', cd: '2026-09-09' }];
    DB.tr = [{ id: 't1', e: '2027-01-01' }, { id: 't2', e: '2026-01-01' }, { id: 't3', e: null }];
    return _objMeasure();
  });
  r.forEach((o) => { by[o.k] = o; });
  check('NCR 1/2 = 50%, under target (bad)', by.ncr.p === 50 && by.ncr.st === 'bad', by.ncr);
  check('training 1/2 in force (a row with no expiry is not counted)', by.tr.n === 1 && by.tr.d === 2, by.tr);
  r = await page.evaluate(() => { DB.ncr = [{ id: 'n1', s: 'סגור', u: '2026-09-10', cd: '2026-09-09' }].concat(Array.from({ length: 3 }, (_, i) => ({ id: 'x' + i, s: 'סגור', u: '2026-09-10', cd: '2026-09-01' }))).concat([{ id: 'late', s: 'סגור', u: '2026-09-10', cd: '2026-09-20' }]); return _objMeasure().find((o) => o.k === 'ncr'); });
  check('NCR 4/5 = 80%: ok exactly at target', r.st === 'ok' && r.p === 80, r);
  r = await page.evaluate(() => { DB.ncr.push({ id: 'late2', s: 'סגור', u: '2026-09-10', cd: '2026-09-21' }); return _objMeasure().find((o) => o.k === 'ncr'); });
  check('NCR 4/6 = 66%: more than 10 under = bad; then 7/9 = 77% = warn', r.st === 'bad', r);
  r = await page.evaluate(() => { DB.ncr = DB.ncr.concat([1, 2, 3].map((i) => ({ id: 'y' + i, s: 'סגור', u: '2026-09-10', cd: '2026-09-02' }))); return _objMeasure().find((o) => o.k === 'ncr'); });
  check('NCR 7/9 = 77%: warn', r.st === 'warn' && r.p === 77, r);

  console.log('\n2. the review card and ISO 6.2');
  r = await page.evaluate(() => { goPage('mr'); const el = g('mr-obj'); return { html: el && el.innerHTML, card: !!g('mr-obj-card') }; });
  check('the card is on the management review page with the four objectives', r.card && r.html && ['מפגעי סיור שנסגרו בזמן', 'NCR שנסגרו בזמן', 'תרגילים וביקורות פנים שבוצעו', 'הדרכות בתוקף'].every((l) => r.html.indexOf(l) >= 0), r);
  check('an empty register reads "אין נתונים" on the card', r.html && r.html.indexOf('אין נתונים') >= 0, r);
  r = await page.evaluate(() => { DB.tr = [{ id: 't1', e: '2027-01-01' }]; const c = _isoClauses().filter((x) => x.cl === '6.2')[0]; return c; });
  check('ISO 6.2 is no longer "no module": warn (NCR 77%), gap names it and the empty registers', r && r.st === 'warn' && r.gap.indexOf('NCR שנסגרו בזמן 77%') >= 0 && r.gap.indexOf('אין עדיין נתונים') >= 0, r);
  r = await page.evaluate(() => { const keep = { ncr: DB.ncr, tr: DB.tr, th: DB.tour_hazards }; DB.ncr = []; DB.tr = []; DB.tour_hazards = []; const c = _isoClauses().filter((x) => x.cl === '6.2')[0]; DB.ncr = keep.ncr; DB.tr = keep.tr; DB.tour_hazards = keep.th; return c.st; });
  check('all registers empty: 6.2 is grey (na), not red', r === 'na', r);

  console.log('\n3. recheck: which hazards, and when');
  r = await page.evaluate(() => _thzRecheck().map((x) => ({ id: x.id, e: x.e })));
  const ids = r.map((x) => x.id).sort().join(',');
  check('pending: h1 (high, closed 15/09) and h5 (closed again after its check)', ids === 'h1,h5', r);
  check('not h2 (closed before the start date), h3 (medium), h4 (checked), h6 (open)', ids.indexOf('h2') < 0 && ids.indexOf('h3') < 0 && ids.indexOf('h4') < 0 && ids.indexOf('h6') < 0, r);
  check('due 30 days after closing (15/09 -> 15/10, 28/09 -> 28/10)', r.find((x) => x.id === 'h1').e === '2026-10-15' && r.find((x) => x.id === 'h5').e === '2026-10-28', r);
  r = await page.evaluate(() => { goPage('exp'); expFilter('all'); const tb = g('tb-exp').innerHTML; return { row: tb.indexOf('מטף חסום') >= 0, held: tb.indexOf('_thzRckDo(this.dataset.ri,true)') >= 0, label: tb.indexOf('בדיקה חוזרת למפגע') >= 0 }; });
  check('the expiry page shows the row, its label and the "held" button', r.row && r.held && r.label, r);

  console.log('\n4. held / not held');
  r = await page.evaluate(() => { window.__upd = []; _thzRckDo('h1', true); const h = DB.tour_hazards.find((x) => x.id === 'h1'); return { rd: h.recheck_d, s: h.s, sent: window.__upd.length && window.__upd[0].r.recheck_d, left: _thzRecheck().map((x) => x.id) }; });
  check('held: recheck_d = today, still closed, sent to Supabase, off the list', r.rd === '2026-10-02' && r.s === 'סגור' && r.sent === '2026-10-02' && r.left.indexOf('h1') < 0, r);
  r = await page.evaluate(() => { window.__upd = []; _thzRckDo('h5', false); const h = DB.tour_hazards.find((x) => x.id === 'h5'); return { s: h.s, cd: h.closed_d, notes: h.notes, left: _thzRecheck().map((x) => x.id), sent: window.__upd.length }; });
  check('not held: reopened, closing date cleared, a note says why', r.s === 'פתוח' && r.cd === null && /בדיקה חוזרת 02\/10\/2026: התיקון לא החזיק/.test(r.notes || ''), r);
  check('and it is off the recheck list until closed again', r.left.indexOf('h5') < 0 && r.sent === 1, r);
  r = await page.evaluate(() => { const h = DB.tour_hazards.find((x) => x.id === 'h5'); h.s = 'סגור'; h.closed_d = '2026-10-05'; return _thzRecheck().map((x) => x.id); });
  check('closed again: back on the list for a new check', r.indexOf('h5') >= 0, r);

  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
