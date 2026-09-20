// Five things about the safety-trustee programme. Every one of them was a
// dead end for the one person the screen exists for — a volunteer with a
// phone, standing in the plant, who has no way to tell a broken screen from
// an empty one.
//
// 4.1  _truRender only ever listed THIS month's reports. A hazard opened on
//      28 September was still open on 1 October, still counted as stale on the
//      manager's screen — and gone from the trustee's, together with the
//      "📷 צלם אחרי" button, which is the only way to close it. The person who
//      found it could no longer report that it was fixed.
//
// 4.2  _truMgrSpawnTask filled the task's assignee with r.u — the trustee who
//      REPORTED the hazard. A volunteer representative, not the department
//      that owns the machine. Route without looking and the repair goes back
//      to the person who raised it, who then shows up in בפיגור for it.
//
// 4.3  proceed()'s employee branch — the one that runs every time a trustee
//      reopens the saved link or the installed PWA — set CUR='emp-home' and
//      never called _truEmpHome. CSS shows the page, so something appeared;
//      but tru-only was never applied and _truRender never ran. Only the
//      FIRST login (doEmpLogin) ever built the screen.
//
// 4.10 The kiosk never runs sbSync, and _truPull fetched three tables, not
//      four. So DB.trustee_tasks was fed only by realtime — and one UPDATE on
//      one task left it holding exactly that row. _truTasks() stops falling
//      back to the built-in eight the moment the table is non-empty, so the
//      screen collapsed from 8 tasks to 1.
//
// 4.11 The «היום» line said "open for 74 days" and led to the trustees page,
//      which always opens on the current month. 74 days ago is not this month,
//      so the manager who followed the line landed on אין ממצאים פתוחים 👍.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const ME = 'מוסא עלי';
const OTHER = 'דנה לוי';

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate((me) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sbDel = function () {};
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    try { localStorage.setItem('tfgn_trustee_name', me); } catch (e) {}
    // helpers the fixtures use
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__monthBack = function (n) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    };
  }, ME);

  console.log('\n4.1 a finding opened last month can still be closed this month');
  {
    const r = await page.evaluate((names) => {
      const me = names[0], other = names[1];
      const last = __monthBack(1), older = __monthBack(3), now = _truThisMonth();
      DB.trustee_tasks = [];
      DB.trustee_reports = [
        { id: 'old1', u: me, t: 6, d: last + '-28', ts: last + '-28T09:00:00Z', ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'מגן על מסוע 3 הוסר' },
        { id: 'old2', u: me, t: 5, d: older + '-11', ts: older + '-11T09:00:00Z', ok: false, s: 'פתוח', loc: 'מחסן', f: 'מטף ללא פלומבה' },
        { id: 'oldC', u: me, t: 4, d: last + '-03', ts: last + '-03T09:00:00Z', ok: false, s: 'נסגר', loc: 'גג', f: 'סולם פגום — הוחלף' },
        { id: 'oldOk', u: me, t: 1, d: last + '-05', ts: last + '-05T09:00:00Z', ok: true, loc: 'אולם טיגון', f: '' },
        { id: 'them', u: other, t: 6, d: last + '-20', ts: last + '-20T09:00:00Z', ok: false, s: 'פתוח', loc: 'מחסן', f: 'לא שלי' },
        { id: 'now1', u: me, t: 3, d: __iso(-1), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'דלת חירום נעולה' },
      ];
      _truRender();
      const box = g('tru-body');
      const older_ = g('tru-older');
      const olderHtml = older_ ? older_.innerHTML : '';
      const mineHtml = (g('tru-mine') || {}).innerHTML || '';
      return {
        hasCard: !!older_,
        order: _truMyOpenOlder(me, now).map((x) => x.id),
        olderIds: (olderHtml.match(/data-tru-rep="([^"]+)"/g) || []).map((s) => s.slice(14, -1)),
        closeBtns: (olderHtml.match(/_truCloseReport\(&quot;|_truCloseReport\('([^']+)'/g) || []).length,
        closesOld1: olderHtml.indexOf("_truCloseReport('old1')") >= 0,
        namesIt: olderHtml.indexOf('מגן על מסוע 3 הוסר') >= 0,
        age: /\d+ יום/.test(olderHtml),
        mineIds: (mineHtml.match(/data-tru-rep="([^"]+)"/g) || []).map((s) => s.slice(14, -1)),
        tasksShown: (box.innerHTML.match(/data-tru-task="/g) || []).length,
      };
    }, [ME, OTHER]);
    check('the screen carries a block for still-open findings from earlier months', r.hasCard, r);
    check('it holds exactly the two of mine that are still open', r.olderIds.join() === 'old2,old1', r.olderIds);
    check('oldest first — the one that has been waiting longest is at the top', r.order.join() === 'old2,old1', r.order);
    check('a finding I already closed is not in it', r.olderIds.indexOf('oldC') < 0, r.olderIds);
    check('a תקין report is not in it — it was never a finding', r.olderIds.indexOf('oldOk') < 0, r.olderIds);
    check('another trustee’s open finding is not in it', r.olderIds.indexOf('them') < 0, r.olderIds);
    check('this month’s finding stays in this month’s list, not duplicated here', r.olderIds.indexOf('now1') < 0 && r.mineIds.indexOf('now1') >= 0, r);
    check('«📷 צלם אחרי» is on the old finding — the button that had disappeared', r.closesOld1, r.olderHtml);
    check('the finding is named, so it is recognisable in the plant', r.namesIt, r);
    check('and it says how long it has been open', r.age, r);
    check('the 8 monthly tasks are still there — nothing was displaced', r.tasksShown >= 8, r.tasksShown);

    const clean = await page.evaluate((me) => {
      DB.trustee_reports = [{ id: 'c1', u: me, t: 3, d: __iso(-1), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'x', f: 'y' }];
      _truRender();
      return !!g('tru-older');
    }, ME);
    check('with nothing old open the block is absent — no empty card', !clean, clean);
  }

  console.log('\n4.2 routing a finding does not hand the repair back to the reporter');
  {
    const r = await page.evaluate((me) => {
      DB.tasks = [];
      DB.trustee_reports = [{ id: 'h1', u: me, t: 6, d: __iso(-4), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'מגן על מסוע 3 הוסר' }];
      _truMgrSpawnTask('h1');
      return {
        assignee: g('tsk-assignee').value,
        title: g('tsk-title').value,
        notes: g('tsk-notes').value,
        due: g('tsk-due').value,
        srcTbl: g('tsk-src-tbl').value,
        srcId: g('tsk-src-id').value,
        expectDue: (function () { const d = new Date(__iso(-4)); d.setDate(d.getDate() + TRUSTEE_STALE_DAYS); return d.toISOString().substring(0, 10); })(),
      };
    }, ME);
    check('the assignee is left empty for the manager to decide', r.assignee === '', r.assignee);
    check('...and specifically is NOT the trustee who reported it', r.assignee !== ME, r.assignee);
    check('who reported it is still recorded — in the notes, where it belongs', r.notes.indexOf(ME) >= 0, r.notes);
    check('the finding itself is the task title', r.title.indexOf('מגן על מסוע 3 הוסר') >= 0, r.title);
    check('the due date is still derived, not left for the iOS date wheel', r.due === r.expectDue, r);
    check('the task still points back at the finding', r.srcTbl === 'trustee_reports' && r.srcId === 'h1', r);

    // What the empty field actually buys: the trustee never turns up as the
    // אחראי of an overdue repair he reported.
    const saved = await page.evaluate((me) => {
      DB.tasks = [];
      DB.trustee_reports = [{ id: 'h2', u: me, t: 6, d: __iso(-40), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'מחסן', f: 'מטף ללא פלומבה' }];
      _truMgrSpawnTask('h2');
      svTsk();
      const t = DB.tasks[0];
      window._currentUser = { username: 'tru', full_name: me };
      return { assignee: t.assignee, mine: _isMine(t.assignee), due: t.due, src: t.source_id };
    }, ME);
    check('the saved task has no assignee at all, rather than the reporter’s name', saved.assignee === null, saved);
    check('so it never counts as the trustee’s own overdue task', !saved.mine, saved);
    check('while still being a real, dated task on the finding', !!saved.due && saved.src === 'h2', saved);
    await page.evaluate(() => { window._currentUser = { username: 'admin' }; });
  }

  console.log('\n4.10 the kiosk pulls the task catalogue, not just the reports');
  {
    const r = await page.evaluate(() => {
      const full = [];
      for (let n = 1; n <= 8; n++) full.push({ id: 'tt' + n, n: n, icon: '🔍', t: 'משימה ' + n, how: '...', active: true });
      window.__asked = [];
      window.sbGet = function (t) {
        window.__asked.push(t);
        if (t === 'trustee_tasks') return Promise.resolve(full);
        return Promise.resolve([]);
      };
      // what realtime does to a kiosk that never pulled the table: one row.
      DB.trustee_tasks = [{ id: 'tt3', n: 3, icon: '🚪', t: 'משימה 3', how: '...', active: true }];
      const collapsed = _truTasks().length;
      return _truPull(false).then(function () {
        return { asked: window.__asked, collapsed: collapsed, after: _truTasks().length, rows: (DB.trustee_tasks || []).length };
      });
    });
    check('one realtime row really does collapse the catalogue — that is the bug', r.collapsed === 1, r.collapsed);
    check('the pull asks the server for trustee_tasks', r.asked.indexOf('trustee_tasks') >= 0, r.asked);
    check('...alongside the three it always asked for', ['trustee_reports', 'trustees', 'trustee_winners'].every((t) => r.asked.indexOf(t) >= 0), r.asked);
    check('and the catalogue comes back whole', r.after === 8 && r.rows === 8, r);

    // And the same event arriving live, through the real realtime handler.
    const hook = await page.evaluate(() => {
      const realPull = window._truPull;
      window.__pulls = 0;
      window._truPull = function () { window.__pulls++; return Promise.resolve(true); };
      const ev = { eventType: 'UPDATE', new: { id: 'tt3', n: 3, icon: '🚪', t: 'משימה 3 — נוסח חדש', how: '...', active: true }, old: null };
      const home = g('pg-emp-home');
      const hadTruOnly = home.classList.contains('tru-only');

      home.classList.add('tru-open');                       // the trustee screen is open
      _rtApply('trustee_tasks', ev);
      const open = window.__pulls;
      const applied = (DB.trustee_tasks || []).filter((t) => t.n === 3)[0];

      home.classList.remove('tru-open');
      if (!hadTruOnly) home.classList.remove('tru-only');
      window.__pulls = 0;
      _rtApply('trustee_tasks', ev);
      const closed = window.__pulls;

      window.__pulls = 0;
      _rtApply('trustee_reports', { eventType: 'UPDATE', new: { id: 'zz', u: 'x' }, old: null });
      const unrelated = window.__pulls;

      window._truPull = realPull;
      return { open: open, closed: closed, unrelated: unrelated, text: applied && applied.t };
    });
    check('a realtime trustee_tasks row still lands — the edit is not dropped', /נוסח חדש/.test(hook.text || ''), hook);
    check('...and the whole table is re-read while the trustee screen is open', hook.open === 1, hook);
    check('not when it is closed — no pull storm on the manager’s device', hook.closed === 0, hook);
    check('and not for some other table’s events', hook.unrelated === 0, hook);
  }

  console.log('\n4.11 following a finding from «היום» lands on the month it is in');
  {
    const r = await page.evaluate(() => {
      const old = new Date(Date.now() - 74 * 864e5);
      const oldIso = old.toISOString().split('T')[0];
      DB.trustee_tasks = [];
      DB.trustee_reports = [
        { id: 'st1', u: 'מוסא עלי', t: 6, d: oldIso, ts: old.toISOString(), ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'מגן על מסוע 3 הוסר', mgr_note: 'הועבר לאחזקה' },
      ];
      DB.tasks = []; DB.rounds = []; DB.ncr = []; DB.inc = []; DB.near_miss = [];
      _truMgrM = null; _truMgrF = 'open';
      _renderToday();
      const el = [...document.querySelectorAll('#today-items .today-item')].find((x) => x.textContent.indexOf('ליקוי') >= 0);
      return { fn: el && el.dataset.fn, a1: el && el.dataset.a1, a2: el && el.dataset.a2, month: oldIso.substring(0, 7), thisMonth: _truThisMonth() };
    });
    check('the old finding produces a line on «היום»', !!r.fn, r);
    check('the line carries the finding’s own id, not just the page name', r.a1 === 'st1', r);
    check('...and asks for the trustee route rather than a bare goPage', r.fn === 'trustee', r);
    check('the fixture really is in a different month, or this proves nothing', r.month !== r.thisMonth, r);

    const landed = await page.evaluate(() => {
      _todayClick('trustee', 'st1', 'open');
      return new Promise(function (res) {
        setTimeout(function () {
          res({
            page: CUR,
            month: _truMgrMonth(),
            filter: _truMgrF,
            table: (g('tb-trustees') || {}).innerHTML || '',
            highlighted: !!document.querySelector('tr[data-tru-row="st1"]'),
          });
        }, 200);
      });
    });
    check('it opens the trustees page', landed.page === 'trustees', landed.page);
    check('on the month the finding was filed in', landed.month === r.month, { got: landed.month, want: r.month });
    check('with the פתוחים filter', landed.filter === 'open', landed.filter);
    check('and the finding is actually on the screen — it used to say אין ממצאים פתוחים 👍', landed.highlighted && landed.table.indexOf('מגן על מסוע 3 הוסר') >= 0, landed.table.slice(0, 200));

    const routing = await page.evaluate(() => {
      const old = new Date(Date.now() - 50 * 864e5);
      DB.trustee_reports = [{ id: 'rt1', u: 'דנה לוי', t: 5, d: old.toISOString().split('T')[0], ts: old.toISOString(), ok: false, s: 'פתוח', loc: 'מחסן', f: 'מטף ללא פלומבה' }];
      DB.tasks = [];
      _truMgrM = null;
      _renderToday();
      const el = [...document.querySelectorAll('#today-items .today-item')].find((x) => x.textContent.indexOf('לניתוב') >= 0);
      return { fn: el && el.dataset.fn, a1: el && el.dataset.a1 };
    });
    check('the «ממתינים לניתוב» line points at a finding too', routing.fn === 'trustee' && routing.a1 === 'rt1', routing);

    const back = await page.evaluate(() => {
      const now = (DB.trustee_reports || [])[0];
      now.d = new Date().toISOString().split('T')[0]; now.ts = new Date().toISOString();
      _truMgrM = '2020-01';
      _truGo('rt1', 'open');
      return { month: _truMgrMonth(), raw: _truMgrM };
    });
    check('a finding from THIS month resets the month instead of pinning it', back.raw === null && back.month === back.month, back);
  }

  console.log('\n4.3 reopening the saved link lands on the trustee screen');
  {
    // A fresh boot, exactly as the phone does it: emp mode remembered in
    // localStorage, no Supabase session, proceed() takes the employee branch.
    const boot = await page.evaluate((me) => {
      const last = (function () { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
      try {
        localStorage.setItem('tfgn_emp_mode', '1');
        localStorage.setItem('tfgn_trustee_name', me);
        localStorage.setItem('tfgn2', JSON.stringify({
          trustee_reports: [{ id: 'b1', u: me, t: 6, d: last + '-28', ts: last + '-28T09:00:00Z', ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'מגן על מסוע 3 הוסר' }],
          trustees: [{ id: 'r1', n: me, dep: 'אולם טיגון', active: true }],
        }));
        return localStorage.getItem('tfgn_emp_mode');
      } catch (e) { return 'ERR:' + e.message; }
    }, ME);
    check('the phone can remember employee mode at all (else this test proves nothing)', boot === '1', boot);

    // A clean navigation, not a reload: the manager tests above pushed
    // #trustees into the URL, and the hash-restore at boot would then fight
    // over the page. The trustee's own link carries no hash.
    await page.goto('about:blank');
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    const r = await page.evaluate(() => {
      const home = g('pg-emp-home');
      return {
        empMode: document.body.classList.contains('emp-mode'),
        cur: CUR,
        truOnly: home && home.classList.contains('tru-only'),
        bodyLen: ((g('tru-body') || {}).innerHTML || '').length,
        tasks: (((g('tru-body') || {}).innerHTML) || '').match(/data-tru-task="/g),
        hasOlder: !!g('tru-older'),
        reports: (DB.trustee_reports || []).length,
      };
    });
    check('the app comes up in employee mode', r.empMode, r);
    check('...on the employee home', r.cur === 'emp-home', r.cur);
    check('the trustee-only layout is applied — it never was on a return visit', r.truOnly, r);
    check('the trustee screen is actually rendered, not an empty div', r.bodyLen > 500, r.bodyLen);
    check('the monthly tasks are on it', r.tasks && r.tasks.length >= 8, r.tasks && r.tasks.length);
    check('the cached report survived the reload', r.reports === 1, r.reports);
    check('and last month’s open finding is reachable on this boot too', r.hasOlder, r);

    await page.evaluate(() => { try { localStorage.removeItem('tfgn_emp_mode'); localStorage.removeItem('tfgn2'); localStorage.removeItem('tfgn_trustee_name'); } catch (e) {} });
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
