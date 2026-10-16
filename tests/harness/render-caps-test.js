// Two pages aggregate from many tables and painted every row they found.
// Measured 2026-09-20 against production-shaped data (375 NCRs, 150 rows in
// each expiry table, 200 pieces of equipment): the tasks page put 16,548
// elements in the DOM, the expiry page 9,647. That is a phone's scroll budget
// spent on rows nobody scrolls to.
//
// A cap is only safe if the numbers above it stay true and nothing urgent
// falls off the bottom. That is what this proves — plus the sync fan-out,
// which fired 38 GETs every time the user came back to the tab.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const seed = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window._tskShowAll = false; window._expShowAll = false;
    window._tskFilter = 'all'; window._expFilter = 'all';
    window._tskPrjFilter = ''; window._tskAssFilter = ''; window._tskSearchQ = '';
    const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    // 300 ordinary tasks, then five that are badly overdue and critical. They
    // are LAST in insertion order on purpose: if the cap were applied before
    // the sort, these are exactly what would be lost.
    DB.tasks = Array.from({ length: 300 }, (_, i) => ({ id: 't' + i, title: 'משימה ' + i, status: 'פתוח', due: iso(60 + i), assignee: 'דני', priority: 'רגיל' }))
      .concat(Array.from({ length: 5 }, (_, i) => ({ id: 'urgent' + i, title: 'דחוף ' + i, status: 'פתוח', due: iso(-90 - i), assignee: 'דני', priority: 'קריטי' })));
    ['ppe', 'tr', 'docs', 'ctr'].forEach((t) => { DB[t] = Array.from({ length: 150 }, (_, i) => ({ id: t + i, n: 'פריט ' + i, ty: 'סוג', w: 'עובד ' + i, o: 'דני', c: 'קבלן', e: iso(i % 120 - 40) })); });
    DB.equip_inspections = Array.from({ length: 200 }, (_, i) => ({ id: 'eq' + i, n: 'ציוד ' + i, code: 'C' + i, vendor: 'ספק', e: iso(i % 120 - 40) }));
    DB.ncr = []; DB.inc = []; DB.near_miss = []; DB.inspection_types = [];
  });

  console.log('\n1. the tasks page paints a ceiling, and says so');
  {
    await seed();
    const r = await page.evaluate(() => {
      goPage('tasks');
      const host = g('tb-tasks-cards');
      const all = (DB.tasks || []).concat(_collectVirtualTasks()).filter((t) => t.status !== 'הושלם' && t.status !== 'בוטל');
      return {
        painted: host.querySelectorAll('.tsk-card, [data-tid]').length || (host.children.length - 1),
        total: all.length,
        nodes: document.querySelectorAll('#pg-tasks *').length,
        note: (host.textContent.match(/מוצגות \d+ מתוך \d+/) || [''])[0],
        summary: (g('tsk-summary') || {}).textContent || '',
      };
    });
    check('far more rows exist than are painted', r.total > 300, r.total);
    check('the DOM stays under 5,000 elements (was 16,548)', r.nodes < 5000, r.nodes);
    check('a footer states how many of how many are shown', /מוצגות 200 מתוך/.test(r.note), r.note);
    check('the count pill above still shows the TRUE total, not 200', r.summary.indexOf('>' + r.total + '<') > 0 || r.summary.indexOf(String(r.total)) > 0, { summary: r.summary.slice(0, 120), total: r.total });
  }

  console.log('\n2. nothing urgent falls off the bottom');
  {
    const r = await page.evaluate(() => {
      const t = g('tb-tasks-cards').textContent;
      return { urgent: [0, 1, 2, 3, 4].filter((i) => t.indexOf('דחוף ' + i) >= 0).length, tail: t.indexOf('משימה 299') >= 0 };
    });
    check('all five overdue-critical tasks are painted, though they were seeded last', r.urgent === 5, r.urgent);
    check('...and the far-future tail is the part that was cut', !r.tail, r.tail);
  }

  console.log('\n3. the button paints the rest');
  {
    const r = await page.evaluate(() => {
      const before = document.querySelectorAll('#pg-tasks *').length;
      tskShowAll();
      const host = g('tb-tasks-cards');
      return { before: before, after: document.querySelectorAll('#pg-tasks *').length, tail: host.textContent.indexOf('משימה 299') >= 0, note: /מוצגות \d+ מתוך/.test(host.textContent) };
    });
    check('the DOM grows, so the rest really was painted', r.after > r.before * 2, r);
    check('the row that was cut is now there', r.tail, r);
    check('and the footer is gone, because nothing is hidden any more', !r.note, r);
  }

  console.log('\n4. a short list is untouched — no cap, no footer');
  {
    const r = await page.evaluate(() => {
      window._tskShowAll = false;
      DB.tasks = [{ id: 'a', title: 'משימה אחת', status: 'פתוח', due: null, assignee: 'דני', priority: 'רגיל' }];
      ['ppe', 'tr', 'docs', 'ctr', 'equip_inspections'].forEach((t) => { DB[t] = []; });
      rTasks();
      const host = g('tb-tasks-cards');
      return { text: host.textContent.indexOf('משימה אחת') >= 0, note: /מוצגות/.test(host.textContent) };
    });
    check('the one task is shown', r.text, r);
    check('and there is no "showing N of M" footer at all', !r.note, r);
  }

  console.log('\n5. the expiry page, same contract');
  {
    await seed();
    const r = await page.evaluate(() => {
      goPage('exp');
      const tb = g('tb-exp');
      const total = _expCollect().length + _expNoDate().length;
      return {
        total: total,
        rows: tb.querySelectorAll('tr').length,
        nodes: document.querySelectorAll('#pg-exp *').length,
        note: (tb.textContent.match(/מוצגות \d+ מתוך \d+/) || [''])[0],
        kpi: (g('exp-k-30') || {}).textContent,
      };
    });
    check('there are more expiring rows than the cap', r.total > 200, r.total);
    check('200 rows plus the footer row are painted', r.rows === 201, r.rows);
    check('the DOM stays under 4,000 elements (was 9,647)', r.nodes < 4000, r.nodes);
    check('the footer names the true total', r.note.indexOf(String(r.total)) > 0, { note: r.note, total: r.total });
    check('the ≤30 counter still counts the whole set, not the painted 200', Number(r.kpi) > 0 && Number(r.kpi) <= r.total, r.kpi);

    const after = await page.evaluate(() => { expShowAll(); const tb = g('tb-exp'); return { rows: tb.querySelectorAll('tr').length, note: /מוצגות/.test(tb.textContent) }; });
    check('"show all" paints every row', after.rows === r.total, after);
    check('and drops the footer', !after.note, after);
  }

  console.log('\n6. filtering down below the cap shows everything again');
  {
    const r = await page.evaluate(() => {
      window._expShowAll = false;
      window._expFilter = 'exp';           // only the already-expired
      rExp();
      const tb = g('tb-exp');
      const expired = _expCollect().filter((i) => du(i.e) < 0).length;
      return { expired: expired, rows: tb.querySelectorAll('tr').length, note: /מוצגות/.test(tb.textContent) };
    });
    check('a narrower filter paints its whole result when it fits', r.expired <= 200 ? (r.rows === r.expired && !r.note) : r.rows === 201, r);
  }

  console.log('\n7. coming back to the tab no longer fires 38 requests every time');
  {
    const r = await page.evaluate(() => {
      window.__pulls = 0;
      window.sbSync = function () { window.__pulls++; };
      SB_ON = true; _sbFocusPull = 0;
      window._obDrain = function () {};
      window.dispatchEvent(new Event('focus'));
      const first = window.__pulls;
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      const afterFour = window.__pulls;
      // wind the clock back past the window and try again
      _sbFocusPull = Date.now() - 61000;
      window.dispatchEvent(new Event('focus'));
      const afterMinute = window.__pulls;
      // reconnecting always pulls, however recently one ran
      window.dispatchEvent(new Event('online'));
      return { first: first, afterFour: afterFour, afterMinute: afterMinute, afterOnline: window.__pulls };
    });
    check('the first tab-back still pulls', r.first === 1, r);
    check('three more tab-backs in a row pull nothing', r.afterFour === 1, r);
    check('a minute later it pulls again', r.afterMinute === 2, r);
    check('reconnecting after being offline pulls immediately, throttle or not', r.afterOnline === 3, r);
  }

  console.log('\n8. an explicit "full sync" is never throttled');
  {
    const r = await page.evaluate(() => {
      window.__pulls = 0;
      window.sbSync = function () { window.__pulls++; };
      SB_ON = true; _sbFocusPull = Date.now();
      window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
      try { forceSync(); } catch (e) { return { err: String(e.message) }; }
      return { pulls: window.__pulls };
    });
    check('forceSync pulls even when a focus pull just ran', r.pulls >= 1, r);
  }

  console.log('\n8b. realtime up: the full pull is a safety net, not a 10-minute habit (BACKLOG 14.4, 16/10/2026)');
  {
    const r = await page.evaluate(() => {
      window.__pulls = 0;
      window.sbSync = function () { window.__pulls++; _sbFocusPull = Date.now(); };
      window._obDrain = function () {};
      SB_ON = true;
      const ago = (ms) => { _sbFocusPull = Date.now() - ms; };
      const vis = (hiddenMs) => {
        _sbHiddenAt = Date.now() - hiddenMs;
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const out = {};
      _rtState = 'SUBSCRIBED'; _sbHiddenFor = 0;
      ago(11 * 60000); _sbTimerPull(); out.timer11 = window.__pulls;            // realtime up, 11 min: no
      ago(61 * 60000); _sbTimerPull(); out.timer61 = window.__pulls;            // an hour: yes
      ago(5 * 60000); window.dispatchEvent(new Event('focus')); out.focus = window.__pulls;   // quick app switch: no
      ago(5 * 60000); vis(30000); out.short = window.__pulls;                   // 30s in the background: no
      ago(5 * 60000); vis(3 * 60000); out.long = window.__pulls;                // 3 min in the background: yes
      ago(5 * 60000); window.dispatchEvent(new Event('online')); out.online = window.__pulls;  // reconnect: always
      _rtState = 'CLOSED';
      ago(11 * 60000); _sbTimerPull(); out.offTimer = window.__pulls;           // no realtime: every 10 min, as before
      ago(61000); window.dispatchEvent(new Event('focus')); out.offFocus = window.__pulls;
      delete document.visibilityState;
      return out;
    });
    check('realtime up: the 10-minute timer skips while the last pull is under an hour old', r.timer11 === 0, r);
    check('...and still pulls once an hour', r.timer61 === 1, r);
    check('realtime up: a quick switch back to the app pulls nothing', r.focus === 1 && r.short === 1, r);
    check('realtime up: back after 3 minutes in the background pulls (the socket may have died)', r.long === 2, r);
    check('a reconnect always pulls', r.online === 3, r);
    check('realtime down: the 10-minute timer and the focus pull work as before', r.offTimer === 4 && r.offFocus === 5, r);
    // Broken on purpose (16/10/2026): with _rtLive() returning false the first check fails (1);
    // with the hidden time ignored the fourth fails.
  }

  console.log('\n9. NCR, employees, tour hazards and trustee reports: the same cap (BACKLOG 14.3, 16/10/2026)');
  {
    // Measured in the deep review of 15/10/2026: 1000 NCRs painted in 2.7s, 500 employees in 1.9s.
    const r = await page.evaluate(() => {
      const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
      window._ncrShowAll = false; window._empShowAll = false; window._thzShowAll = false; window._truShowAll = false;
      window._ncrQF = ''; window._ncrCauseFilter = null;
      DB.ncr = Array.from({ length: 1000 }, (_, i) => ({ id: 'n' + i, num: 'NCR-' + i, d: 'ליקוי ' + i, a: 'בטיחות', s: 'פתוח', p: 'נמוכה', sd: iso(-i) }))
        .concat(Array.from({ length: 3 }, (_, i) => ({ id: 'crit' + i, num: 'NCR-C' + i, d: 'קריטי ' + i, a: 'בטיחות', s: 'פתוח', p: 'קריטי', sd: iso(-2000) })));
      DB.emp = Array.from({ length: 500 }, (_, i) => ({ id: 'e' + i, n: 'עובד ' + i, dept: 'ייצור', left_d: i < 100 ? iso(30) : null }))   // 100 with a leaving date ahead
        .concat([{ id: 'left1', n: 'עזב', dept: 'ייצור', left_d: iso(-10) }]);
      DB.tour_hazards = Array.from({ length: 300 }, (_, i) => ({ id: 'h' + i, n: i + 1, d: iso(-i), loc: 'מחסן', descr: 'מפגע ' + i, s: 'פתוח' }));
      DB.trustee_reports = Array.from({ length: 300 }, (_, i) => ({ id: 'tr' + i, u: 'לב', t: 1, d: iso(-(i % 60)), m: iso(0).slice(0, 7), loc: 'מחסן', ok: false, f: 'ממצא ' + i, s: 'פתוח', ts: new Date(Date.now() - i * 60000).toISOString() }));
      const out = {};
      let t0 = performance.now(); goPage('ncr'); out.ncrMs = Math.round(performance.now() - t0);
      const nt = g('tb-ncr');
      out.ncr = { rows: nt.querySelectorAll('tr').length, crit: [0, 1, 2].filter((i) => nt.textContent.indexOf('קריטי ' + i) >= 0).length,
        note: (nt.textContent.match(/מוצגות \d+ מתוך \d+/) || [''])[0], sum: ((g('ncr-summary') || {}).textContent || '') };
      const undo = _capLiftForExport();
      out.ncrExport = nt.querySelectorAll('tr').length;
      undo();
      out.ncrBack = nt.querySelectorAll('tr').length;
      ncrShowAll(); out.ncrAll = nt.querySelectorAll('tr').length;
      t0 = performance.now(); goPage('emp'); out.empMs = Math.round(performance.now() - t0);
      const et = g('tb-emp');
      out.emp = { rows: et.querySelectorAll('tr').length, left: et.textContent.indexOf('עזב') >= 0, note: /מוצגות 200 מתוך 501/.test(et.textContent) };
      empShowAll(); out.empAll = et.querySelectorAll('tr').length;
      goPage('thz'); const ht = g('tb-thz');
      out.thz = { rows: ht.querySelectorAll('tr').length, newest: ht.textContent.indexOf('מפגע 299') >= 0, oldest: ht.textContent.indexOf('מפגע 0') >= 0 && /מפגע 0(?!\d)/.test(ht.textContent) };
      goPage('trustees'); try { _truMgrSetFilter('all'); } catch (e) {} rTrustees(); const tt = g('tb-trustees');
      out.tru = { rows: tt.querySelectorAll('tr').length, note: /מוצגות 200 מתוך 300/.test(tt.textContent) };
      truShowAll(); out.truAll = tt.querySelectorAll('tr').length;
      // _empLeft reads the date once a minute, not once per row
      let calls = 0; const real = Date.prototype.toLocaleDateString;
      Date.prototype.toLocaleDateString = function () { calls++; return real.apply(this, arguments); };
      _empTodayC.t = 0; DB.emp.forEach((e) => _empLeft(e));
      Date.prototype.toLocaleDateString = real;
      out.dateCalls = calls;
      return out;
    });
    check('NCR: 200 rows plus the footer, out of 1003', r.ncr.rows === 201 && /מוצגות 200 מתוך 1003/.test(r.ncr.note), r.ncr);
    check('NCR: the three critical ones, seeded last and oldest, are painted', r.ncr.crit === 3, r.ncr);
    check('NCR: the summary above still counts all 1003', r.ncr.sum.indexOf('1003') >= 0, r.ncr.sum.slice(0, 80));
    check('NCR: export lifts the cap and puts it back', r.ncrExport === 1003 && r.ncrBack === 201, r);
    check('NCR: «show all» paints every row', r.ncrAll === 1003, r.ncrAll);
    check('employees: 200 plus the footer, the one who left is the part cut', r.emp.rows === 201 && !r.emp.left && r.emp.note, r.emp);
    check('employees: «show all» paints all 501', r.empAll === 501, r.empAll);
    check('tour hazards: capped, newest first kept', r.thz.rows === 201 && r.thz.newest && !r.thz.oldest, r.thz);
    check('trustee reports: capped with the footer, «show all» paints 300', r.tru.rows === 201 && r.tru.note && r.truAll === 300, r);
    check('_empLeft over 101 employees with a leaving date reads the date once, not 101 times', r.dateCalls === 1, r.dateCalls);
    // Broken on purpose (16/10/2026): NCR without _capRows fails two (1003 rows); _CAP_PAGES without ncr
    // fails the export one; _empLeft back to toLocaleDateString per row fails the last (101).
    console.log('    (paint: NCR ' + r.ncrMs + 'ms, employees ' + r.empMs + 'ms)');
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
