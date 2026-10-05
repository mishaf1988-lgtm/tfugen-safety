// Effectiveness check of a weekly talk (05/10/2026), as on the paper form 08.01: required,
// effective, date, what was checked, follow-up, by whom. Shown as text in "who signed"
// (so the print has it), edited in a screen-only form; empty dates stay null.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const COLS = require('./db-columns.json');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  check('db-columns.json has the six eff_ columns', ['eff_req', 'eff_ok', 'eff_d', 'eff_desc', 'eff_next', 'eff_by'].every((c) => COLS.toolbox_talks.includes(c)));
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    window.sdb = function () {}; window._signifyDom = undefined;
    const upd = [], toasts = [];
    window.sbUpd = (t, x) => upd.push(JSON.parse(JSON.stringify(x)));
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'michael' };
    DB.toolbox_reads = [];
    DB.toolbox_talks = [{ id: 'a', d: '2026-10-04', title: 'רעש', body: 'x', s: 'פורסמה', trainer: 'מיכאל', trainer_qual: 'ממונה' }];
    const o = {};
    tbtWho('a');
    const body = () => document.getElementById('tbt-who-body');
    o.empty = body().textContent;
    o.formNoPrint = !!body().querySelector('details.no-print #tbt-eff-req');
    o.dateStart = document.getElementById('tbt-eff-d').value;
    const set = (id, v) => { document.getElementById(id).value = v; };
    // not effective without a follow-up: refused
    set('tbt-eff-req', '1'); set('tbt-eff-ok', '0'); set('tbt-eff-d', '2026-10-12'); set('tbt-eff-desc', 'שאלתי 3 עובדים');
    o.noNext = [tbtEffSave('a'), toasts.slice(-1)[0], upd.length];
    // a result without a date: refused
    set('tbt-eff-ok', '1'); set('tbt-eff-d', '');
    o.noDate = [tbtEffSave('a'), toasts.slice(-1)[0], upd.length];
    // effective, with a date
    set('tbt-eff-req', '1'); set('tbt-eff-ok', '1'); set('tbt-eff-d', '2026-10-12'); set('tbt-eff-desc', 'שאלתי 3 עובדים'); set('tbt-eff-next', '');
    o.ok = tbtEffSave('a'); o.row = upd.slice(-1)[0]; o.sum = document.getElementById('tbt-eff-sum').textContent;
    // not required: result and date cleared
    set('tbt-eff-req', '0'); set('tbt-eff-ok', '1'); set('tbt-eff-d', '2026-10-12');
    tbtEffSave('a'); o.notReq = upd.slice(-1)[0]; o.sumNot = document.getElementById('tbt-eff-sum').textContent;
    return o;
  });
  check('a talk without a check says so', /בדיקת אפקטיביות/.test(r.empty) && /עוד לא נקבע/.test(r.empty), r.empty.slice(-120));
  check('the edit form is screen only (no-print)', r.formNoPrint);
  check('the check date starts empty (not today: no check was done yet)', r.dateStart === '', r.dateStart);
  check('not effective without a follow-up is refused', r.noNext[0] === false && /המשך טיפול/.test(r.noNext[1]) && r.noNext[2] === 0, r.noNext);
  check('a result without a date is refused', r.noDate[0] === false && /תאריך/.test(r.noDate[1]) && r.noDate[2] === 0, r.noDate);
  check('saved: required, effective, date, description, by whom; empty follow-up null', r.ok && r.row.eff_req === true && r.row.eff_ok === true && r.row.eff_d === '2026-10-12' && r.row.eff_desc === 'שאלתי 3 עובדים' && r.row.eff_next === null && r.row.eff_by === 'michael', r.row);
  check('the summary (and so the print) shows the result', /נדרשת\. אפקטיבי: כן, 12\/10\/2026/.test(r.sum) && /שאלתי 3 עובדים/.test(r.sum) && /michael/.test(r.sum), r.sum);
  check('not required: result and date cleared to null', r.notReq.eff_req === false && r.notReq.eff_ok === null && r.notReq.eff_d === null && /לא נדרשת/.test(r.sumNot), [r.notReq, r.sumNot]);
  check('no page errors', errors.length === 0, errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
