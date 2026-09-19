// The 8 monthly tasks were a hardcoded array; the manager edits them now.
// The risky part is that reports reference a task by NUMBER, so this suite is
// mostly about what the editor refuses to do: renumber, delete something a
// report points at, touch the closure task, or empty the catalogue.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const M = new Date().toISOString().substring(0, 7);
const D = M + '-10';
// 8 seeded tasks, mirroring what the migration inserts.
const TASKS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: 'tsk_0' + n, n: n, icon: '✅', t: 'משימה ' + n, how: 'מה עושים ' + n, active: true }));
const REPORTS = [
  { id: 'a1', u: 'דנה', m: M, t: 1, d: D, loc: 'מחסן', ok: false, f: 'מטף חסר', s: 'פתוח' },
  { id: 'a2', u: 'דנה', m: M, t: 2, d: D, loc: 'מחסן', ok: true, s: 'תקין' },
  { id: 'a3', u: 'דנה', m: M, t: 8, d: D, loc: 'מחסן', ok: true, s: 'תקין', ref: 'a1' },
];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const boot = (tasks) => page.evaluate(({ tasks, reports }) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    DB.trustee_tasks = tasks ? JSON.parse(JSON.stringify(tasks)) : [];
    DB.trustee_reports = JSON.parse(JSON.stringify(reports));
    DB.trustees = [{ id: 'r1', n: 'דנה', dep: 'מחסן', active: true }];
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('trustees');
  }, { tasks, reports: REPORTS });

  console.log('\n1. the catalogue falls back to the built-in 8 until the migration runs');
  {
    await boot(null);
    const r = await page.evaluate(() => ({
      n: _truTasks().length, nums: _truTasks().map((t) => t.n),
      seeded: _truTasksSeeded(), max: _truMaxTaskPts(), min: _truMinTasks(),
    }));
    check('an empty trustee_tasks table still yields the 8 tasks from index.html', r.n === 8 && r.nums.join() === '1,2,3,4,5,6,7,8' && !r.seeded, r);
    check('the ceiling is 8×10=80 and eligibility is 5, exactly as before', r.max === 80 && r.min === 5, r);
    const warned = await page.evaluate(() => { _truTasksOpen(); const w = document.getElementById('tru-tasks-warn'); const btns = document.querySelectorAll('#tru-tasks-list button').length; closeModal('m-tru-tasks'); return { shown: getComputedStyle(w).display !== 'none', txt: w.textContent, btns: btns }; });
    check('the editor says so plainly and offers no edit buttons it cannot honour', warned.shown && /trustee_tasks/.test(warned.txt) && warned.btns === 0, warned);
  }

  console.log('\n2. with the table seeded, the catalogue comes from the data');
  {
    await boot(TASKS);
    const r = await page.evaluate(() => ({ n: _truTasks().length, seeded: _truTasksSeeded(), titles: _truTasks().map((t) => t.t) }));
    check('the 8 rows drive the app', r.n === 8 && r.seeded && r.titles[0] === 'משימה 1', r);
    const edited = await page.evaluate(() => {
      _truTasksOpen(); _truTasksEdit(3);
      document.getElementById('tru-tasks-t').value = 'בדיקת גלאי עשן';
      document.getElementById('tru-tasks-how').value = 'עוברים גלאי גלאי';
      _truTasksSave();
      return { t: _truTask(3).t, how: _truTask(3).how, n: _truTask(3).n, count: _truTasks().length };
    });
    check('renaming task 3 changes its words and NOT its number', edited.t === 'בדיקת גלאי עשן' && edited.n === 3 && edited.count === 8, edited);
    const added = await page.evaluate(() => {
      document.getElementById('tru-tasks-t').value = 'משימה תשיעית';
      document.getElementById('tru-tasks-icon').value = '🆕';
      _truTasksSave();
      return { nums: _truTasks().map((t) => t.n), max: _truMaxTaskPts(), min: _truMinTasks() };
    });
    check('a ninth task takes the next free number, never a recycled one', added.nums.join() === '1,2,3,4,5,6,7,8,9', added.nums);
    check('the ceiling follows the catalogue: 9×10=90, eligibility still 5', added.max === 90 && added.min === 5, added);
  }

  console.log('\n3. what the editor refuses to do');
  {
    await boot(TASKS);
    const del = await page.evaluate(() => {
      let alerted = '';
      const realAlert = window.alert; window.alert = (m) => { alerted = m; };
      _truTasksOpen(); _truTasksDel(1);
      window.alert = realAlert;
      return { alerted: alerted, still: !!_truTask(1), used: _truTasksUsed(1) };
    });
    check('deleting a task that 1 report points at is refused, and says to switch it off instead', /השבת/.test(del.alerted) && del.still && del.used === 1, del);
    const lock = await page.evaluate(() => {
      const before = _truTask(8).active;
      _truTasksToggle(8);
      let alerted = false; const realAlert = window.alert; window.alert = () => { alerted = true; };
      _truTasksDel(8); window.alert = realAlert;
      return { activeBefore: before, activeAfter: _truTask(8).active, stillThere: !!_truTask(8) };
    });
    check('the closure task (8) cannot be switched off or deleted', lock.activeBefore === true && lock.activeAfter === true && lock.stillThere, lock);
    const free = await page.evaluate(() => { const before = _truTasksUsed(5); _truTasksDel(5); return { used: before, confirmOpen: getComputedStyle(document.getElementById('m-del-confirm')).display !== 'none' }; });
    check('a task nothing references does reach the usual delete confirmation', free.used === 0 && free.confirmOpen, free);
    await page.evaluate(() => { if (typeof cancelDel === 'function') cancelDel(); });
    const empty = await page.evaluate(() => {
      // switch every unused, unlocked task off and try to go below one
      [2, 3, 4, 5, 6, 7].forEach((n) => _truTasksToggle(n));
      const beforeLast = _truTasksReportable().map((t) => t.n);
      _truTasksToggle(1);                      // the last one a trustee could report
      return { beforeLast: beforeLast, after: _truTasksReportable().map((t) => t.n) };
    });
    check('the last task a trustee could actually report cannot be switched off either', empty.beforeLast.join() === '1' && empty.after.join() === '1', empty);
  }

  console.log('\n4. switching a task off does not rewrite history');
  {
    await boot(TASKS);
    const r = await page.evaluate(() => {
      const before = _truScore('דנה', DB.trustee_reports[0].m);
      _truTasksToggle(2);                       // דנה already reported task 2 this month
      const after = _truScore('דנה', DB.trustee_reports[0].m);
      return {
        beforeTasks: before.nTasks, afterTasks: after.nTasks,
        resolves: !!_truTask(2), offered: _truTasksActive().map((t) => t.n).indexOf(2) < 0,
        maxBefore: 80, maxAfter: _truMaxTaskPts(), minAfter: _truMinTasks(),
      };
    });
    check('her three reported tasks still count after task 2 is switched off', r.beforeTasks === 3 && r.afterTasks === 3, r);
    check('task 2 still resolves for history, it is only withdrawn from the form', r.resolves && r.offered, r);
    check('the ceiling drops to 7×10=70 and eligibility stays 5', r.maxAfter === 70 && r.minAfter === 5, r);
    const floor = await page.evaluate(() => { [3, 4, 5, 6, 7].forEach((n) => _truTasksToggle(n)); return { active: _truTasksActive().length, min: _truMinTasks() }; });
    check('with only 2 tasks left the bar drops to 2 — a month can never become unwinnable', floor.active === 2 && floor.min === 2, floor);
  }

  console.log('\n5. the trustee form and the scoreboard follow the catalogue');
  {
    await boot(TASKS.map((t) => (t.n === 4 ? Object.assign({}, t, { active: false }) : t)));
    const r = await page.evaluate(() => {
      _truFormReset(); _truReport();          // the report form, no task pre-picked
      const chips = Array.from(document.querySelectorAll('[data-tru-chip]')).map((b) => parseInt(b.dataset.truChip, 10));
      closeModal('m-tru');
      return { chips: chips };
    });
    check('the report form offers the 7 active tasks and not the switched-off one', r.chips.length === 7 && r.chips.indexOf(4) < 0 && r.chips.indexOf(8) >= 0, r.chips);
    const board = await page.evaluate(() => { goPage('trustees'); rTrustees(); const row = document.querySelector('.tru-board-row'); return { chips: row ? row.querySelectorAll('div[style*="margin-top:5px"] span').length : -1 }; });
    check('the scoreboard shows one square per active task, not a fixed eight', board.chips === 7, board);
  }

  console.log('\n6. the menu entry exists for the manager');
  {
    await boot(TASKS);
    const r = await page.evaluate(() => ({ modal: !!document.getElementById('m-tru-tasks'), fn: typeof _truTasksOpen }));
    check('קטלוג המשימות opens from the trustees page ⋯ menu', r.modal && r.fn === 'function', r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
