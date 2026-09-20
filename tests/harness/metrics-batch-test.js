// Four things about the numbers the management review is built on.
//
// 6.2  Two different formulas for "days to close" on the same home screen.
//      The KPI tile used cd − ts, and ts is the row's LAST-SAVED stamp,
//      rewritten by svNcr on every edit and by _reopen. Open an NCR from
//      2025, fix a comma, save — ts jumps to today, cd stays in the past, and
//      the result is NEGATIVE: the tile counted it as a fast close (days<=30
//      is true for -300 too) and dragged the average below zero. The
//      dashboard card used cd − sd and got a different number from the same
//      rows, so the same screen showed «42 יום» and «12- יום».
//
// 6.3  Both time metrics ran over all history with no window, so a brilliant
//      quarter or a terrible one barely moved a number averaged over 375
//      records going back to 2023. «השתפרנו?» had no answer on the screen,
//      and there was no period picker anywhere in the reports.
//
// 6.4  The AI narrative prompt asked whether the trend is better than the
//      previous quarter, under a hard rule saying not to invent numbers, from
//      a context built entirely from the current quarter. It could only
//      produce a vague sentence or a number it made up — in a text meant to
//      be pasted into a signed management-review record.
//
// 6.10 Nothing anywhere compared closed_date against due. And svTsk rebuilt
//      the task row from the form and overwrote the stored one, so a task
//      closed through the modal lost closed_date entirely — the two quick
//      paths stamp it and the form silently dropped it, which also biased the
//      weekly and annual "tasks completed" counts.
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

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__upd = []; window.__ins = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__qStart = function (back) {
      // the first day of the quarter `back` quarters ago
      const d = new Date(); let qi = Math.floor(d.getMonth() / 3) - (back || 0); let y = d.getFullYear();
      while (qi < 0) { qi += 4; y--; }
      return new Date(y, qi * 3, 2).toISOString().split('T')[0];
    };
    window.__blank = function () {
      ['ncr', 'inc', 'near_miss', 'tasks', 'rounds', 'ppe', 'tr', 'docs', 'ctr',
       'equip_inspections', 'med', 'toolbox', 'inspection_types'].forEach((t) => { DB[t] = []; });
    };
  });

  console.log('\n6.2 one definition of «days to close»');
  {
    const r = await page.evaluate(() => {
      __blank();
      return {
        normal: _ncrCloseDays({ sd: '2026-01-01', cd: '2026-01-21' }),
        // the row that broke it: opened 2025, edited today, so ts is today
        edited: _ncrCloseDays({ sd: '2025-03-01', cd: '2025-04-10', ts: new Date().toISOString() }),
        noOpen: _ncrCloseDays({ cd: '2026-01-21' }),
        noClose: _ncrCloseDays({ sd: '2026-01-01' }),
        backwards: _ncrCloseDays({ sd: '2026-05-01', cd: '2026-01-01' }),
        legacy: _ncrCloseDays({ src_date: '2026-01-01', cd: '2026-01-11' }),
        opened: _ncrOpenedAt({ src_date: '2026-01-01', ts: 'x' }),
      };
    });
    check('discovery to closure, in days', r.normal === 20, r.normal);
    check('an edit today does not change a closure that happened last year', r.edited === 40, r.edited);
    check('...which is the bug: cd − ts would have been a large negative number', r.edited > 0, r.edited);
    check('no discovery date means no answer, rather than a wrong one', r.noOpen === null, r.noOpen);
    check('an open NCR has no closing time', r.noClose === null, r.noClose);
    check('a closing date before the discovery date is bad data, not a fast close', r.backwards === null, r.backwards);
    check('the legacy src_date column counts as the discovery date', r.legacy === 10, r.legacy);
    check('...and ts is never used as one', r.opened === '2026-01-01', r.opened);

    const agree = await page.evaluate(() => {
      __blank();
      const y = new Date(); y.setMonth(y.getMonth() - 2);
      const iso = (d) => d.toISOString().split('T')[0];
      const open = new Date(y); const close = new Date(y); close.setDate(close.getDate() + 20);
      DB.ncr = [
        { id: 'a', num: 'N1', s: 'סגור', sd: iso(open), cd: iso(close), ts: new Date().toISOString() },
        { id: 'b', num: 'N2', s: 'סגור', sd: iso(open), cd: iso(close), ts: new Date().toISOString() },
      ];
      DB.inc = []; DB.near_miss = []; DB.tasks = []; DB.rounds = [];
      goPage('dash');
      const kpi = (g('dash-kpi') || {}).textContent || '';
      const card = (g('dash-ncr-time') || {}).textContent || '';
      return { kpi: kpi, card: card, stats: _ncrTimeStats(null, null) };
    });
    check('the two rows really are 20 days each', agree.stats.avg === 20 && agree.stats.n === 2, agree.stats);
    // «ב-12 חודשים» contains a hyphen-digit, so read the value, not the whole string
    check('the KPI tile says 20 days, and it is positive', /20י/.test(agree.kpi) && agree.stats.avg > 0, agree.kpi.slice(0, 200));
    check('...and the dashboard card agrees with it — they used to disagree', /20\.0/.test(agree.card), agree.card.slice(0, 200));
    check('both say 100% closed within 30 days', /100%/.test(agree.kpi) && /100%/.test(agree.card), [agree.kpi.slice(0, 120), agree.card.slice(0, 120)]);
  }

  console.log('\n6.3 the numbers can be read for one quarter');
  {
    const r = await page.evaluate(() => {
      const now = _mrPeriod(0), prev = _mrPeriod(1), four = _mrPeriod(4);
      return {
        now: now.label, prev: prev.label, four: four.label,
        rolls: prev.y < now.y || prev.q === now.q - 1,
        yearBack: four.y === now.y - 1 && four.q === now.q,
        order: prev.end < now.start,
      };
    });
    check('the quarter can be stepped back', r.now !== r.prev, r);
    check('...rolling into the previous year at Q1', r.rolls, r);
    check('four quarters back is the same quarter a year earlier', r.yearBack, r);
    check('and the windows do not overlap', r.order, r);

    const nav = await page.evaluate(() => {
      __blank();
      goPage('mr');
      const before = (g('mr-period') || {}).textContent;
      const navHtml = (g('mr-period-nav') || {}).innerHTML || '';
      _mrShift(1);
      const after = (g('mr-period') || {}).textContent;
      const backHtml = (g('mr-period-nav') || {}).innerHTML || '';
      _mrShift(0);
      return { before: before, after: after, navHtml: navHtml, backHtml: backHtml, reset: (g('mr-period') || {}).textContent };
    });
    check('the management review has a period picker at all', /_mrShift/.test(nav.navHtml), nav.navHtml.slice(0, 200));
    check('stepping back changes the period shown', nav.before !== nav.after, nav);
    check('...and from there you can come forward again, or jump to now', /הרבעון הנוכחי/.test(nav.backHtml), nav.backHtml.slice(0, 260));
    check('and it does', nav.reset === nav.before, nav);

    const windowed = await page.evaluate(() => {
      __blank();
      const p = _mrPeriod(0), pp = _mrPeriod(1);
      const inQ = (per, plus) => { const d = new Date(per.start); d.setDate(d.getDate() + (plus || 1)); return d.toISOString().split('T')[0]; };
      DB.ncr = [
        // this quarter: 10 days
        { id: 'a', s: 'סגור', sd: inQ(p, 1), cd: inQ(p, 11) },
        // last quarter: 50 days
        { id: 'b', s: 'סגור', sd: inQ(pp, 1), cd: inQ(pp, 51) },
      ];
      return {
        all: _ncrTimeStats(null, null).avg,
        thisQ: _ncrTimeStats(p.start, p.end).avg,
        lastQ: _ncrTimeStats(pp.start, pp.end).avg,
      };
    });
    check('over all history the two average out to 30', windowed.all === 30, windowed);
    check('this quarter on its own is 10', windowed.thisQ === 10, windowed);
    check('and the quarter before it is 50 — a bad quarter is now visible', windowed.lastQ === 50, windowed);
  }

  console.log('\n6.4 the previous quarter is on the page, and in the prompt');
  {
    const r = await page.evaluate(() => {
      __blank();
      const p = _mrPeriod(0), pp = _mrPeriod(1);
      const inQ = (per, plus) => { const d = new Date(per.start); d.setDate(d.getDate() + (plus || 1)); return d.toISOString().split('T')[0]; };
      DB.ncr = [
        { id: 'a', s: 'פתוח', sd: inQ(p, 1) }, { id: 'b', s: 'פתוח', sd: inQ(p, 2) },
        { id: 'c', s: 'פתוח', sd: inQ(pp, 1) }, { id: 'd', s: 'פתוח', sd: inQ(pp, 2) },
        { id: 'e', s: 'פתוח', sd: inQ(pp, 3) }, { id: 'f', s: 'פתוח', sd: inQ(pp, 4) },
      ];
      DB.near_miss = [{ id: 'n1', d: inQ(p, 1) }, { id: 'n2', d: inQ(p, 2) }, { id: 'n3', d: inQ(pp, 1) }];
      _MR_OFFSET = 0;
      goPage('mr');
      return {
        counts: window._mrCounts,
        dNew: (g('mr-d-ncr-new') || {}).textContent || '',
        dNewHtml: (g('mr-d-ncr-new') || {}).innerHTML || '',
        dNm: (g('mr-d-nm') || {}).innerHTML || '',
        shown: (g('mr-ncr-q-new') || {}).textContent,
      };
    });
    check('this quarter has 2 new NCRs, last had 4', r.counts && r.counts.cur.ncrNew === 2 && r.counts.prev.ncrNew === 4, r.counts);
    check('the page shows the delta next to the number', /2/.test(r.dNew) && /4/.test(r.dNew), r.dNew);
    check('fewer NCRs reads as an improvement — green and a down arrow', /#16a34a/.test(r.dNewHtml) && /▼/.test(r.dNewHtml), r.dNewHtml);
    // Near-misses are the opposite of findings: MORE reported is a healthier
    // culture, so the same +1 that is red on NCRs must be green here.
    check('more near-misses reported reads as good, unlike more NCRs', /#16a34a/.test(r.dNm) && /▲/.test(r.dNm), r.dNm);

    const prompt = await page.evaluate(() => {
      let sent = null;
      window.fetch = function (u, o) {
        sent = JSON.parse((o && o.body) || '{}');
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ content: [{ text: 'ok' }] })) });
      };
      _mrAINarrative();
      return new Promise((res) => setTimeout(() => res(JSON.stringify(sent || {})), 250));
    });
    check('the prompt now carries the previous quarter', /רבעון קודם/.test(prompt), prompt.slice(0, 400));
    check('...with the actual numbers, so the model has no reason to invent any', /NCR שנפתחו: 2/.test(prompt) && /רבעון קודם 4/.test(prompt), (prompt.match(/NCR[^"]{0,60}/) || [])[0]);
    check('...and it names which quarter it is comparing against', /Q\d \d{4}/.test(prompt), (prompt.match(/Q\d \d{4}/g) || []).slice(0, 3));
    check('the rule against inventing numbers is still there', /אל תמציא מספרים/.test(prompt), prompt.indexOf('אל תמציא'));
  }

  console.log('\n6.10 closed on time, by month');
  {
    const r = await page.evaluate(() => {
      __blank();
      _svEditing.tasks = null;
      DB.tasks = [{ id: 't1', title: 'משימה', status: 'פתוח', due: __iso(-3), assignee: 'דני', ext_id: 'onedrive-42' }];
      openTskModal();
      g('tsk-id').value = 't1'; g('tsk-title').value = 'משימה';
      g('tsk-due').value = __iso(-3); g('tsk-status').value = 'הושלם';
      svTsk();
      return { closed: DB.tasks[0].closed_date, ext: DB.tasks[0].ext_id, today: __iso(0) };
    });
    check('closing a task through the form now stamps closed_date', r.closed === r.today, r);
    check('...and ext_id survives the save, which the OneDrive link depends on', r.ext === 'onedrive-42', r);

    const kept = await page.evaluate(() => {
      DB.tasks = [{ id: 't2', title: 'x', status: 'הושלם', due: __iso(-10), closed_date: '2026-01-05' }];
      openTskModal();
      g('tsk-id').value = 't2'; g('tsk-title').value = 'x עודכן'; g('tsk-due').value = __iso(-10); g('tsk-status').value = 'הושלם';
      svTsk();
      return DB.tasks[0].closed_date;
    });
    check('an existing closing date is not overwritten by a later edit', kept === '2026-01-05', kept);

    const reopened = await page.evaluate(() => {
      DB.tasks = [{ id: 't3', title: 'x', status: 'הושלם', due: __iso(-10), closed_date: '2026-01-05' }];
      openTskModal();
      g('tsk-id').value = 't3'; g('tsk-title').value = 'x'; g('tsk-due').value = __iso(-10); g('tsk-status').value = 'פתוח';
      svTsk();
      return DB.tasks[0].closed_date;
    });
    check('reopening a task clears it — it is not closed any more', reopened === null, reopened);

    const series = await page.evaluate(() => {
      __blank();
      const mon = (back, day) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'); };
      DB.tasks = [
        // last month: 2 of 3 on time
        { id: 'a', status: 'הושלם', due: mon(1, 10), closed_date: mon(1, 8) },
        { id: 'b', status: 'הושלם', due: mon(1, 10), closed_date: mon(1, 10) },
        { id: 'c', status: 'הושלם', due: mon(1, 10), closed_date: mon(1, 25) },
        // a task with no due date cannot be late and must not flatter the number
        { id: 'd', status: 'הושלם', closed_date: mon(1, 5) },
        // still open, and a cancelled one
        { id: 'e', status: 'פתוח', due: mon(1, 3) },
        { id: 'f', status: 'בוטל', due: mon(1, 3), closed_date: mon(1, 4) },
      ];
      const m = _tskOnTime12();
      const last = m[m.length - 2];
      return { pct: last.pct, done: last.done, onTime: last.onTime, thisMonth: m[m.length - 1].pct, html: _tskOnTime12Html() };
    });
    check('last month is 67% — two of the three that had a target', r === undefined || (series.pct === 67 && series.done === 3), series);
    check('a task with no due date is not counted at all', series.done === 3, series);
    check('a month with nothing closed is null, not 0% — those are different', series.thisMonth === null, series.thisMonth);
    check('the card says the 12-month figure in words', /נסגרו בזמן ב-12 חודשים/.test(series.html), series.html.slice(-200));
    check('...and it is a hand-drawn SVG, like the rest', /^<svg/.test(series.html), series.html.slice(0, 60));

    const onPage = await page.evaluate(() => {
      goPage('mr');
      const card = g('mr-ontime-card'), body = g('mr-ontime'), pg = g('pg-mr');
      return { shown: card && card.style.display !== 'none', svg: /<svg/.test((body || {}).innerHTML || ''), onPage: !!(pg && pg.contains(card)) };
    });
    check('it is on the management review, which is what makes it printable', onPage.shown && onPage.svg && onPage.onPage, onPage);

    const empty = await page.evaluate(() => {
      __blank();
      goPage('mr');
      const card = g('mr-ontime-card');
      return !card || card.style.display === 'none';
    });
    check('with nothing closed anywhere the card stays hidden', empty, empty);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
