// "No defect" written in the deficiencies column (10/10/2026, Michael: "items valid in the
// folders show with a defect in the app"). Reports put the verdict there: 33 history rows say
// "כשיר לעבודה", 26 say "אין ליקויים". The history list drew each one as an orange warning, and two
// clean reports in a row matched each other as a red "repeat defect" banner.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(700);

  const u = await page.evaluate(() => ({
    clean: ['כשיר לעבודה', 'אין ליקויים', 'אין', 'תקין', 'תקין - אין ליקויים', 'ללא ליקויים', '', null, ' כשיר לעבודה. '].map(_eqiNoDef),
    real: ['יש להחליף שרשרת', 'כשיר לעבודה - יש להצמיד לבמה במפלס התחתון', '1. להתקין ניקוז לשסתום בטחון', 'אין ליקויים; שסתומי ביטחון 1+2 נפתחו ב-10 ו-9 אטמ'].map(_eqiNoDef),
  }));
  check('verdict texts count as no defect', u.clean.every(Boolean), u.clean);
  check('real defects and remarks still count as defects', u.real.every((x) => !x), u.real);

  const render = (rows) => page.evaluate((rows) => {
    let box = document.getElementById('eqi-history-list');
    if (!box) { box = document.createElement('div'); box.id = 'eqi-history-list'; document.body.appendChild(box); }
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(rows) });
    _eqiHistoryLoad('x1');
    return new Promise((res) => setTimeout(() => res(box.innerHTML), 150));
  }, rows);

  const clean = await render([
    { id: 'h1', inspection_date: '2026-10-03', expiry_date: '2027-10-03', deficiencies: 'כשיר לעבודה', status: 'כשיר לעבודה' },
    { id: 'h2', inspection_date: '2025-10-03', expiry_date: '2026-10-03', deficiencies: 'כשיר לעבודה', status: 'כשיר לעבודה' },
    { id: 'h3', inspection_date: '2024-10-03', expiry_date: '2025-10-03', deficiencies: 'אין ליקויים', status: 'תקין' },
  ]);
  check('clean reports: no warning sign', clean.indexOf('⚠') < 0, clean.slice(0, 300));
  check('clean reports: no repeat-defect banner', clean.indexOf('#fee2e2') < 0);
  check('the rows themselves still show', (clean.match(/תוקף/g) || []).length === 3);

  const bad = await render([
    { id: 'h1', inspection_date: '2026-10-03', deficiencies: 'יש להחליף שרשרת הרמה', status: 'לתקן' },
    { id: 'h2', inspection_date: '2025-10-03', deficiencies: 'להחליף שרשרת הרמה שחוקה', status: 'לתקן' },
    { id: 'h3', inspection_date: '2024-10-03', deficiencies: 'כשיר לעבודה', status: 'כשיר לעבודה' },
  ]);
  check('a real defect still shows with a warning', bad.indexOf('⚠ יש להחליף שרשרת') >= 0);
  check('a real repeat still raises the red banner', bad.indexOf('#fee2e2') >= 0);
  check('...and the clean row in between is not flagged', bad.indexOf('⚠ כשיר') < 0);
  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
