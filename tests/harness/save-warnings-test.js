// BACKLOG 12.4 / 12.5 (09/10/2026): two save-time warnings, never a block.
// 12.4: a document saved "בתוקף" with no expiry. 12.5: an equipment item whose serial number
// is already on another item. Also: editing an item keeps the columns the form does not hold.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'michael' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {}; window.sbIns = function () {};
    window.__upd = []; window.sbUpd = function (t, x) { window.__upd.push([t, JSON.parse(JSON.stringify(x))]); };
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    const last = () => window.__toasts.slice(-1)[0];
    const out = {};
    DB.docs = [];
    const doc = (s, e) => { g('d-n').value = 'רישיון עסק'; g('d-s').value = s; g('d-e').value = e || ''; svDoc(); return last(); };
    out.docNoDate = doc('בתוקף', '');
    out.docDated = doc('בתוקף', '2027-01-01');
    out.docReview = doc('בסקירה', '');
    out.docsSaved = DB.docs.length;
    DB.equip_inspections = [
      { id: 'a', n: 'מלגזה 1', serial_number: 'SN-77', deficiencies: 'שלט חסר', report_number: 'R1', s: 'תקין' },
      { id: 'b', n: 'מלגזה 2', serial_number: ' sn-77 ', s: 'תקין' },
      { id: 'c', n: 'במה', serial_number: 'X-1', s: 'תקין' },
    ];
    const edit = (id) => { g('eqi-id').value = id; g('eqi-n').value = DB.equip_inspections.find((x) => x.id === id).n; svEqi(); return last(); };
    out.eqDup = edit('a');
    out.eqUnique = edit('c');
    const a = DB.equip_inspections.find((x) => x.id === 'a');
    out.kept = a.serial_number === 'SN-77' && a.deficiencies === 'שלט חסר' && a.report_number === 'R1';
    out.sentOnlyForm = !('deficiencies' in window.__upd[0][1]);
    return out;
  });
  check('"בתוקף" with no expiry: saved, and the toast says so', /מסמך "בתוקף" בלי תאריך תפוגה/.test(r.docNoDate), r.docNoDate);
  check('"בתוקף" with an expiry: the plain toast', !/שים לב/.test(r.docDated), r.docDated);
  check('"בסקירה" with no expiry: no warning', !/שים לב/.test(r.docReview), r.docReview);
  check('all three documents were saved (a warning, not a block)', r.docsSaved === 3, r.docsSaved);
  check('a serial number on another item: the toast names that item (case and spaces ignored)', /המספר הסידורי כבר רשום בפריט אחר: מלגזה 2/.test(r.eqDup), r.eqDup);
  check('a unique serial number: the plain toast', !/שים לב/.test(r.eqUnique), r.eqUnique);
  check('editing keeps serial, defect and report in the local row', r.kept, r);
  check('...while the update still sends only the form fields', r.sentOnlyForm);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
