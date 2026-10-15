// Annual training plan, form 08.01, as a screen (15/10/2026).
// Michael in the questionnaire: all 30 items, done marked automatically and by hand, a target
// quarter per item, a screen plus the form 08.01 to print. Automatic = an annual or quality talk
// that was CLOSED in the app and whose subjects cover the item (_TP_AUTO); by hand = train_plan.done.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const COLS = require('./db-columns.json');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };

(async () => {
  // static: the table is in every list it must be in to sync and survive a reload
  for (const [k, re] of Object.entries({ ldb: /function ldb\(\)\{[\s\S]*?\]\.forEach/, syncTbls: /var syncTbls=\[[^\]]*\]/, tsCol: /var _sbTsCol=\{[^}]*\}/, dbInit: /var DB=\{[^}]*\}/ })) {
    check(k + ' has train_plan', (SRC.match(re) || [''])[0].includes('train_plan'));
  }
  check('both sbSync lists have train_plan', (SRC.match(/var tbls=\[[^\]]*'train_plan'[^\]]*\]/g) || []).length === 2);
  check('db-columns.json has train_plan with every column the app writes', ['id', 'yr', 'n', 't', 'who', 'aud', 'q', 'done', 'ts'].every((c) => (COLS.train_plan || []).includes(c)), COLS.train_plan);

  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => (r.request().url().startsWith('file://') ? r.continue() : r.abort()));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    window.sdb = () => {}; window.addLog = () => {};
    const ins = [], upd = [], toasts = [];
    window.sbIns = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]);
    window.sbUpd = (t, x) => upd.push([t, JSON.parse(JSON.stringify(x))]);
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' };
    window._role = () => 'admin';
    DB.train_plan = []; DB.toolbox_talks = [];
    _tpYr = 2026;
    const o = {};
    goPage('training');
    const card = () => document.getElementById('tp-card');
    o.inPage = document.getElementById('pg-training').contains(card());
    o.emptyText = card().textContent;
    // 1. create the year from the form
    _tpCreate();
    const rows = _tpRows(2026);
    o.n = rows.length; o.nums = rows.map((x) => x.n).join(',');
    o.ins = ins.filter((x) => x[0] === 'train_plan').length;
    o.r28 = rows.find((x) => x.n === 28); o.r30 = rows.find((x) => x.n === 30);
    o.again = (_tpCreate(), _tpRows(2026).length);
    // 2. quarters, and talks in the app
    const by = (n) => _tpRows(2026).find((x) => x.n === n);
    by(28).q = '1,3'; by(1).q = '2'; by(5).q = '4'; by(12).q = '1';
    DB.toolbox_talks = [
      { id: 'a1', kind: 'annual', title: 'הדרכת בטיחות שנתית 2026', trainer: 'מיכאל פרייליך', closed_at: '2026-02-10T09:00:00Z', subjects: 'חשמל\nאיכות סביבה' },
      { id: 'q1', kind: 'quality', title: 'הדרכת איכות', trainer: 'מנהלת איכות', closed_at: '2026-05-01T09:00:00Z', subjects: 'GMP והיגיינה אישית\nאלרגנים' },
      { id: 'q2', kind: 'quality', title: 'פתוחה', trainer: 'x', closed_at: null, subjects: 'HACCP' },
      { id: 'w1', kind: '', title: 'שבועית', closed_at: '2026-03-01T09:00:00Z' },
    ];
    const T = '2026-10-15';
    o.st28 = _tpState(by(28), T); o.done28 = _tpDone(by(28));
    o.st1 = _tpState(by(1), T); o.st11 = _tpState(by(11), T); o.st29 = _tpState(by(29), T);
    by(10).q = '2'; o.st10 = _tpState(by(10), T); by(10).q = null;
    o.st12 = _tpState(by(12), T); o.st5 = _tpState(by(5), T); o.st2 = _tpState(by(2), T);
    // 3. by hand: item 5, Q4
    _tpOpen(by(5).id);
    o.modal = document.getElementById('m-tp').style.display;
    document.getElementById('tp-dd').value = '2025-11-01'; _tpDoneAdd(); o.wrongYear = by(5).done.length;
    document.getElementById('tp-dd').value = '2026-10-12'; document.getElementById('tp-dby').value = 'חברה חיצונית'; _tpDoneAdd();
    o.hand = by(5).done; o.st5b = _tpState(by(5), T); o.upd = upd.filter((x) => x[0] === 'train_plan').length;
    o.sum = _tpSum(_tpRows(2026), T);
    // 4. edit an item: quarters from the checkboxes
    _tpOpen(by(2).id); document.getElementById('tp-q2').checked = true; document.getElementById('tp-q3').checked = true; _tpSave();
    o.q2 = by(2).q;
    // 5. the screen and the form
    rTp(); o.cardText = card().textContent;
    o.form = _tpFormHtml(2026);
    try { showView('train_plan', by(28).id); o.view = document.body.textContent.includes('תכנית ההדרכות השנתית'); } catch (e) { o.view = String(e); }
    goPage('training');
    // 6. next year starts from this one: same items and quarters, nothing done
    _tpYr = 2027; _tpCreate();
    const y27 = _tpRows(2027);
    o.y27 = { n: y27.length, q28: (y27.find((x) => x.n === 28) || {}).q, done: y27.every((x) => Array.isArray(x.done) && !x.done.length), st28: _tpState(y27.find((x) => x.n === 28), '2027-01-05') };
    // 7. a viewer sees the plan and cannot change it
    window._role = () => 'viewer'; _tpYr = 2028; rTp();
    o.viewer = { create: /צור את/.test(card().textContent) };
    _tpCreate(); o.viewer.rows = _tpRows(2028).length;
    _tpYr = 2026; rTp(); o.viewer.edit = !!card().querySelector('[onclick^="_tpOpen"]');
    return o;
  });
  check('the plan is a card on the training page; empty year offers to create it from the form', r.inPage && /אין עדיין תכנית לשנת 2026/.test(r.emptyText) && /מטופס 08.01/.test(r.emptyText), r.emptyText);
  check('created from the form: 30 items numbered 1-30, each sent to the server once', r.n === 30 && r.nums === Array.from({ length: 30 }, (_, i) => i + 1).join(',') && r.ins === 30, [r.n, r.ins]);
  check('item 28 is the safety training, item 30 the "as needed" line', /הדרכות בטיחות/.test(r.r28.t) && /ממונה בטיחות/.test(r.r28.who) && /לפי צרכים/.test(r.r30.t));
  check('creating twice does not duplicate', r.again === 30, r.again);
  check('a closed annual talk marks item 28 in its quarter, with the trainer', r.done28.length === 1 && r.done28[0].d === '2026-02-10' && r.done28[0].by === 'מיכאל פרייליך' && r.done28[0].src === 'talk', r.done28);
  check('item 28 planned for Q1 and Q3, given only in Q1, in Q4: late', r.st28 === 'late', r.st28);
  check('a closed quality talk with the GMP subject marks item 1 (planned Q2, given Q2): done', r.st1 === 'done', r.st1);
  check('an item with no quarter that was given anyway (allergens, environment) counts as done', r.st11 === 'done' && r.st29 === 'done', [r.st11, r.st29]);
  check('a closed quality talk not on the item\'s subject does not count (security, planned Q2): late', r.st10 === 'late', r.st10);
  check('a talk not closed yet does not count (HACCP, planned Q1): late', r.st12 === 'late', r.st12);
  check('no quarter and never given: not scheduled; a quarter still ahead: planned', r.st2 === 'none' && r.st5 === 'plan', [r.st2, r.st5]);
  check('by hand: the edit window opens; a date in another year is refused', r.modal === 'block' && r.wrongYear === 0, [r.modal, r.wrongYear]);
  check('by hand: date and instructor saved, the item is done, the row goes to the server', r.hand.length === 1 && r.hand[0].d === '2026-10-12' && r.hand[0].by === 'חברה חיצונית' && r.st5b === 'done' && r.upd >= 1, [r.hand, r.st5b, r.upd]);
  check('percent: done out of the items with a quarter (28 late, 1 done, 5 done, 12 late)', r.sum.planned === 4 && r.sum.done === 2 && r.sum.late === 2 && r.sum.pct === 50, r.sum);
  check('editing an item saves the quarters from the checkboxes', r.q2 === '2,3', r.q2);
  check('the screen shows the percent (item 2 now planned Q2: 5 planned, 3 late), the late count and the 08.01 print button', /40% בוצע: 2 מתוך 5/.test(r.cardText) && /באיחור/.test(r.cardText) && /טופס 08.01 להדפסה/.test(r.cardText), r.cardText.slice(0, 200));
  check('the form: title, a column per quarter, the date and instructor in the quarter, "planned" where nothing yet, sign-off lines',
    /תכנית הדרכות שנתית לשנת 2026/.test(r.form) && /רבעון 4/.test(r.form) && /תאריך: 10\/02\/2026<br>מדריך: מיכאל פרייליך/.test(r.form) && /מתוכנן/.test(r.form) && /אושר ע"י: מנהלת איכות/.test(r.form), r.form.slice(0, 300));
  check('the eye opens the item (VIEW_CONFIG)', r.view === true, r.view);
  check('next year: copied from this year with its quarters, nothing done', r.y27.n === 30 && r.y27.q28 === '1,3' && r.y27.done && r.y27.st28 === 'plan', r.y27);
  check('a viewer: no create button, create does nothing, no edit buttons', !r.viewer.create && r.viewer.rows === 0 && !r.viewer.edit, r.viewer);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
