// Five more trustee items. Between them they cover the three ways the
// programme quietly under-reports itself: work that was done but never
// recorded, a person who exists twice, and a prize nobody was reminded to
// hand out.
//
// 4.4  Marking the routed task "הושלם" wrote nothing back to trustee_reports.
//      The finding stayed red פתוח, the age chip kept counting, after 30 days
//      it joined the «דווח, נותב, עדיין לא תוקן» line on the home screen — about
//      something already fixed — and the trustee never got the 2 points, so
//      the monthly score was lower than what happened in the plant.
//
// 4.6  A name typed into «אחר» is saved on the report and then offered as a
//      permanent option on EVERY device, with a row of its own on the
//      leaderboard. «משה כהן» and «מ. כהן» became two competitors; neither
//      reached the threshold, so neither was eligible, and the CSV that goes
//      to the safety committee listed a trustee who does not exist. Deleting
//      the roster row did not help — the name comes from the report.
//
// 4.7  The screen showed me only my own reports, from this month. Two
//      trustees sharing an area — a case _truCoverage explicitly knows about
//      — could not see each other's open findings.
//
// 4.8  The trustees page opens on the calendar month, so on the 1st the
//      finished month is one click back and nothing says its prize is still
//      unannounced. From the trustees' side the gold banner shows the LAST
//      announcement, so everyone assumes it was handled.
//
// 4.9  «/8», «עד 80», «/100», «≥5» were plain text, while the real numbers
//      follow the catalogue. Today there are exactly 8 active tasks so it all
//      happens to be right — the day Michael switches one off, the same screen
//      states two different truths.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

