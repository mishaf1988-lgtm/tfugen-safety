// BACKLOG 12.3 (09/10/2026, ISO 45001 8.1.4.2): the permit's contractor is checked against the
// contractor register: a pick-list from DB.ctr, and a warning (not a block) when the contractor
// is not in the register, the agreement expired or has no date, or training is not "הוכשר".
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
    window.sdb = function () {}; window.addLog = function () {}; window.sbIns = function () {}; window.sbUpd = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    const inD = (n) => new Date(Date.now() + n * 864e5).toISOString().split('T')[0];
    DB.ctr = [
      { id: 'a', n: 'חשמל השרון', e: inD(100), tr: 'הוכשר' },
      { id: 'b', n: 'מנופי הדרום', e: inD(-10), tr: 'הוכשר' },
      { id: 'c', n: 'צבע ושיפוצים', e: inD(50), tr: 'לא הוכשר' },
      { id: 'd', n: 'ריתוך כהן', e: null, tr: 'הוכשר' },
    ];
    DB.ptw = DB.ptw || [];
    const out = {};
    out.ok = _ptwConIssue('חשמל השרון');
    out.okCase = _ptwConIssue('  חשמל השרון ');
    out.expired = _ptwConIssue('מנופי הדרום');
    out.untrained = _ptwConIssue('צבע ושיפוצים');
    out.noDate = _ptwConIssue('ריתוך כהן');
    out.unknown = _ptwConIssue('קבלן חדש');
    out.empty = _ptwConIssue('');
    _ptwConFill();
    out.list = [].map.call(document.querySelectorAll('#ptw-con-list option'), (o) => o.value);
    g('ptw-con').value = 'מנופי הדרום'; out.warnShown = _ptwConCheck(); out.warnHtml = g('ptw-con-warn').innerHTML;
    const before = DB.ptw.length;
    svPtw();
    out.saved = DB.ptw.length === before + 1 && DB.ptw[DB.ptw.length - 1].con === 'מנופי הדרום';
    out.toast = window.__toasts.slice(-1)[0];
    out.cleared = g('ptw-con-warn').innerHTML === '';
    return out;
  });
  check('a registered, trained contractor with a valid agreement: no warning', r.ok === '' && r.okCase === '', r);
  check('expired agreement: named with its date', /ההסכם פג ב-\d\d\/\d\d\/\d{4}/.test(r.expired), r.expired);
  check('training not "הוכשר": named with the status', /הדרכת בטיחות: לא הוכשר/.test(r.untrained), r.untrained);
  check('no agreement date: said so', /אין תאריך תוקף להסכם/.test(r.noDate), r.noDate);
  check('not in the register: said so', r.unknown === 'הקבלן לא במרשם הקבלנים', r.unknown);
  check('an empty field: no warning yet (the required-field alert handles it)', r.empty === '', r.empty);
  check('the pick-list holds the four register names', r.list.length === 4 && r.list.indexOf('ריתוך כהן') >= 0, r.list);
  check('typing a problem contractor shows the warning under the field', /ההסכם פג/.test(r.warnShown) && /⚠️/.test(r.warnHtml), r.warnHtml);
  check('the permit still saves (a warning, not a block)', r.saved, r);
  check('the save toast carries the warning', /ההרשאה נשמרה, שים לב: ההסכם פג/.test(r.toast), r.toast);
  check('the warning under the field is cleared after saving', r.cleared);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
