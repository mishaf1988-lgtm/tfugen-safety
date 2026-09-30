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
      { id: 'th-2', n: 2, d: fx.past30, tour_no: 1, dept: 'מעצבים', descr: 'מחסן מבולגן', sev: 'גבוהה', resp: 'מנהל המחלקה', resp2: 'בטיחות', due: fx.past20, s: 'סגור', closed_d: fx.past15 },
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
    // the same party twice is one party
    thzNew(); document.getElementById('thz-descr').value = 'x'; document.getElementById('thz-resp').value = 'חשמל'; document.getElementById('thz-resp2').value = 'חשמל'; svThz();
    res.sameResp2 = ins.slice(-1)[0][1].resp2;
    DB.tour_hazards.pop();
    // edit: selects keep all their options, n stays, closing date is cleared on reopen
    _genEdit('tour_hazards', 'th-2');
    res.editSevOpts = document.getElementById('thz-sev').options.length;
    res.editPrefill = { descr: gv('thz-descr'), s: gv('thz-s'), closed: gv('thz-closed'), dept: gv('thz-dept'), resp2: gv('thz-resp2') };
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
  check('department list: all + the 5 departments + אחזקה (30/09)', out.deptOpts.length === 7 && out.deptOpts[6] === 'אחזקה', out.deptOpts);

  console.log('\n3. new and edit');
  check('new keeps the last tour: date, number, department; status פתוח', out.newPrefill.tour === '10' && out.newPrefill.dept === 'מעצבים' && out.newPrefill.s === 'פתוח', out.newPrefill);
  check('no description: refused, nothing written', out.insAfterEmpty === 0 && /תיאור/.test(out.emptyToast), out.emptyToast);
  const nr = out.newRow && out.newRow[1];
  check('saved to tour_hazards with the next n (6)', out.newRow && out.newRow[0] === 'tour_hazards' && nr.n === 6 && /^th-/.test(nr.id), out.newRow);
  check('saved as סגור with no date: closing date = today', nr && nr.s === 'סגור' && nr.closed_d === out.newRow[1].closed_d && /^\d{4}-\d{2}-\d{2}$/.test(nr.closed_d), nr);
  check('empty fields are null, never ""', nr && nr.loc === null && nr.action === null && nr.due === null && nr.notes === null && nr.resp2 === null, nr);
  check('second responsible equal to the first is dropped', out.sameResp2 === null, out.sameResp2);
  check('edit: every select keeps its options (3 severities)', out.editSevOpts === 3, out.editSevOpts);
  check('edit: fields filled from the record', out.editPrefill.descr === 'מחסן מבולגן' && out.editPrefill.s === 'סגור' && out.editPrefill.dept === 'מעצבים' && out.editPrefill.resp2 === 'בטיחות', out.editPrefill);
  check('edit: an update, not a new row; n and ts kept', out.edited && out.edited[0] === 'tour_hazards' && out.th2.n === 2 && out.count === 6, out.edited);
  check('reopened: closing date cleared', out.th2.s === 'פתוח' && out.th2.closed_d === null, out.th2);

  console.log('\n4. wired in');
  check('VIEW_CONFIG, delete label, DB key, backup list', out.view && out.del && out.inDb && out.inBackup);
  check('modules menu opens the new page; the old empty "ins" entry is gone', out.menu);

  console.log('\n5. "לא נקלט מהקובץ": reasons, dates, "טופל" (upgrade review 9, 29/09)');
  const dr = await page.evaluate(async () => {
    const calls = [];
    window._truApi = function (p, b) { calls.push([p, b]); return Promise.resolve({ ok: true, left: 0 }); };
    window.toast = function () {};
    const div = document.getElementById('thz-file') || (() => { const d = document.createElement('div'); d.id = 'thz-file'; document.body.appendChild(d); return d; })();
    const a = { n: 'נ-9', r: 12, ci: -1, val: 'ליקוי מהקובץ', why: 'tru_new', at: '2026-09-20T08:00:00Z' };
    const b = { n: '4', r: 5, ci: 6, val: 'גבוהה', why: 'keep', id: 'h:th-4', at: '2026-09-29T08:00:00Z' };
    // Chrome check 30/09: an item stored before the reasons, already fixed in the app, stayed listed
    DB.tour_hazards = (DB.tour_hazards || []).concat([{ id: 'hz9', n: 9, dept: 'תוצג', descr: 'כבר תוקן', due: '2026-10-01', s: 'פתוח' }]);
    const held = { n: '9', r: 10, ci: 9, val: '2026-10-01' }, legacy = { n: '9', r: 10, ci: 9, val: '2026-10-20' };
    _thzFile = { configured: true, connected: true, files: {
      xlsm: { last: new Date().toISOString(), dropped: { at: '2026-09-29T08:00:00Z', items: [a, b, held, legacy] } },
      xlsx: { dropped: { at: '2026-09-29T08:00:00Z', items: [a] } } } };
    _thzFileRender();
    const box = () => document.getElementById('thz-dropped');
    const res = { txt: box() && box().textContent, btns: box() ? box().querySelectorAll('button').length : 0 };
    const bt = box() && box().querySelector('button[data-k^="נ-9"]'); if (bt) bt.click();
    await new Promise((r) => setTimeout(r, 50));
    res.calls = calls.map((c) => c[1]);
    res.after = box() && box().textContent;
    return res;
  });
  check('an item older than a week is still listed (the list collects), with its date', /ליקוי מהקובץ/.test(dr.txt || '') && /20\/09\/2026/.test(dr.txt), dr.txt);
  check('each item says why it was not taken', /ליקוי נאמן נפתח רק מהאפליקציה/.test(dr.txt || '') && /עמודה שנקבעת באפליקציה/.test(dr.txt) && /\(3\)/.test(dr.txt), dr.txt);
  check('an item the app already holds is not listed; an older item without a reason says so; a date reads DD/MM/YYYY', !/01\/10\/2026/.test(dr.txt || '') && /"20\/10\/2026"/.test(dr.txt) && /נרשם לפני שנוספו הסיבות/.test(dr.txt) && !/2026-10-20/.test(dr.txt), dr.txt);
  check('the same item in both files is listed once, with a "טופל" button per item', dr.btns === 3, dr.btns);
  check('"טופל" dismisses it in both files, and it leaves the list', dr.calls.length === 2 && dr.calls.every((c) => c.op === 'dismiss' && c.key === 'נ-9|-1|ליקוי מהקובץ') && dr.calls.map((c) => c.file).sort().join() === 'xlsm,xlsx' && !/ליקוי מהקובץ/.test(dr.after || '') && /גבוהה/.test(dr.after), [dr.calls, dr.after]);

  console.log('\n6. overdue hazards in "היום", escalation, "חסר יעד" (upgrade review 2, 29/09)');
  const od = await page.evaluate(() => {
    const ago = (n) => new Date(Date.now() - n * 864e5).toISOString().substring(0, 10);
    window._currentUser = { username: 'admin' }; if (typeof _applyRoleGates === 'function') _applyRoleGates();
    DB.tasks = []; DB.rounds = [{ id: 'rd', d: new Date().toISOString().split('T')[0] }];
    DB.tour_hazards = [
      { id: 'a', n: 1, dept: 'תוצג', descr: 'גבוהה 10 ימים', sev: 'גבוהה', resp: 'אחזקה', due: ago(10), s: 'פתוח' },
      { id: 'b', n: 2, dept: 'תוצג', descr: 'בינונית 10 ימים', sev: 'בינונית', resp: 'אחזקה', due: ago(10), s: 'פתוח' },
      { id: 'c', n: 3, dept: 'מעצבים', descr: 'נמוכה 40 ימים', sev: 'נמוכה', resp: 'חשמל', due: ago(40), s: 'בטיפול' },
      { id: 'd', n: 4, dept: 'מעצבים', descr: 'גבוהה 5 ימים', sev: 'גבוהה', resp: 'הנדסה', due: ago(5), s: 'פתוח' },
      { id: 'e', n: 5, dept: 'מעצבים', descr: 'בלי יעד', sev: 'נמוכה', resp: 'הנדסה', due: null, s: 'פתוח' },
      { id: 'f', n: 6, dept: 'מעצבים', descr: 'סגור באיחור', sev: 'גבוהה', resp: 'הנדסה', due: ago(50), s: 'סגור' },
    ];
    DB.trustee_reports = [
      { id: 't1', u: 'דני', t: 1, ok: false, s: 'פתוח', d: ago(12), ts: ago(12) + 'T08:00:00Z', loc: 'מעבדה · מדף', f: 'נאמן באיחור' },
      { id: 't2', u: 'דני', t: 1, ok: false, s: 'פתוח', d: ago(12), ts: ago(12) + 'T08:00:00Z', loc: 'תוצג · רמפה', f: 'עם משימה' },
      { id: 't3', u: 'דני', t: 1, ok: false, s: 'פתוח', d: ago(1), ts: ago(1) + 'T08:00:00Z', loc: 'תוצג · רמפה', f: 'עוד לא באיחור' },
    ];
    DB.tasks = [{ id: 'k1', title: 'x', source_table: 'trustee_reports', source_id: 't2', due: ago(-5), status: 'פתוח' }];
    const late = _hzLateAll();
    const res = { ids: late.map((x) => x.id + (x.esc ? '!' : '')) };
    _renderToday();
    res.today = Array.from(document.querySelectorAll('#today-items .today-item')).map((x) => x.textContent);
    goPage('thz'); rThz();
    res.sum = document.getElementById('thz-sum').textContent;
    const fs = document.getElementById('thz-f-s');
    res.opts = Array.from(fs.options).map((o) => o.value);
    thzFilter('s', 'esc'); res.escRows = document.querySelectorAll('#tb-thz tr').length; res.escTxt = document.getElementById('tb-thz').textContent;
    thzFilter('s', 'nodue'); res.nodueTxt = document.getElementById('tb-thz').textContent;
    thzFilter('s', 'notclosed');
    res.rowsTxt = document.getElementById('tb-thz').textContent;
    // the Today row opens the tours screen on "overdue"
    goPage('dash'); _todayClick('thz', 'overdue'); res.clickF = [window.CUR, document.getElementById('thz-f-s').value];
    // the daily scan: overdue hazards go to the manager, not to a department
    const evs = []; const keep = window._notifyEvent; window._notifyEvent = (k, p) => evs.push([k, p]);
    Object.keys(localStorage).filter((k) => /^tfgn_notif_/.test(k)).forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.clear(); } catch (e) {}
    _notifDailyScan(); window._notifyEvent = keep;
    res.scan = evs.filter((e) => e[0] === 'task_overdue').map((e) => e[1]);
    thzFilter('s', 'notclosed');
    return res;
  });
  check('overdue: tour hazards and an open trustee finding past its due, oldest first; closed, routed-to-a-task and not-yet-due ones left out', od.ids.join() === 'c!,a!,b,t1,d', od.ids);
  check('escalation: high severity over 7 days (a) and any hazard over 30 (c); high at 5 days (d) and medium at 10 (b) not', od.ids.includes('a!') && od.ids.includes('c!') && od.ids.includes('d') && od.ids.includes('b'), od.ids);
  const lateRow = od.today.find((t) => /מפגעים באיחור/.test(t)) || '';
  check('"היום": one line, 5 overdue, 2 escalated, by responsible, the oldest in days, badge "הסלמה"', /5 מפגעים באיחור \(2 בהסלמה\)/.test(lateRow) && /4 מסיורים, 1 מליקויי נאמנים/.test(lateRow) && /אחזקה 2/.test(lateRow) && /מנהל המחלקה 1/.test(lateRow) && !/מעבדה 1|מעבדות 1/.test(lateRow) && /הוותיק: 40 ימים/.test(lateRow) && /הסלמה/.test(lateRow), od.today);
  check('"היום": a line for tour hazards without a due, badge "חסר יעד"', od.today.some((t) => /מפגע סיור אחד בלי יעד לטיפול/.test(t) && /חסר יעד/.test(t)), od.today);
  check('tours screen: counts escalated and without a due on top', /2 בהסלמה/.test(od.sum) && /1 בלי יעד/.test(od.sum), od.sum);
  check('tours screen: filters "בהסלמה" and "בלי יעד"', od.opts.includes('esc') && od.opts.includes('nodue') && od.escRows === 2 && /גבוהה 10 ימים/.test(od.escTxt) && /נמוכה 40 ימים/.test(od.escTxt) && /בלי יעד/.test(od.nodueTxt) && !/גבוהה 10/.test(od.nodueTxt), [od.escRows, od.nodueTxt.slice(0, 80)]);
  check('rows: a "הסלמה" tag and a "חסר יעד" tag', /הסלמה/.test(od.rowsTxt) && /חסר יעד/.test(od.rowsTxt), od.rowsTxt.slice(0, 200));
  check('the "היום" line opens the tours screen filtered on overdue', od.clickF[0] === 'thz' && od.clickF[1] === 'overdue', od.clickF);
  check('daily scan: overdue hazards in the overdue alert, with no assignee (to the manager, never the department)', od.scan.some((p) => p.src === 'tour_hazards' && /מפגע סיור 3/.test(p.title) && p.assignee === null), od.scan);

  console.log('\n7. trustee findings with no department (upgrade review 4, 30/09)');
  const nd = await page.evaluate(() => {
    const now = new Date().toISOString();
    window._currentUser = { username: 'admin' }; if (typeof _applyRoleGates === 'function') _applyRoleGates();
    DB.tasks = [];
    DB.trustee_reports = [
      { id: 'y1', u: 'דני', t: 1, ok: false, s: 'פתוח', d: now.substring(0, 10), ts: now, loc: 'חצר · שער אחורי', f: 'בור פתוח בחצר' },
      { id: 'y2', u: 'דני', t: 1, ok: false, s: 'פתוח', d: now.substring(0, 10), ts: now, loc: 'מחסן כללי · סדנה', f: 'כבל חשוף בסדנה' },
      { id: 'y3', u: 'דני', t: 1, ok: false, s: 'פתוח', d: now.substring(0, 10), ts: now, loc: 'אריזה · קו 3', f: 'משטח שבור באריזה' },
      { id: 'y4', u: 'דני', t: 1, ok: false, s: 'נסגר', d: now.substring(0, 10), ts: now, loc: 'שפכים', f: 'סגור בשפכים' },
    ];
    const res = { map: [_mfTruDept('אריזה · קו 3'), _mfTruDept('קילופים'), _mfTruDept('מעבדה'), _mfTruDept('חצר'), _mfTruDept('מחסן כללי'), _mfTruDept('מעוצבים'), _mfTruDept('חומר גלם + שפכים · משרד שפכים')] };
    goPage('thz'); rThz(); res.thz = (document.getElementById('thz-nodept') || {}).textContent || '';
    goPage('trustees'); rTrustees(); res.tru = (document.getElementById('tru-nodept') || {}).textContent || '';
    DB.trustee_reports = DB.trustee_reports.filter((r) => r.id === 'y3');
    goPage('thz'); rThz(); res.none = (document.getElementById('thz-nodept') || {}).textContent;
    return res;
  });
  check('the app\'s map: packing and peeling -> ייצור טוגנים, lab -> מעבדות, yard and two areas with waste water -> אחזקה (30/09), an unknown area -> none', JSON.stringify(nd.map) === JSON.stringify(['ייצור טוגנים', 'ייצור טוגנים', 'מעבדות', 'אחזקה', null, 'מעצבים', 'אחזקה']), nd.map);
  check('tours screen: a red box with the open findings that reach no department (an unknown area), not the yard one (אחזקה), the packing one or a closed one', /ליקויי נאמנים בלי מחלקה \(1\)/.test(nd.thz) && /כבל חשוף בסדנה/.test(nd.thz) && !/בור פתוח בחצר/.test(nd.thz) && !/משטח שבור/.test(nd.thz) && !/סגור בשפכים/.test(nd.thz), nd.thz);
  check('trustees screen: the same box', /ליקויי נאמנים בלי מחלקה \(1\)/.test(nd.tru) && /כבל חשוף בסדנה/.test(nd.tru), nd.tru);
  check('none left: no box', nd.none === '', nd.none);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
