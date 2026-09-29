// Safety manager field mode (28/09): the login-screen button "ממשק ממונה
// הבטיחות" and the one-screen hazard report it lands on. Drives the real
// mgrFieldLogin / mgrFieldOpen / mgrFieldSave against seeded tour_hazards.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  console.log('\n1. the login screen');
  const btn = await page.evaluate(() => { const b = document.getElementById('login-mgr-btn'); return b ? { text: b.textContent.trim(), shown: b.offsetParent !== null } : null; });
  check('a button "ממשק ממונה הבטיחות" on the login screen', btn && /ממשק ממונה הבטיחות/.test(btn.text) && btn.shown, btn);
  await page.click('#login-mgr-btn');
  const after = await page.evaluate(() => ({ wanted: _mfWanted(), hint: document.getElementById('pw-err').textContent, focus: document.activeElement && document.activeElement.id }));
  check('it asks for the same username and password, and remembers where to land', after.wanted && /הסיסמה שלך/.test(after.hint) && after.focus === 'uname', after);
  const hook = await page.evaluate(() => /_mfWanted\(\)\)setTimeout\(mgrFieldOpen/.test(String(_finishLogin)));
  check('after a successful login the report screen opens', hook);

  console.log('\n2. reporting');
  const out = await page.evaluate(() => {
    window.sdb = function () {}; window.addLog = function () {}; window.goPage = function (p) { window._went = p; };
    const ins = [], toasts = [];
    window.sbIns = function (t, r) { ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.sbUpd = function (t, r) { ins.push(['upd:' + t, JSON.parse(JSON.stringify(r))]); };
    window.toast = function (m) { toasts.push(String(m)); };
    const today = _thzToday();
    DB.tour_hazards = [
      { id: 'th-1', n: 1, d: '2026-09-01', tour_no: 9, dept: 'תוצג', descr: 'ישן', s: 'סגור' },
      { id: 'th-2', n: 7, d: today, tour_no: 10, dept: 'מעצבים', descr: 'מהסיור של היום', s: 'פתוח' },
    ];
    const res = {};
    mgrFieldOpen();
    const ov = document.getElementById('mf');
    res.open = ov && ov.style.display === 'block' && !_mfWanted();
    res.chips = Array.from(ov.querySelectorAll('.mf-chips')[0].children).map((b) => b.textContent);
    res.noScroll = document.documentElement.scrollWidth <= 375 && ov.scrollWidth <= 375;
    mgrFieldSave(); res.noDept = toasts.slice(-1)[0]; res.ins0 = ins.length;
    _mfPickDept('תוצג');
    res.sub = ov.querySelector('.mf-sub').textContent;
    mgrFieldSave(); res.noDescr = toasts.slice(-1)[0]; res.ins1 = ins.length;
    document.getElementById('mf-loc').value = 'מחסן';
    document.getElementById('mf-descr').value = 'כבל חשוף';
    _mfPickSev('גבוהה');                       // a re-render must keep what was typed
    res.keptDescr = document.getElementById('mf-descr').value;
    mgrFieldSave();
    res.first = ins[0];
    res.cleared = document.getElementById('mf-descr').value === '' && document.getElementById('mf-loc').value === '';
    res.keptDept = ov.querySelector('.mf-chip.on') && ov.querySelector('.mf-chip.on').textContent;
    document.getElementById('mf-descr').value = 'מטף חסר';
    mgrFieldSave(); res.second = ins[1];
    _mfPickDept('מעצבים'); document.getElementById('mf-descr').value = 'עוד אחד'; mgrFieldSave(); res.third = ins[2];
    res.list = ov.querySelector('.mf-tour') && ov.querySelector('.mf-tour').textContent;
    res.today = today;
    // open hazards of the department: earlier tours, not this one
    DB.tour_hazards.push({ id: 'th-3', n: 3, d: '2026-09-10', tour_no: 8, dept: 'מעצבים', descr: 'פתוח מסיור קודם', loc: 'קו 2', s: 'פתוח', due: '2026-09-15' },
      { id: 'th-4', n: 4, d: '2026-09-10', tour_no: 8, dept: 'מעצבים', descr: 'כבר סגור', s: 'סגור' });
    _mfRender();
    document.getElementById('mf-descr').value = 'בכתיבה';
    const op = () => ov.querySelector('.mf-open');
    res.openTxt = op() && op().textContent;
    res.openRows = op() ? op().querySelectorAll('.mf-oi').length : 0;
    const n0 = ins.length;
    _mfPickDept('מעצבים'); // same dept: nothing reset
    mgrFieldClosePrev('th-3');
    res.closeUpd = ins.slice(n0).find((x) => x[0] === 'upd:tour_hazards');
    res.afterClose = op() && op().textContent;
    res.keptTyping = document.getElementById('mf-descr').value;
    mgrFieldReopen('th-3');
    res.reopen = ins.slice(-1)[0];
    res.afterReopen = op() && op().textContent;
    _mfPickDept('תוצג');
    res.none = ov.querySelector('.mf-list') && ov.querySelector('.mf-list').textContent;
    // trustee findings of the department
    window.fetch = function () { window._vitre = (window._vitre || 0) + 1; return new Promise(function () {}); };
    DB.tasks = [{ id: 'tk1', source_table: 'trustee_reports', source_id: 'tr-2', due: '2026-10-04', ts: '2026-09-28' }];
    DB.trustee_reports = [
      { id: 'tr-0', ok: false, t: 2, loc: 'חומר גלם · מחסן', f: 'לא רלוונטי כאן', u: 'דני', d: '2026-09-01', s: 'פתוח', mgr_note: 'לא רלוונטי: אזעקה' },
      { id: 'tr-1', ok: false, t: 3, loc: 'חומר גלם · רמפה', f: 'משטח שבור', u: 'דני', d: '2026-09-20', ts: '2026-09-20T08:00:00Z', s: 'פתוח', mgr_note: 'Vitre SMS #55 · נותב לאחזקה עד 30/09/2026 (מייל)' },
      { id: 'tr-2', ok: false, t: 4, loc: 'חומר גלם', f: 'נורה שרופה', u: 'רוני', d: '2026-09-22', ts: '2026-09-22T08:00:00Z', s: 'פתוח' },
      { id: 'tr-3', ok: true, t: 4, loc: 'חומר גלם', f: 'תקין', d: '2026-09-22', s: 'תקין' },
      { id: 'tr-4', ok: false, t: 5, loc: 'מעוצבים · קו 1', f: 'במחלקה אחרת', u: 'רוני', d: '2026-09-23', ts: '2026-09-23T08:00:00Z', s: 'פתוח' },
    ];
    _mfPickDept('חומר גלם');
    res.tru = op() && op().textContent;
    res.truRows = op() ? op().querySelectorAll('.mf-tru').length : 0;
    const n1 = ins.length;
    window._VITRE_SMS_ON = true; // off in production today; the ask path must still work when it is on
    mgrFieldClosePrev('tr-1');
    res.ask = op() && op().textContent; res.askIns = ins.length - n1;
    mgrFieldClosePrev('tr-1');
    res.truUpd = ins.slice(n1).find((x) => x[0] === 'upd:trustee_reports');
    res.truAfter = op() && op().textContent;
    window._VITRE_SMS_ON = false;
    mgrFieldReopen('tr-1');
    res.truReopen = ins.slice(-1)[0];
    const n2 = ins.length;
    mgrFieldClosePrev('tr-2');
    res.noVitre = ins.slice(n2).find((x) => x[0] === 'upd:trustee_reports');
    _mfPickDept('מעצבים');
    res.alias = op() && op().textContent;
    _mfPickDept('מעצבים');
    mgrFieldFinish();
    res.finish = ov.textContent;
    mgrFieldNewTour();
    res.reset = !ov.querySelectorAll('.mf-chips')[0].querySelector('.on') && !ov.querySelector('.mf-open');
    mgrFieldClose(); res.closed = ov.style.display === 'none' && window._went === 'thz';
    res.tourBtn = !!document.querySelector('#pg-thz [onclick="mgrFieldOpen()"]');
    res.topBtn = !!document.querySelector('.topbar #mf-btn[onclick="mgrFieldOpen()"]');
    res.sheetBtn = Array.from(document.querySelectorAll('#m-modules-sheet .sheet-btn')).some((b) => /mgrFieldOpen/.test(b.getAttribute('onclick')) && /ממשק ממונה הבטיחות/.test(b.textContent));
    const tb = document.querySelector('.topbar'); res.topFits = tb && tb.scrollWidth <= tb.clientWidth + 1;
    return res;
  });
  check('opens full screen; the landing flag is used once', out.open, out.open);
  check('the 5 departments as big buttons', out.chips.length === 5, out.chips);
  check('fits a 375px phone (no sideways scroll)', out.noScroll);
  check('no department: refused', out.ins0 === 0 && /מחלקה/.test(out.noDept), out.noDept);
  check('no description: refused', out.ins1 === 0 && /תיאור/.test(out.noDescr), out.noDescr);
  check('a new department today: the next tour number (11), shown on top', /סיור מס' 11/.test(out.sub), out.sub);
  check('what was typed survives tapping a chip', out.keptDescr === 'כבל חשוף', out.keptDescr);
  const r = out.first && out.first[1];
  check('saved to tour_hazards: today, tour 11, next מס"ד (8), open, severity picked', out.first && out.first[0] === 'tour_hazards' && r.d === out.today && r.tour_no === 11 && r.n === 8 && r.s === 'פתוח' && r.sev === 'גבוהה' && r.dept === 'תוצג' && r.loc === 'מחסן' && r.resp === 'מנהל המחלקה', r);
  check('empty fields are null, never ""', r && r.action === null && r.due === null && r.notes === null && r.photo_url === null && r.closed_d === null, r);
  check('after saving: the hazard fields clear, the department stays', out.cleared && out.keptDept === 'תוצג', out.keptDept);
  check('the next hazard of the same tour: same tour number, next מס"ד', out.second && out.second[1].tour_no === 11 && out.second[1].n === 9 && out.second[1].sev === 'גבוהה', out.second);
  check('a department already toured today keeps that tour number (10)', out.third && out.third[1].tour_no === 10 && out.third[1].dept === 'מעצבים', out.third);
  check('the tour list: this tour\'s hazards, the one saved earlier today included', /מפגעי הסיור הזה \(2\)/.test(out.list || '') && /מהסיור של היום/.test(out.list) && /עוד אחד/.test(out.list) && /סיום סיור/.test(out.list), out.list);
  check('open hazards of the department from earlier tours, closed ones left out', out.openRows === 1 && /מפגעים פתוחים במעצבים \(1\)/.test(out.openTxt || '') && /פתוח מסיור קודם/.test(out.openTxt) && /קו 2/.test(out.openTxt) && !/כבר סגור/.test(out.openTxt), out.openTxt);
  check('an overdue one is marked', /באיחור/.test(out.openTxt || ''), out.openTxt);
  const cu = out.closeUpd && out.closeUpd[1];
  check('"נסגר" updates the row: closed, closed today', cu && cu.id === 'th-3' && cu.s === 'סגור' && cu.closed_d === out.today, cu);
  check('it stays listed with "בטל", the count drops, the typing survives', /\(0\)/.test(out.afterClose || '') && /בטל/.test(out.afterClose) && out.keptTyping === 'בכתיבה', [out.afterClose, out.keptTyping]);
  check('"בטל" reopens it: open, closed_d null', out.reopen && out.reopen[1].s === 'פתוח' && out.reopen[1].closed_d === null && /\(1\)/.test(out.afterReopen || ''), out.reopen);
  check('trustee findings of the department: not-relevant, OK and other departments left out', out.truRows === 2 && /\(2\)/.test(out.tru || '') && /נ-1\. משטח שבור/.test(out.tru) && /נ-2\. נורה שרופה/.test(out.tru) && /רמפה/.test(out.tru) && /נאמן דני/.test(out.tru) && !/לא רלוונטי כאן|תקין|במחלקה אחרת/.test(out.tru), out.tru);
  check('trustee due: the routed note (30/09), the routed task (04/10)', /יעד 30\/09\/2026/.test(out.tru || '') && /יעד 04\/10\/2026/.test(out.tru), out.tru);
  check('closing a trustee finding asks first (it closes Vitre too), nothing written yet', /לסגור\?/.test(out.ask || '') && /Vitre/.test(out.ask) && out.askIns === 0, out.ask);
  const tu = out.truUpd && out.truUpd[1];
  check('the second tap closes it: נסגר, closed today, stays listed with "בטל"', tu && tu.id === 'tr-1' && tu.s === 'נסגר' && tu.closed_d === out.today && /\(1\)/.test(out.truAfter || '') && /בטל/.test(out.truAfter), [tu, out.truAfter]);
  check('"בטל" reopens the trustee finding, closed_d null', out.truReopen && out.truReopen[0] === 'upd:trustee_reports' && out.truReopen[1].s === 'פתוח' && out.truReopen[1].closed_d === null, out.truReopen);
  check('no Vitre task: one tap closes it', out.noVitre && out.noVitre[1].id === 'tr-2' && out.noVitre[1].s === 'נסגר', out.noVitre);
  check('"מעוצבים" in a trustee loc counts as מעצבים', /במחלקה אחרת/.test(out.alias || ''), out.alias);
  check('a department with nothing open says so', /אין מפגעים פתוחים/.test(out.none || ''), out.none);
  check('"סיום סיור": tour, department, count and severities', /הסיור נשמר/.test(out.finish) && /סיור מס' 10/.test(out.finish) && /2 מפגעים/.test(out.finish), out.finish);
  check('"סיור חדש" starts clean', out.reset);
  check('"למערכת" closes it and shows the tours screen', out.closed);
  check('the tours screen has a button to open it too', out.tourBtn);
  check('after signing in: a 📋 button in the top bar and a line in the ☰ menu open it again', out.topBtn && out.sheetBtn, [out.topBtn, out.sheetBtn]);
  check('the top bar still fits a 375px phone', out.topFits);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