let ACCEPT = true;            // how the next confirm() is answered
let DIALOGS = [];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', async (d) => { DIALOGS.push(d.message()); await (ACCEPT ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__upd = {};
    window.sbIns = function () {};
    window.sbUpd = function (t, r) { (window.__upd[t] = window.__upd[t] || []).push(JSON.parse(JSON.stringify(r))); };
    window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__blob = null;
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (b) { window.__blob = b; return realCreate(b); };
    HTMLAnchorElement.prototype.click = function () { window.__clicked = this.download; };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__prev = function () { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    window.__blank = function () {
      ['tasks', 'ncr', 'inc', 'near_miss', 'rounds', 'ppe', 'tr', 'docs', 'ctr', 'equip_inspections',
       'trustee_reports', 'trustees', 'trustee_winners', 'trustee_tasks'].forEach((t) => { DB[t] = []; });
    };
  });

  console.log('\n4.4 closing the routed task offers to close the finding');
  {
    const setup = `DB.trustee_reports=[{id:'f1',u:'מוסא עלי',t:6,d:__iso(-40),ts:new Date(Date.now()-40*864e5).toISOString(),ok:false,s:'פתוח',loc:'אולם טיגון',f:'מגן על מסוע 3 הוסר'}];
      DB.tasks=[{id:'t1',title:'נאמן בטיחות — מגן',status:'פתוח',source_table:'trustee_reports',source_id:'f1',due:__iso(-5)}];`;

    DIALOGS = []; ACCEPT = true;
    const yes = await page.evaluate(`(() => { __blank(); ${setup} _tskQuickStatus('t1','הושלם'); return null; })()`);
    await page.waitForTimeout(150);
    const afterYes = await page.evaluate(() => ({ s: DB.trustee_reports[0].s, task: DB.tasks[0].status, stale: _truStale().length, toasts: window.__toasts.slice(-2) }));
    check('the manager is asked, rather than it happening silently', DIALOGS.length === 1, DIALOGS);
    check('...and the question names the finding, not just an id', /מגן על מסוע 3 הוסר/.test(DIALOGS[0] || ''), DIALOGS[0]);
    check('...and says what saying yes does', /2 נק/.test(DIALOGS[0] || ''), DIALOGS[0]);
    check('saying yes closes the finding', afterYes.s === 'נסגר', afterYes);
    check('so it leaves the «reported, routed, still not fixed» line', afterYes.stale === 0, afterYes);

    DIALOGS = []; ACCEPT = false;
    await page.evaluate(`(() => { __blank(); ${setup} _tskQuickStatus('t1','הושלם'); return null; })()`);
    await page.waitForTimeout(150);
    const afterNo = await page.evaluate(() => ({ s: DB.trustee_reports[0].s, task: DB.tasks[0].status }));
    check('saying no leaves the finding open — closure is still the trustee’s photo', afterNo.s === 'פתוח', afterNo);
    check('...and the task is done either way', afterNo.task === 'הושלם', afterNo);

    // the finding's row now says what happened to its task
    // the finding is 40 days old, so it lives in a previous month
    const row = await page.evaluate(() => { _truMgrF = 'open'; _truGo('f1', 'open'); rTrustees(); return (g('tb-trustees') || {}).innerHTML || ''; });
    check('the finding’s row shows the task’s status, not just its title', /הושלם/.test(row), row.slice(0, 300));
    check('...and offers to close it right there', /_truMgrSetStatus\(this\.dataset\.rid,TRUSTEE_S_CLOSED\)/.test(row), row.slice(0, 400));

    // not asked twice: an ordinary edit of a task that was already done
    DIALOGS = []; ACCEPT = true;
    const again = await page.evaluate(() => {
      DB.trustee_reports[0].s = 'פתוח';
      DB.tasks[0].status = 'פתוח';                   // the save below is what closes it
      openTskModal('trustee_reports', 'f1');
      g('tsk-id').value = 't1'; g('tsk-title').value = 'נאמן בטיחות — מגן'; g('tsk-status').value = 'הושלם';
      g('tsk-src-tbl').value = 'trustee_reports'; g('tsk-src-id').value = 'f1';
      svTsk();                                       // first save: this is the transition
      return null;
    });
    await page.waitForTimeout(120);
    const firstSave = DIALOGS.length;
    DIALOGS = [];
    await page.evaluate(() => {
      DB.trustee_reports[0].s = 'פתוח';
      openTskModal('trustee_reports', 'f1');
      g('tsk-id').value = 't1'; g('tsk-title').value = 'נאמן בטיחות — מגן, עודכן'; g('tsk-status').value = 'הושלם';
      g('tsk-src-tbl').value = 'trustee_reports'; g('tsk-src-id').value = 'f1';
      svTsk();                                       // editing a task that was ALREADY done
      return null;
    });
    await page.waitForTimeout(120);
    check('saving a task as done from the form asks too', firstSave === 1, firstSave);
    check('...but editing one that was already done does not ask again', DIALOGS.length === 0, DIALOGS);

    // a bulk close asks once for all of them
    DIALOGS = []; ACCEPT = true;
    await page.evaluate(() => {
      __blank();
      DB.trustee_reports = [
        { id: 'b1', u: 'א', t: 6, d: __iso(-40), ts: new Date(Date.now() - 40 * 864e5).toISOString(), ok: false, s: 'פתוח', loc: 'מחסן', f: 'מטף' },
        { id: 'b2', u: 'ב', t: 5, d: __iso(-40), ts: new Date(Date.now() - 40 * 864e5).toISOString(), ok: false, s: 'פתוח', loc: 'גג', f: 'סולם' },
        { id: 'b3', u: 'ג', t: 5, d: __iso(-40), ts: new Date(Date.now() - 40 * 864e5).toISOString(), ok: false, s: 'נסגר', loc: 'גג', f: 'כבר נסגר' },
      ];
      DB.tasks = [
        { id: 'k1', title: 'א', status: 'פתוח', source_table: 'trustee_reports', source_id: 'b1' },
        { id: 'k2', title: 'ב', status: 'פתוח', source_table: 'trustee_reports', source_id: 'b2' },
        { id: 'k3', title: 'ג', status: 'פתוח', source_table: 'trustee_reports', source_id: 'b3' },
        { id: 'k4', title: 'לא קשור', status: 'פתוח', source_table: 'ncr', source_id: 'n1' },
      ];
      window._tskSel = { k1: true, k2: true, k3: true, k4: true };
      window.__toasts = [];
      _tskBulkAction('close');
      return null;
    });
    await page.waitForTimeout(200);
    const bulk = await page.evaluate(() => ({
      states: DB.trustee_reports.map((r) => r.id + ':' + r.s),
      tasks: DB.tasks.map((t) => t.status),
      toasts: window.__toasts,
    }));
    check('the bulk close asks once, not once per task', DIALOGS.length === 2, DIALOGS.length);   // 1 = the bulk confirm itself, 2 = ours
    check('both open findings close', bulk.states.indexOf('b1:נסגר') >= 0 && bulk.states.indexOf('b2:נסגר') >= 0, bulk.states);
    check('one that was already closed is not touched again', bulk.states.indexOf('b3:נסגר') >= 0, bulk.states);
    check('a task from another module is not dragged in', /2 ממצאים/.test(bulk.toasts.join('|')), bulk.toasts);
  }

  console.log('\n4.6 a trustee is one person, not two spellings of a name');
  {
    const seed = () => page.evaluate(() => {
      __blank();
      DB.trustees = [{ id: 'r1', n: 'משה כהן', dep: 'אולם טיגון', active: true }];
      DB.trustee_reports = [
        { id: 'p1', u: 'משה כהן', t: 1, d: __iso(-3), ts: new Date().toISOString(), ok: true, loc: 'אולם טיגון' },
        { id: 'p2', u: 'מ. כהן', t: 2, d: __iso(-2), ts: new Date().toISOString(), ok: true, loc: 'אולם טיגון' },
        { id: 'p3', u: 'מ. כהן', t: 3, d: __iso(-1), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'דלת' },
      ];
      DB.trustee_winners = [{ id: 'w1', m: __prev(), u: 'מ. כהן', pts: 40 }];
      _truRosterOpen();
      return null;
    });

    await seed();
    const ghosts = await page.evaluate(() => ({
      list: _truGhostNames().map((x) => x.n + ':' + x.count),
      html: (g('tru-roster-ghosts') || {}).innerHTML || '',
      board: _truBoard(_truThisMonth()).map((x) => x.u),
    }));
    check('the leaderboard really does split into two people — that is the bug', ghosts.board.length === 2, ghosts.board);
    check('the roster names the stray spelling, with how many reports it holds', ghosts.list.join() === 'מ. כהן:2', ghosts.list);
    check('...and offers to merge it into a real trustee', /_truGhostMerge/.test(ghosts.html) && /משה כהן/.test(ghosts.html), ghosts.html.slice(0, 300));

    DIALOGS = []; ACCEPT = true;
    const picked = await page.evaluate(() => {
      const sel = document.querySelector('select[data-ghost="מ. כהן"]');
      if (!sel) return false;                        // no merge UI: the checks below say so plainly
      sel.value = 'משה כהן';
      window.__upd = {};
      _truGhostMerge('מ. כהן');
      return true;
    });
    await page.waitForTimeout(120);
    const merged = await page.evaluate(() => ({
      names: (DB.trustee_reports || []).map((r) => r.u),
      rows: (DB.trustee_reports || []).length,
      board: _truBoard(_truThisMonth()).map((x) => x.u + ':' + x.nTasks),
      winner: (DB.trustee_winners[0] || {}).u,
      pushed: (window.__upd.trustee_reports || []).length,
      ghosts: _truGhostNames().length,
    }));
    check('the merge control is reachable at all', picked, picked);
    check('the reports keep their rows — nothing is deleted', merged.rows === 3, merged);
    check('...and all of them now name the real trustee', merged.names.every((n) => n === 'משה כהן'), merged.names);
    check('the leaderboard is one person with all three tasks', merged.board.join() === 'משה כהן:3', merged.board);
    check('an already-announced win moves with the name too', merged.winner === 'משה כהן', merged.winner);
    check('every changed row was queued for the server', merged.pushed === 2, merged.pushed);
    check('and the stray name is gone from the list', merged.ghosts === 0, merged.ghosts);

    // renaming a real roster entry propagates the same way
    DIALOGS = []; ACCEPT = true;
    const renamed = await page.evaluate(() => {
      _truRosterRender();
      _truRosterEdit('r1');
      const hadForm = !!g('tru-roster-en');
      g('tru-roster-en').value = 'משה כהן-לוי';
      g('tru-roster-ed-dep').value = 'אריזה';
      _truRosterEditSave('r1');
      return { hadForm: hadForm, roster: DB.trustees[0], names: (DB.trustee_reports || []).map((r) => r.u) };
    });
    await page.waitForTimeout(120);
    check('the roster has an inline ✎ form at all', renamed.hadForm, renamed);
    check('the roster entry takes the new name and area', renamed.roster.n === 'משה כהן-לוי' && renamed.roster.dep === 'אריזה', renamed.roster);
    check('and the existing reports follow it — otherwise the old name lives on in the board', renamed.names.every((n) => n === 'משה כהן-לוי'), renamed.names);

    // a name that differs only by a dot or a space is where the ghost is born
    DIALOGS = []; ACCEPT = false;
    const near = await page.evaluate(() => {
      DB.trustees = [{ id: 'r1', n: 'משה כהן', dep: 'x', active: true }];
      g('tru-roster-n').value = 'משה  כהן';
      _truRosterAdd();
      return DB.trustees.length;
    });
    await page.waitForTimeout(120);
    check('adding a near-duplicate warns first', DIALOGS.length === 1 && /רווח/.test(DIALOGS[0] || ''), DIALOGS);
    check('...and declining does not create the second competitor', near === 1, near);

    DIALOGS = []; ACCEPT = true;
    const anyway = await page.evaluate(() => { g('tru-roster-n').value = 'משה  כהן'; _truRosterAdd(); return DB.trustees.length; });
    await page.waitForTimeout(120);
    check('but a deliberate yes still adds it — two people can share a name', anyway === 2, anyway);
    await page.evaluate(() => closeModal('m-tru-roster'));
  }

  console.log('\n4.7 a trustee can see what is open on his own patch');
  {
    const r = await page.evaluate(() => {
      __blank();
      try { localStorage.setItem('tfgn_trustee_name', 'מוסא עלי'); } catch (e) {}
      DB.trustees = [
        { id: 'r1', n: 'מוסא עלי', dep: 'אולם טיגון', active: true },
        { id: 'r2', n: 'דנה לוי', dep: 'אולם טיגון', active: true },
        { id: 'r3', n: 'רון', dep: 'מחסן', active: true },
      ];
      const old = new Date(Date.now() - 12 * 864e5).toISOString();
      DB.trustee_reports = [
        { id: 'a1', u: 'דנה לוי', t: 6, d: old.split('T')[0], ts: old, ok: false, s: 'פתוח', loc: 'אולם טיגון · מסוע 3', f: 'מגן הוסר' },
        { id: 'a2', u: 'דנה לוי', t: 5, d: __iso(-1), ts: new Date().toISOString(), ok: false, s: 'נסגר', loc: 'אולם טיגון', f: 'כבר תוקן' },
        { id: 'a3', u: 'דנה לוי', t: 1, d: __iso(-1), ts: new Date().toISOString(), ok: true, loc: 'אולם טיגון' },
        { id: 'a4', u: 'רון', t: 6, d: __iso(-1), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'מחסן', f: 'לא באזור שלי' },
        { id: 'a5', u: 'מוסא עלי', t: 3, d: __iso(-1), ts: new Date().toISOString(), ok: false, s: 'פתוח', loc: 'אולם טיגון', f: 'שלי' },
      ];
      _truRender();
      const card = g('tru-area');
      const html = card ? card.innerHTML : '';
      return {
        has: !!card,
        ids: (html.match(/data-tru-rep="([^"]+)"/g) || []).map((s) => s.slice(14, -1)),
        namesArea: /אולם טיגון/.test(html),
        namesWho: /דנה לוי/.test(html),
        close: /_truCloseReport/.test(html),
        mine: ((g('tru-mine') || {}).innerHTML || '').indexOf('a5') >= 0,
        fn: _truAreaOpen('מוסא עלי').map((x) => x.id),
      };
    });
    check('there is a block for my area', r.has, r);
    check('it holds the other trustee’s open finding in my area', r.ids.join() === 'a1', r.ids);
    check('a closed one is not in it', r.ids.indexOf('a2') < 0, r.ids);
    check('a תקין report is not in it', r.ids.indexOf('a3') < 0, r.ids);
    check('another area’s finding is not in it — the match is on the area prefix', r.ids.indexOf('a4') < 0, r.ids);
    check('my own finding stays in my own list, not duplicated here', r.ids.indexOf('a5') < 0 && r.mine, r);
    check('the card names the area', r.namesArea, r);
    check('the row names who reported it', r.namesWho, r);
    check('there is NO «📷 צלם אחרי» on someone else’s finding — the server would refuse it', !r.close, r);

    const noArea = await page.evaluate(() => {
      DB.trustees = [{ id: 'r1', n: 'מוסא עלי', active: true }];   // roster with no area
      _truRender();
      return { card: !!g('tru-area'), fn: _truAreaOpen('מוסא עלי').length };
    });
    check('a trustee with no assigned area gets no block, rather than the whole plant', !noArea.card && noArea.fn === 0, noArea);
  }

  console.log('\n4.8 somebody is reminded to hand out last month’s prize');
  {
    const r = await page.evaluate(() => {
      __blank();
      window._currentUser = { username: 'admin' }; _isAdmin = true;
      const prev = __prev();
      DB.trustees = [{ id: 'r1', n: 'מוסא עלי', dep: 'א', active: true }];
      // five distinct tasks last month = eligible
      DB.trustee_reports = [1, 2, 3, 4, 5].map((n) => ({ id: 'w' + n, u: 'מוסא עלי', t: n, d: prev + '-1' + n, ts: prev + '-1' + n + 'T09:00:00Z', ok: true, loc: 'א' }));
      DB.trustee_winners = [];
      _renderToday();
      const el = [...document.querySelectorAll('#today-items .today-item')].find((x) => x.textContent.indexOf('זוכה') >= 0);
      return { due: !!_truWinnerDue(), month: _truWinnerDue() && _truWinnerDue().m, prev: prev, text: el && el.textContent, fn: el && el.dataset.fn, a1: el && el.dataset.a1 };
    });
    check('a finished month with an eligible trustee and no winner is flagged', r.due && r.month === r.prev, r);
    check('...as a line on «היום»', !!r.fn, r);
    check('the line names the month and who is in front', /נק/.test(r.text || '') && /מוסא עלי/.test(r.text || ''), r.text);
    check('and it carries that month, not today’s', r.fn === 'truwinner' && r.a1 === r.prev, r);

    const landed = await page.evaluate(() => {
      _truMgrM = null;
      _todayClick('truwinner', __prev(), '');
      return { page: CUR, month: _truMgrMonth(), prev: __prev(), board: (g('tru-mgr-board') || {}).innerHTML || '' };
    });
    check('following it opens the trustees page on the finished month', landed.page === 'trustees' && landed.month === landed.prev, landed);
    check('...where the announce button is waiting', /_truWinnerOpen/.test(landed.board), landed.board.slice(0, 200));

    const announced = await page.evaluate(() => {
      DB.trustee_winners = [{ id: 'w1', m: __prev(), u: 'מוסא עלי', pts: 50 }];
      _renderToday();
      return { due: !!_truWinnerDue(), line: [...document.querySelectorAll('#today-items .today-item')].filter((x) => x.textContent.indexOf('טרם הוכרז') >= 0).length };
    });
    check('once announced the line goes away', !announced.due && announced.line === 0, announced);

    const nobody = await page.evaluate(() => {
      DB.trustee_winners = [];
      DB.trustee_reports = DB.trustee_reports.slice(0, 2);     // two tasks: nobody is eligible
      _renderToday();
      return { due: !!_truWinnerDue(), line: [...document.querySelectorAll('#today-items .today-item')].filter((x) => x.textContent.indexOf('טרם הוכרז') >= 0).length };
    });
    check('a month where nobody qualified produces no line — it would be daily noise', !nobody.due && nobody.line === 0, nobody);

    const thisMonth = await page.evaluate(() => {
      const now = _truThisMonth();
      DB.trustee_reports = [1, 2, 3, 4, 5].map((n) => ({ id: 'c' + n, u: 'מוסא עלי', t: n, d: now + '-0' + n, ts: now + '-0' + n + 'T09:00:00Z', ok: true, loc: 'א' }));
      DB.trustee_winners = [];
      return !!_truWinnerDue();
    });
    check('the month still running is never nagged about', !thisMonth, thisMonth);
  }

  console.log('\n4.9 the numbers on screen follow the catalogue');
  {
    const r = await page.evaluate(() => {
      __blank();
      try { localStorage.setItem('tfgn_trustee_name', 'מוסא עלי'); } catch (e) {}
      DB.trustee_tasks = [1, 2, 3, 4, 5, 8].map((n) => ({ id: 't' + n, n: n, icon: '🔍', t: 'משימה ' + n, how: '.', active: true }));
      DB.trustee_reports = [{ id: 'x1', u: 'מוסא עלי', t: 1, d: __iso(-1), ts: new Date().toISOString(), ok: true, loc: 'א' }];
      _truRender();
      rTrustees();
      return {
        n: _truTasksActive().length,
        maxTask: _truMaxTaskPts(),
        maxTotal: _truMaxTotal(),
        min: _truMinTasks(),
        btn: (g('tru-n-btn') || {}).textContent,
        intro: (g('tru-n-intro') || {}).textContent,
        rules: (g('tru-score-rules') || {}).textContent,
        mgr: (g('tru-mgr-scorenote') || {}).textContent,
        card: (g('tru-score') || {}).textContent,
      };
    });
    check('six active tasks are six, not eight', r.n === 6, r);
    check('the ceiling follows: 6×10 + 20', r.maxTask === 60 && r.maxTotal === 80, r);
    check('the employee button says 6', r.btn === '6', r.btn);
    check('so does the explainer', r.intro === '6', r.intro);
    check('the scoring rules say «עד 60» and «מ-5», not «עד 80»', /60/.test(r.rules) && !/80/.test(r.rules) && /מ-5/.test(r.rules), r.rules);
    check('the manager’s leaderboard note says the same', /60/.test(r.mgr) && !/80/.test(r.mgr), r.mgr);
    check('the score card is /80 and /6, not /100 and /8', /\/80/.test(r.card) && /\/6/.test(r.card) && !/\/100/.test(r.card), r.card);

    const csv = await page.evaluate(() => {
      window.__blob = null;
      _truMgrM = null;                                // 4.8 left the page on last month
      _truExportCsv();
      return window.__blob ? window.__blob.text() : null;
    });
    check('the CSV that goes to the safety committee says «מתוך 6»', /מתוך 6/.test(csv || '') && !/מתוך 8/.test(csv || ''), (csv || '').split('\n')[1]);
    check('...and «≥5» comes from the code, not from a literal', /≥5/.test(csv || ''), (csv || '').split('\n')[1]);

    const behind = await page.evaluate(() => {
      DB.trustee_reports = [{ id: 'y1', u: 'מוסא עלי', t: 1, d: __iso(-1), ts: new Date().toISOString(), ok: true, loc: 'א' }];
      DB.trustees = [{ id: 'r1', n: 'מוסא עלי', dep: 'א', active: true }];
      DB.trustee_winners = [{ id: 'w', m: __prev(), u: 'x', pts: 1 }];   // silence the 4.8 line
      const real = _truDaysLeft;
      window._truDaysLeft = function () { return 3; };                   // mid-month onwards
      _renderToday();
      const el = [...document.querySelectorAll('#today-items .today-item')].find((x) => x.textContent.indexOf('משימות') >= 0);
      window._truDaysLeft = real;
      return el && el.textContent;
    });
    check('the home-screen nudge counts against the real threshold, not a literal 8', /\(1\/5\)/.test(behind || ''), behind);

    const eight = await page.evaluate(() => {
      DB.trustee_tasks = [];              // back to the built-in catalogue
      _truRender();
      return { btn: (g('tru-n-btn') || {}).textContent, card: (g('tru-score') || {}).textContent };
    });
    check('with the built-in eight it says 8 and /100 again — nothing was hard-coded the other way', eight.btn === '8' && /\/100/.test(eight.card), eight);
  }

  await page.evaluate(() => { try { localStorage.removeItem('tfgn_trustee_name'); } catch (e) {} });
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
