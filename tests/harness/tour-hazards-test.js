// Manager hazard tours (27/09): the new module that replaces the "מאגר
// מפגעים" sheet. Drives the real rThz / thzNew / svThz / _genEdit against
// seeded rows: the counts the manager reads off the top of the page, the
// filters, overdue, "חדש", the closing date, and new vs edit.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const DAY = 86400000;
const ymd = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().substring(0, 10);

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const out = await page.evaluate((fx) => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], upd = [], toasts = [];
    window.sbIns = function (t, r) { ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.sbUpd = function (t, r) { upd.push([t, JSON.parse(JSON.stringify(r))]); };
    window.toast = function (m) { toasts.push(String(m)); };
    DB.tour_hazards = [
      { id: 'th-1', n: 1, d: null, tour_no: 1, dept: 'מעצבים', loc: 'חדר חשמל', descr: 'חדר חשמל פתוח', sev: 'בינונית', resp: 'חשמל', due: fx.past10, s: 'פתוח' },
      { id: 'th-2', n: 2, d: fx.past30, tour_no: 1, dept: 'מעצבים', descr: 'מחסן מבולגן', sev: 'גבוהה', resp: 'מנהל המחלקה', due: fx.past20, s: 'סגור', closed_d: fx.past15 },
      { id: 'th-3', n: 3, d: fx.past5, tour_no: 9, dept: 'ייצור טוגנים', descr: 'בריחת קיטור', sev: 'גבוהה', resp: 'אחזקה', due: fx.past2, s: 'בטיפול' },
      { id: 'th-4', n: 4, d: fx.past1, tour_no: 10, dept: 'מעצבים', descr: 'ג\'ריקן בכניסה', sev: 'בינונית', resp: 'מנהל המחלקה', due: fx.fut3, s: 'פתוח' },
      { id: 'th-5', n: 5, d: fx.past1, tour_no: 10, dept: 'מעצבים', descr: 'אין יעד', sev: 'נמוכה', resp: 'בטיחות', due: null, s: 'פתוח' },
    ];
    _currentUser = { username: 'admin' };
    const res = {};
    goPage('thz');
    res.pageShown = CUR === 'thz' && document.getElementById('pg-thz').classList.contains('on');
    const rows = () => Array.from(document.querySelectorAll('#tb-thz tr'));
    res.sum = document.getElementById('thz-sum').textContent;
    res.defaultRows = rows().map((tr) => tr.children[0].textContent);
    res.th1 = rows().find((tr) => tr.children[0].textContent === '1').innerHTML;
    res.th4 = rows().find((tr) => tr.children[0].textContent === '4').innerHTML;
    res.th5 = rows().find((tr) => tr.children[0].textContent === '5').innerHTML;
    thzFilter('s', 'overdue'); res.overdueRows = rows().map((tr) => tr.children[0].textContent);
    thzFilter('s', 'סגור'); res.closedRows = rows().map((tr) => tr.children[0].textContent);
    thzFilter('s', ''); thzFilter('dept', 'ייצור טוגנים'); res.deptRows = rows().map((tr) => tr.children[0].textContent);
    res.deptOpts = Array.from(document.getElementById('thz-f-dept').options).map((o) => o.textContent);
    thzFilter('dept', ''); thzFilter('s', 'notclosed');

    // new: keeps the last tour's date/number/department, gets the next n
    thzNew();
    res.newPrefill = { d: gv('thz-d'), tour: gv('thz-tour'), dept: gv('thz-dept'), s: gv('thz-s') };
    svThz(); res.emptyToast = toasts.slice(-1)[0]; res.insAfterEmpty = ins.length;
    document.getElementById('thz-descr').value = 'מטף חסום';
    document.getElementById('thz-s').value = 'סגור';
    svThz();
    res.newRow = ins.slice(-1)[0];
    // edit: selects keep all their options, n stays, closing date is cleared on reopen
    _genEdit('tour_hazards', 'th-2');
    res.editSevOpts = document.getElementById('thz-sev').options.length;
    res.editPrefill = { descr: gv('thz-descr'), s: gv('thz-s'), closed: gv('thz-closed'), dept: gv('thz-dept') };
    document.getElementById('thz-s').value = 'פתוח';
    svThz();
    res.edited = upd.slice(-1)[0];
    res.th2 = DB.tour_hazards.find((r) => r.id === 'th-2');
    res.count = DB.tour_hazards.length;
    res.view = !!VIEW_CONFIG.tour_hazards && VIEW_CONFIG.tour_hazards.back === 'thz';
    res.del = typeof _DEL_TBL_LABEL.tour_hazards === 'string';
    res.inDb = Array.isArray(DB.tour_hazards);
    res.inBackup = _BACKUP_TABLES.indexOf('tour_hazards') >= 0;
    res.menu = !!document.querySelector('[onclick*="\'thz\'"]') && !document.querySelector('.sheet-btn[onclick*="\'ins\'"]');
    return res;
  }, { past1: ymd(1), past2: ymd(2), past5: ymd(5), past10: ymd(10), past15: ymd(15), past20: ymd(20), past30: ymd(30), fut3: ymd(-3), today: ymd(0) });

  console.log('\n1. the page and its counts');
  check('the page opens', out.pageShown);
  check('summary: 4 not closed, 2 overdue, 1 high, 5 total', /4.*2.*1.*5/.test(out.sum.replace(/\s+/g, ' ')), out.sum);
  check('default filter = not closed (closed n=2 hidden), newest first', out.defaultRows.join() === '5,4,3,1', out.defaultRows);
  check('no tour date shows "חסר", not an invented date', out.th1.includes('חסר'), out.th1);
  check('overdue row is flagged with the days late', out.th1.includes('באיחור 10'), out.th1);
  check('latest tour of the department = "חדש"; an older one is not', out.th4.includes('חדש') && !out.th1.includes('חדש'), [out.th4, out.th1]);
  check('no target date shows "חסר" and is not overdue', out.th5.includes('חסר') && !out.th5.includes('באיחור'));

  console.log('\n2. filters');
  check('overdue = open with a past target (1, 3); future and missing targets out', out.overdueRows.sort().join() === '1,3', out.overdueRows);
  check('closed', out.closedRows.join() === '2', out.closedRows);
  check('department', out.deptRows.join() === '3', out.deptRows);
  check('department list: all + the 5 departments', out.deptOpts.length === 6, out.deptOpts);

  console.log('\n3. new and edit');
  check('new keeps the last tour: date, number, department; status פתוח', out.newPrefill.tour === '10' && out.newPrefill.dept === 'מעצבים' && out.newPrefill.s === 'פתוח', out.newPrefill);
  check('no description: refused, nothing written', out.insAfterEmpty === 0 && /תיאור/.test(out.emptyToast), out.emptyToast);
  const nr = out.newRow && out.newRow[1];
  check('saved to tour_hazards with the next n (6)', out.newRow && out.newRow[0] === 'tour_hazards' && nr.n === 6 && /^th-/.test(nr.id), out.newRow);
  check('saved as סגור with no date: closing date = today', nr && nr.s === 'סגור' && nr.closed_d === out.newRow[1].closed_d && /^\d{4}-\d{2}-\d{2}$/.test(nr.closed_d), nr);
  check('empty fields are null, never ""', nr && nr.loc === null && nr.action === null && nr.due === null && nr.notes === null, nr);
  check('edit: every select keeps its options (3 severities)', out.editSevOpts === 3, out.editSevOpts);
  check('edit: fields filled from the record', out.editPrefill.descr === 'מחסן מבולגן' && out.editPrefill.s === 'סגור' && out.editPrefill.dept === 'מעצבים', out.editPrefill);
  check('edit: an update, not a new row; n and ts kept', out.edited && out.edited[0] === 'tour_hazards' && out.th2.n === 2 && out.count === 6, out.edited);
  check('reopened: closing date cleared', out.th2.s === 'פתוח' && out.th2.closed_d === null, out.th2);

  console.log('\n4. wired in');
  check('VIEW_CONFIG, delete label, DB key, backup list', out.view && out.del && out.inDb && out.inBackup);
  check('modules menu opens the new page; the old empty "ins" entry is gone', out.menu);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
