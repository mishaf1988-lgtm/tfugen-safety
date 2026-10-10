// A weekly talk for one department (10/10/2026, Michael: "כרגע זה רק למחלקות"): the form offers
// the departments of the workers on the list, edit brings it back, the list shows it and counts
// "signed / workers of that department", and "did not sign" lists only that department.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = []; window.sbIns = (t, x) => ins.push(JSON.parse(JSON.stringify(x))); window.sbUpd = (t, x) => ins.push(JSON.parse(JSON.stringify(x))); window.toast = () => {};
    _currentUser = { username: 'admin' };
    DB.emp = [{ id: 'e1', n: 'אחמד', dep: 'יצור' }, { id: 'e2', n: 'דנה', dep: 'יצור' }, { id: 'e3', n: 'יוסי', dep: 'אריזה' }, { id: 'e4', n: 'עזב', dep: 'מעבדה', left_d: '2026-01-01' }];
    DB.toolbox_talks = []; DB.toolbox_reads = [];
    goPage('toolbox');
    const o = {};
    openModal('m-tbt');
    o.opts = Array.from(document.getElementById('tbt-dept').options).map((x) => x.value);
    document.getElementById('tbt-title').value = 'מסועים'; document.getElementById('tbt-body').value = 'x';
    document.getElementById('tbt-trainer').value = 'מיכאל'; document.getElementById('tbt-trainer-q').value = 'ממונה';
    document.getElementById('tbt-s').value = 'פורסמה'; document.getElementById('tbt-dept').value = 'טוגנים';
    svTbt(); const t = ins.slice(-1)[0]; o.dept = t.dept;
    openModal('m-tbt'); o.newEmpty = document.getElementById('tbt-dept').value; closeModal('m-tbt');
    _genEdit('toolbox_talks', t.id); o.edit = document.getElementById('tbt-dept').value; closeModal('m-tbt');
    DB.toolbox_reads = [{ id: 'r1', talk_id: t.id, emp_id: 'e1', emp_name: 'אחמד', dept: 'יצור', read_at: '2026-10-11T07:00:00Z' }, { id: 'r2', talk_id: t.id, emp_id: 'e3', emp_name: 'יוסי', dept: 'אריזה', read_at: '2026-10-11T07:05:00Z' }];
    rTbt();
    const row = Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes('מסועים'));
    o.tag = row.textContent.includes('טוגנים'); o.count = row.querySelector('[onclick^="tbtWho"]').textContent.trim();
    tbtWho(t.id); const wb = document.getElementById('tbt-who-body').textContent;
    o.who = { dana: wb.includes('דנה'), yossiMissing: /לא חתמו[\s\S]*יוסי/.test(wb.split('בדיקת אפקטיביות')[0].split('לא חתמו').slice(-1)[0] || ''), missN: (wb.match(/לא חתמו: (\d+)/) || [])[1] };
    // a whole-plant talk still counts everyone
    openModal('m-tbt'); document.getElementById('tbt-title').value = 'כללי'; document.getElementById('tbt-body').value = 'x'; document.getElementById('tbt-trainer').value = 'מיכאל'; document.getElementById('tbt-trainer-q').value = 'ממונה'; document.getElementById('tbt-s').value = 'פורסמה'; svTbt();
    rTbt(); const row2 = Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes('כללי'));
    o.all = row2.querySelector('[onclick^="tbtWho"]').textContent.trim(); o.allDept = ins.slice(-1)[0].dept;
    return o;
  });
  check('the select: whole plant, then the seven training departments of the forms', JSON.stringify(r.opts) === JSON.stringify(['', 'טוגנים', 'מעוצבים', 'אריזה', 'חומר גלם', 'תוצ"ג ומחסנים', 'מעבדה', 'אחזקה וחשמל']), r.opts);
  check('saved with its training department', r.dept === 'טוגנים', r.dept);
  check('a new form starts at "whole plant"; edit brings the department back', r.newEmpty === '' && r.edit === 'טוגנים', r);
  check('the list shows the department and counts its workers (card "יצור" = טוגנים) only (1 / 2)', r.tag && r.count === '1 / 2', r.count);
  check('"did not sign": only the department (Dana), not Yossi from packing', r.who.dana && r.who.missN === '1' && !r.who.yossiMissing, r.who);
  check('a whole-plant talk saves no department and counts all current workers', r.allDept === null && /\/ 3$/.test(r.all), r.all);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
