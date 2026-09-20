// 6.13 — «are we getting safer?»
//
// Nothing in the app answered it. Open counts, an ISO evidence sheet, and an
// AI narrative told to compare with last quarter while being handed no
// last-quarter numbers. The one real 12-month chart lived in a 360px panel
// inside the NCR Agent modal, reachable only from a button you had to already
// know about.
//
// Not charts on the home page — DECISIONS.md 2026-04-19 records that four
// Chart.js graphs went on the dashboard in PR #16 and Michael asked for them
// removed. A separate printable sheet, hand-written SVG, on demand.
//
// And three fields in the weekly summary that IS forwarded to plant management
// name columns that do not exist, so it has reported zero critical NCRs and
// zero lost days every week since it shipped.
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
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    // capture the print window instead of opening one
    window.__printed = '';
    window.open = function () {
      return { document: { write: function (h) { window.__printed += h; }, close: function () {} } };
    };
    // n days ago, as YYYY-MM-DD
    window.__ago = (n) => new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
  });

  console.log('\n6.13 the two periods are the same length');
  {
    const w = await page.evaluate(() => {
      const w = _trendWindows();
      const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
      return { w: w, cur: days(w.from, w.to), prev: days(w.pFrom, w.pTo) };
    });
    // Comparing nine months of this year with twelve of last is how a plant
    // «improves» on paper every January.
    check('the current window is about a year', w.cur >= 365 && w.cur <= 366, w);
    check('...and the previous one is exactly as long', Math.abs(w.cur - w.prev) <= 1, w);
    check('...and they meet without overlapping', w.w.pTo === w.w.from, w.w);
  }

  console.log('\n6.13 up is not always good');
  {
    const r = await page.evaluate(() => ({
      incUp: _trendDelta(10, 5, false).dir,
      incDown: _trendDelta(5, 10, false).dir,
      nmUp: _trendDelta(40, 20, true).dir,
      nmDown: _trendDelta(20, 40, true).dir,
      flat: _trendDelta(7, 7, true),
      noBase: _trendDelta(3, 0, false),
      nothing: _trendDelta(0, 0, false),
      missing: _trendDelta(null, 5, false).txt,
      pct: _trendDelta(15, 10, false).txt,
    }));
    check('more incidents is worse', r.incUp === 'bad', r);
    check('fewer incidents is better', r.incDown === 'good', r);
    check('MORE near-miss reports is better, not worse', r.nmUp === 'good', r);
    check('...and a drop in them is the bad direction — that is a reporting collapse', r.nmDown === 'bad', r);
    check('no change says so rather than showing 0%', /ללא שינוי/.test(r.flat.txt) && r.flat.dir === 'flat', r.flat);
    check('nothing to compare against is not a 100% improvement', /אין בסיס/.test(r.noBase.txt) && r.noBase.dir === 'flat', r.noBase);
    check('...and zero-against-zero says nothing at all', r.nothing.txt === '—', r.nothing);
    check('a metric with no value is a dash, not a number', r.missing === '—', r.missing);
    check('the size of the change is shown', /50%/.test(r.pct), r.pct);
  }

  console.log('\n6.13 each table is read by its own date column');
  {
    const r = await page.evaluate(() => {
      // inc dates live on `dt`; near_miss/rounds on `d`; ncr on `sd` / `cd`.
      // A caller that guesses wrong reports zero for ever without erroring.
      DB.inc = [{ id: 'i1', dt: __ago(30), d: 'תיאור לא תאריך', dy: 4 }, { id: 'i2', dt: __ago(400), d: 'ישן', dy: 9 }];
      DB.near_miss = [{ id: 'm1', d: __ago(20) }, { id: 'm2', d: __ago(40) }, { id: 'm3', d: __ago(400) }];
      DB.ncr = [{ id: 'n1', sd: __ago(10) }, { id: 'n2', sd: __ago(400) }];
      const w = _trendWindows();
      return {
        incNow: _trendRows('inc', ['dt', 'd'], w.from, w.to).length,
        incPrev: _trendRows('inc', ['dt', 'd'], w.pFrom, w.pTo).length,
        nmNow: _trendRows('near_miss', ['d', 'ts'], w.from, w.to).length,
        ncrNow: _trendRows('ncr', ['sd', 'ts'], w.from, w.to).length,
        fallback: _trendRows('near_miss', ['nope', 'd'], w.from, w.to).length,
        missing: _trendRows('near_miss', ['nope'], w.from, w.to).length,
      };
    });
    check('incidents are counted by dt, not by the description field', r.incNow === 1, r);
    check('...and last year’s incident lands in last year’s window', r.incPrev === 1, r);
    check('near misses are counted by their own column', r.nmNow === 2, r);
    check('NCRs are counted by the discovery date', r.ncrNow === 1, r);
    check('a fallback column is used when the first is absent', r.fallback === 2, r);
    check('a column that exists nowhere counts nothing, rather than everything', r.missing === 0, r);
  }

  console.log('\n6.13 the sheet says what it is comparing');
  {
    const r = await page.evaluate(() => {
      DB.inc = [{ id: 'i1', dt: __ago(30), dy: 4 }, { id: 'i2', dt: __ago(400), dy: 9 }, { id: 'i3', dt: __ago(410), dy: 1 }];
      DB.near_miss = [{ id: 'm1', d: __ago(20) }, { id: 'm2', d: __ago(40) }, { id: 'm3', d: __ago(400) }];
      DB.ncr = [{ id: 'n1', sd: __ago(10), cd: __ago(5) }, { id: 'n2', sd: __ago(400), cd: __ago(380) }];
      DB.rounds = [{ id: 'r1', d: __ago(5) }];
      DB.toolbox = [{ id: 't1', d: __ago(5) }];
      DB.trustee_reports = [{ id: 'tr1', d: __ago(5) }];
      window.__printed = '';
      safetyTrendReport();
      return window.__printed;
    });
    check('the report is produced', r.length > 500, r.length);
    check('it is titled with the question it answers', /האם אנחנו בטוחים יותר/.test(r), r.slice(0, 200));
    check('it prints A4 like the other sheets', /@page\{size:A4/.test(r));
    check('it has the print button and hides it when printing', /onclick="window\.print\(\)"/.test(r) && /\.no-print\{display:none!important\}/.test(r));
    check('incidents are in it', /תאונות/.test(r), r.slice(0, 400));
    check('...with the lost days read from the right column (4, not 0)', />4</.test(r), (r.match(/ימי ההיעדרות[\s\S]{0,140}/) || [])[0]);
    check('last year’s lost days are the other two (10)', />10</.test(r), (r.match(/ימי ההיעדרות[\s\S]{0,140}/) || [])[0]);
    check('the near-miss : incident ratio is on the sheet', /יחס כמעט-נפגע/.test(r), r.slice(0, 400));
    check('closure speed is on the sheet', /זמן סגירה ממוצע/.test(r));
    check('the 12-month chart comes along instead of hiding in a modal', /<svg/.test(r));
    check('the note spells out that the two periods are equal length', /באורך זהה/.test(r), (r.match(/class="note"[\s\S]{0,120}/) || [])[0]);
    check('...and warns that a drop in near-miss reports is not an improvement', /קריסת דיווח/.test(r), (r.match(/class="note"[\s\S]{0,400}/) || [])[0]);
    check('it carries a signature line, like the ISO sheet', /class="line"/.test(r));

    // Direction is assigned per indicator, and the sheet is where that happens.
    // If the near-miss row were wired up like the incident row, a plant whose
    // people stopped reporting would read as one that got safer.
    const dir = await page.evaluate(() => {
      DB.inc = [{ id: 'i1', dt: __ago(30) }, { id: 'i2', dt: __ago(60) }, { id: 'i3', dt: __ago(400) }];
      DB.near_miss = [{ id: 'm1', d: __ago(10) }, { id: 'm2', d: __ago(20) }, { id: 'm3', d: __ago(30) }, { id: 'm4', d: __ago(400) }];
      DB.ncr = []; DB.rounds = []; DB.toolbox = []; DB.trustee_reports = [];
      window.__printed = '';
      safetyTrendReport();
      const doc = new DOMParser().parseFromString(window.__printed, 'text/html');
      const rowOf = (label) => Array.from(doc.querySelectorAll('tr'))
        .find((tr) => (tr.textContent || '').indexOf(label) === 0 || new RegExp('^\\s*' + label).test(tr.textContent || ''));
      const cls = (label) => { const tr = rowOf(label); return tr ? tr.className : null; };
      return { inc: cls('תאונות'), nm: cls('דיווחי כמעט-ונפגע') };
    });
    check('both rose — and the sheet calls more incidents the bad direction', dir.inc === 'bad', dir);
    check('...while more near-miss reports is the good one', dir.nm === 'good', dir);

    const empty = await page.evaluate(() => {
      ['inc', 'near_miss', 'ncr', 'rounds', 'toolbox', 'trustee_reports'].forEach((t) => { DB[t] = []; });
      window.__printed = '';
      safetyTrendReport();
      return window.__printed;
    });
    check('with no data at all it still prints, rather than throwing', empty.length > 500, empty.length);
    check('...and claims no improvement it cannot show', !/▲|▼/.test(empty), (empty.match(/tbody[\s\S]{0,200}/) || [])[0]);
  }

  console.log('\n6.13 the report is reachable without knowing it exists');
  {
    // Not in a modal you have to already know about: the ⋯ menu, beside the
    // ISO readiness sheet, which is where Michael already goes for a report.
    const r = await page.evaluate(() => {
      document.querySelectorAll('.top-more-menu,[data-more-menu]').forEach((n) => n.remove());
      const before = document.body.innerHTML.length;
      _topMoreMenu(document.body);
      const added = document.body.innerHTML.slice(before - 200);
      const hit = Array.from(document.body.querySelectorAll('div,button'))
        .map((n) => n.textContent || '').filter((t) => /בטוחים יותר/.test(t));
      const iso = Array.from(document.body.querySelectorAll('div,button'))
        .map((n) => n.textContent || '').filter((t) => /מוכנות לביקורת ISO/.test(t));
      return { hit: hit.length, iso: iso.length, added: added.length };
    });
    check('the menu that holds the ISO sheet now holds this one too', r.hit > 0 && r.iso > 0, r);

    const fires = await page.evaluate(() => {
      window.__printed = '';
      const btns = Array.from(document.body.querySelectorAll('div,button'))
        .filter((n) => /בטוחים יותר/.test(n.textContent || '') && typeof n.onclick === 'function');
      if (!btns.length) return { clicked: false };
      btns[btns.length - 1].onclick({ stopPropagation: function () {} });
      return { clicked: true, printed: window.__printed.length };
    });
    check('...and pressing it actually produces the sheet', fires.clicked && fires.printed > 500, fires);

    const gated = await page.evaluate(() => {
      const real = window._role;
      window._role = function () { return 'reporter'; };
      document.querySelectorAll('.top-more-menu,[data-more-menu]').forEach((n) => n.remove());
      _topMoreMenu(document.body);
      const hit = Array.from(document.body.querySelectorAll('div,button'))
        .map((n) => n.textContent || '').filter((t) => /בטוחים יותר/.test(t)).length;
      window._role = real;
      return hit;
    });
    check('a reporter does not get a plant-wide trend report', gated === 0, gated);
  }

  console.log('\nthe weekly summary sent to management stops reporting zeros');
  {
    // ncr severity is `p` (נמוכה/בינונית/גבוהה/קריטי) — there is no `sv` on ncr
    // at all — and lost days on an incident are `dy`, not `lost_days`.
    const src = await page.evaluate(() => {
      const fn = String(window._aiWeeklySummary);
      return {
        crit: /ncrLast\.filter\(function\(r\)\{return r\.p===CRIT/.test(fn),
        high: /ncrLast\.filter\(function\(r\)\{return r\.p===HIGH/.test(fn),
        ld: /parseInt\(r\.dy\|\|0,10\)/.test(fn),
        noSv: !/r\.sv===CRIT|r\.sv===HIGH/.test(fn),
        noLost: !/r\.lost_days/.test(fn),
      };
    });
    check('critical NCRs are counted from the field that holds severity', src.crit && src.noSv, src);
    check('...and the same for the «גבוהה» bucket', src.high, src);
    check('lost days are summed from dy, the column that exists', src.ld && src.noLost, src);

    // and prove it end to end, not just by reading the source
    const live = await page.evaluate(() => {
      DB.ncr = [{ id: 'n1', num: 'NCR-1', d: 'x', p: 'קריטי', sd: new Date().toISOString().split('T')[0] }];
      DB.inc = [{ id: 'i1', dt: new Date().toISOString().split('T')[0], d: 'נפילה', dy: 7 }];
      DB.near_miss = []; DB.rounds = []; DB.tasks = [];
      let sent = null;
      window.fetch = function (u, o) { sent = String((o && o.body) || ''); return new Promise(() => {}); };
      _aiWeeklySummary();
      return sent;
    });
    check('a critical NCR this week reaches the summary as 1, not 0', /"?קריטי"?\s*:?\s*1|קריטי[^\d]{0,20}1/.test(live || ''), (live || '').slice(0, 600));
    check('...and seven lost days reach it as 7', /7/.test(live || ''), (live || '').slice(0, 600));

    // The bucket has to be spelled the way the FORM spells it. The option is
    // גבוהה; the digest said גבוה, so that bucket was 0 as well.
    const high = await page.evaluate(() => {
      const opts = Array.from(g('ncr-p').options).map((o) => o.textContent);
      DB.ncr = [{ id: 'h1', num: 'NCR-2', d: 'x', p: opts[2], sd: new Date().toISOString().split('T')[0] }];
      DB.inc = []; DB.near_miss = []; DB.rounds = []; DB.tasks = [];
      let sent = null;
      window.fetch = function (u, o) { sent = String((o && o.body) || ''); return new Promise(() => {}); };
      _aiWeeklySummary();
      return { opts: opts, sent: sent };
    });
    check('the third priority the form offers is counted in the high bucket', /גבוה: 1/.test(high.sent || ''), { opts: high.opts, cut: (high.sent || '').slice(0, 400) });
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
