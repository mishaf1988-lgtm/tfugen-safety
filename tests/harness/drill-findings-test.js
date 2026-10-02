// BACKLOG 9.7, the code part: a drill's findings had nowhere to go but the
// notes. Each finding row in the drill form is now a task (source_table drl,
// source_id the drill), the list shows how many are still open, and every
// opening of the form starts with one empty row, so a cancelled form never
// opens tasks on the next save.
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
    DB.drl = []; DB.tasks = [];
    window.__ins = []; window.sbIns = function (t, r) { window.__ins.push({ t: t, r: r }); };
    window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toast = ''; window.toast = function (m) { window.__toast = m; };
    window._currentUser = { username: 'admin' }; _isAdmin = true;
  });
  const fill = (rows) => page.evaluate((rows) => {
    rows.forEach((x, i) => {
      if (i) _drlFndRow();
      const r = document.querySelectorAll('#drl-fnd .drl-fr')[i];
      r.querySelector('.drl-ft').value = x[0]; r.querySelector('.drl-fa').value = x[1]; r.querySelector('.drl-fu').value = x[2];
    });
  }, rows);

  console.log('\n1. a new drill with findings');
  await page.evaluate(() => { openModal('m-drl'); document.getElementById('drl-ty').selectedIndex = 0; document.getElementById('drl-d').value = '2026-10-01'; });
  check('the form opens with one empty finding row', await page.evaluate(() => document.querySelectorAll('#drl-fnd .drl-fr').length === 1));
  await fill([['יציאת חירום חסומה', 'אחזקה', '2026-10-15'], ['', 'x', ''], ['  צופר לא נשמע  ', '', '']]);
  let r = await page.evaluate(() => { svDrl(); return { drl: DB.drl.slice(), tasks: DB.tasks.slice(), ins: window.__ins.filter((x) => x.t === 'tasks').length, toast: window.__toast }; });
  const d1 = r.drl[0];
  check('one drill saved', r.drl.length === 1 && !!d1.id, r.drl);
  check('two tasks: the row with no finding is skipped', r.tasks.length === 2 && r.ins === 2, r.tasks);
  check('each task: the finding, its owner and target, open, linked to the drill', r.tasks[0].title === 'יציאת חירום חסומה' && r.tasks[0].assignee === 'אחזקה' && r.tasks[0].due === '2026-10-15'
    && r.tasks.every((t) => t.source_table === 'drl' && t.source_id === d1.id && t.status === 'פתוח'), r.tasks);
  check('trimmed, empty owner and target are null (rule 2)', r.tasks[1].title === 'צופר לא נשמע' && r.tasks[1].assignee === null && r.tasks[1].due === null, r.tasks[1]);
  check('the toast says how many tasks', /2 משימות/.test(r.toast), r.toast);

  console.log('\n2. the list and the tasks page');
  r = await page.evaluate(() => { rDrl(); return document.getElementById('tb-drl').textContent; });
  check('the drill row: 2 open of 2', r.includes('ממצאים: 2 פתוחים מתוך 2'), r);
  r = await page.evaluate(() => { DB.tasks[0].status = _TSK_DONE; rDrl(); return document.getElementById('tb-drl').textContent; });
  check('one done: 1 open of 2', r.includes('ממצאים: 1 פתוחים מתוך 2'), r);
  r = await page.evaluate(() => ({ lbl: _tskSrcLabel('drl'), icon: _sourceIcon('drl') }));
  check('the task source reads "תרגיל חירום", with its own icon', r.lbl === 'תרגיל חירום' && r.icon === '🧯', r);

  console.log('\n3. no stale rows');
  await page.evaluate(() => { openModal('m-drl'); });
  await fill([['לא לשמור', 'x', '']]);
  await page.evaluate(() => { closeModal('m-drl'); openModal('m-drl'); });
  r = await page.evaluate(() => [...document.querySelectorAll('#drl-fnd .drl-ft')].map((x) => x.value));
  check('cancel and open again: one empty row, the cancelled finding gone', r.length === 1 && r[0] === '', r);
  r = await page.evaluate((id) => { _genEdit('drl', id); const rows = document.querySelectorAll('#drl-fnd .drl-fr').length; document.getElementById('drl-n').value = 'עודכן'; svDrl(); return { rows, n: DB.drl.length, tasks: DB.tasks.length, notes: DB.drl[0].n }; }, d1.id);
  check('editing the drill: one empty row, saved in place, no new task', r.rows === 1 && r.n === 1 && r.tasks === 2 && r.notes === 'עודכן', r);

  console.log('\n4. the review decisions card: a real red circle');
  r = await page.evaluate(() => _MR_DEC_LBL.late);
  check('"late" starts with the red circle, not U+1F53', r.indexOf('🔴') === 0, r);

  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
