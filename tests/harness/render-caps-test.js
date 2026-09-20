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

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
