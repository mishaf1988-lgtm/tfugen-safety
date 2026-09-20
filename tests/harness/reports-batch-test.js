// Four things about what the app hands to somebody outside it — an auditor,
// a management review, an external surveillance report.
//
// 6.1  _exportXlsx took the union of the raw DB keys and passed it to
//      json_to_sheet as the header row. The workbook that gets sent as
//      evidence opened on id / num / d / a / sv / dy / u. An auditor cannot
//      know that sv is חומרה, dy is ימי אבדן and u is יעד לביצוע. The
//      OneDrive backup workbook had the same problem.
//
// 6.5 + 6.6  The formal twelve-month trend lived in _ncrTrendSvg, reachable
//      only through NCR ← 🤖 סוכן AI ← 📈 מגמות, drawn 360px wide on a dark
//      panel, fed by a fetch that only runs inside the agent, and invisible
//      to print — _printPage prints .page.on and a modal is not one. The home
//      page did have a trend, but four weeks of it, opened vs closed only,
//      never the backlog: the one question an auditor asks is whether the
//      pile is growing, and nothing answered it.
//
// 6.12 The home tile read «ימי אבדן / LTIF» and showed the plain sum of the
//      dy column over the whole history. LTIF is lost-time injuries ×
//      1,000,000 ÷ hours worked, and the app stores no man-hours anywhere —
//      so it was a cumulative day count wearing the name of a frequency rate.
//      The annual ISO report prompt asked the model for LTIF too, from a data
//      object with no hours in it, under a rule saying "אל תמציא נתונים".
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(__dirname, '../..');
const HTML = 'file://' + path.join(ROOT, 'index.html');
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
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__mon = function (back, day) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(day || 10).padStart(2, '0');
    };
    window.__blankAll = function () {
      ['ncr', 'inc', 'near_miss', 'tasks', 'rounds', 'ppe', 'tr', 'docs', 'ctr', 'equip_inspections',
       'med', 'rsk', 'toolbox', 'trustee_reports', 'inspection_types'].forEach((t) => { DB[t] = []; });
    };
  });

  console.log('\n6.1 the workbook an auditor opens names its columns');
  {
    const r = await page.evaluate(() => ({
      sv: _xlsxLabel('inc', 'sv'), dy: _xlsxLabel('inc', 'dy'), u: _xlsxLabel('ncr', 'u'),
      rc: _xlsxLabel('ncr', 'rc'), c: _xlsxLabel('ncr', 'c'),
      id: _xlsxLabel('ncr', 'id'), ts: _xlsxLabel('ncr', 'ts'),
      sens: _xlsxLabel('ncr', 'sens'), loc_id: _xlsxLabel('ncr', 'location_id'),
      unknown: _xlsxLabel('ncr', 'zzz_no_such_column'),
      headers: _xlsxHeaders('inc', ['sv', 'dy', 'id']),
    }));
    check('sv is חומרה, which is what the form calls it', r.sv === 'חומרה', r.sv);
    check('dy is ימי אבדן', r.dy === 'ימי אבדן', r.dy);
    check('u is יעד לביצוע, not "u"', r.u === 'יעד לביצוע', r.u);
    check('the NCR root cause and corrective action are named too', r.rc === 'סיבת שורש' && r.c === 'פעולה מתקנת', r);
    check('columns VIEW_CONFIG does not carry are named here — id, ts, sens, location_id', r.id === 'מזהה' && r.ts === 'עודכן' && r.sens === 'רגיש' && r.loc_id === 'מזהה מיקום', r);
    check('a column nobody has named keeps its raw key rather than a guess', r.unknown === 'zzz_no_such_column', r.unknown);
    check('the header keeps the raw key in brackets, so the sheet still maps to the schema', r.headers[0] === 'חומרה (sv)' && r.headers[2] === 'מזהה (id)', r.headers);

    // and the real export writes that row
    const wrote = await page.evaluate(() => {
      __blankAll();
      DB.inc = [{ id: 'i1', dt: __iso(-5), d: 'נפילה מסולם', ty: 'תאונה', sv: 'בינונית', l: 'מחסן', dy: 3, r: 'דני' }];
      DB.ncr = [{ id: 'n1', num: 'NCR-1', d: 'שמן על הרצפה', a: 'בטיחות', u: __iso(10), s: 'פתוח', sd: __iso(-2) }];
      const sheets = [];
      window.XLSX = {
        utils: {
          book_new: () => ({ __s: [] }),
          json_to_sheet: (data, o) => ({ __data: data, __header: o && o.header }),
          sheet_add_aoa: (ws, rows, o) => { ws.__aoa = rows; ws.__origin = o && o.origin; },
          book_append_sheet: (wb, ws, nm) => { sheets.push({ nm: nm, ws: ws }); },
        },
        writeFile: () => {},
      };
      _exportXlsx();
      return new Promise((res) => setTimeout(() => res(sheets.map((x) => ({ nm: x.nm, aoa: x.ws.__aoa && x.ws.__aoa[0], origin: x.ws.__origin }))), 200));
    });
    const incSheet = wrote.find((x) => x.nm === 'תקריות');
    check('the incidents sheet overwrites row 1 with the labels', incSheet && incSheet.origin === 'A1' && incSheet.aoa, wrote);
    check('...and that row carries חומרה and ימי אבדן', incSheet && incSheet.aoa && incSheet.aoa.join('|').indexOf('חומרה (sv)') >= 0 && incSheet.aoa.join('|').indexOf('ימי אבדן (dy)') >= 0, incSheet && incSheet.aoa);
    const ncrSheet = wrote.find((x) => x.nm === 'NCR');
    check('the NCR sheet says יעד לביצוע rather than u', ncrSheet && ncrSheet.aoa && ncrSheet.aoa.join('|').indexOf('יעד לביצוע (u)') >= 0, ncrSheet && ncrSheet.aoa);

    // The OneDrive backup workbook is the one that gets opened months later by
    // somebody who does not have the schema in their head.
    const backup = await page.evaluate(() => {
      const sheets = [];
      window.XLSX = {
        utils: {
          book_new: () => ({}),
          aoa_to_sheet: (a) => ({ __aoa: a }),
          json_to_sheet: (rows) => ({ __rows: rows }),
          sheet_add_aoa: (ws, rows, o) => { ws.__aoa = rows; ws.__origin = o && o.origin; },
          book_append_sheet: (wb, ws, nm) => { sheets.push({ nm: nm, ws: ws }); },
        },
        write: () => new Uint8Array(0),
      };
      _backupBuildXlsx({ _meta: { created_at_local: 'x', total_rows: 1, table_count: 1 }, inc: [{ id: 'i1', sv: 'גבוהה', dy: 3 }] });
      const inc = sheets.filter((x) => x.nm === 'inc')[0];
      return { found: !!inc, aoa: inc && inc.ws.__aoa && inc.ws.__aoa[0], origin: inc && inc.ws.__origin };
    });
    check('the backup workbook writes a header row too', backup.found && backup.origin === 'A1', backup);
    check('...in Hebrew, same as the export', backup.aoa && backup.aoa.join('|').indexOf('חומרה (sv)') >= 0 && backup.aoa.join('|').indexOf('ימי אבדן (dy)') >= 0, backup.aoa);
  }

  console.log('\n6.5 + 6.6 twelve months, with the backlog, where it can be printed');
  {
    const r = await page.evaluate(() => {
      __blankAll();
      // opened 3 a month for a year, closed 1 a month: the pile grows.
      const rows = [];
      for (let back = 11; back >= 0; back--) {
        for (let k = 0; k < 3; k++) rows.push({ id: 'o' + back + '_' + k, num: 'N', d: 'תיאור', s: 'פתוח', sd: __mon(back, 5 + k) });
        rows.push({ id: 'c' + back, num: 'N', d: 'תיאור', s: 'סגור', sd: __mon(back, 2), cd: __mon(back, 20) });
      }
      DB.ncr = rows;
      const m = _ncrTrend12();
      return {
        n: m.length,
        opened: m.map((x) => x.opened),
        closed: m.map((x) => x.closed),
        backlog: m.map((x) => x.backlog),
        labels: m.map((x) => x.lbl),
      };
    });
    check('twelve buckets, one per month', r.n === 12, r.n);
    check('four opened a month (three that stay open + one that closes)', r.opened.every((x) => x === 4), r.opened);
    check('one closed a month', r.closed.every((x) => x === 1), r.closed);
    check('the backlog is what nothing showed before: it climbs by 3 a month', r.backlog[0] === 3 && r.backlog[11] === 36, r.backlog);
    check('the labels are month/year', /^\d{1,2}\/\d{2}$/.test(r.labels[0]), r.labels);

    const shrink = await page.evaluate(() => {
      const rows = [];
      // 40 opened a year ago, closed 4 a month since: the pile shrinks.
      for (let k = 0; k < 40; k++) rows.push({ id: 'x' + k, s: 'פתוח', sd: __mon(11, 2) });
      for (let back = 10; back >= 0; back--) for (let k = 0; k < 4; k++) rows[(10 - back) * 4 + k] = { id: 'x' + ((10 - back) * 4 + k), s: 'סגור', sd: __mon(11, 2), cd: __mon(back, 15) };
      DB.ncr = rows;
      const m = _ncrTrend12();
      const html = _ncrTrend12Html();
      return { first: m[0].backlog, last: m[11].backlog, html: html };
    });
    check('a shrinking pile really does shrink in the numbers', shrink.last < shrink.first, shrink);
    check('...and the caption says so, in a direction anyone can read', /הצבר קטן ב/.test(shrink.html), shrink.html.slice(-220));

    const svg = await page.evaluate(() => {
      DB.ncr = [{ id: 'a', s: 'פתוח', sd: __mon(1, 3) }, { id: 'b', s: 'סגור', sd: __mon(2, 3), cd: __mon(0, 3) }];
      const h = _ncrTrend12Html();
      return {
        html: h,
        isSvg: /^<svg/.test(h),
        line: (h.match(/<polyline/g) || []).length,
        bars: (h.match(/<rect/g) || []).length,
        legend: /נפתחו/.test(h) && /נסגרו/.test(h) && /צבר פתוח/.test(h),
        dark: /#0d1014/.test(h),
      };
    });
    check('it is an SVG, drawn by hand — no library, no build step', svg.isSvg, svg.html.slice(0, 80));
    check('the backlog is a line, which the app had none of before', svg.line === 1, svg.line);
    check('opened and closed are bars', svg.bars >= 2, svg.bars);
    check('the legend names all three series', svg.legend, svg.html.slice(-260));
    check('and it is light-themed, so it survives being printed', !svg.dark, svg.dark);

    const home = await page.evaluate(() => {
      DB.ncr = [{ id: 'a', s: 'פתוח', sd: __mon(3, 3) }];
      DB.inc = []; DB.near_miss = []; DB.tasks = []; DB.rounds = [];
      goPage('dash');
      const card = g('dash-ovc-card'), body = g('dash-ovc');
      return { shown: card && card.style.display !== 'none', svg: /<svg/.test((body || {}).innerHTML || ''), title: (card || {}).textContent || '' };
    });
    check('the home card carries it', home.shown && home.svg, home);
    check('...and its title says twelve months and צבר, not four weeks', /12/.test(home.title) && /צבר/.test(home.title) && !/4 שבועות/.test(home.title), home.title.slice(0, 80));

    const mr = await page.evaluate(() => {
      goPage('mr');
      const card = g('mr-trend-card'), body = g('mr-trend');
      const page_ = g('pg-mr');
      return {
        shown: card && card.style.display !== 'none',
        svg: /<svg/.test((body || {}).innerHTML || ''),
        onPage: !!(page_ && page_.contains(card)),
        inModal: !!(card && card.closest('.modal')),
      };
    });
    check('the management review carries it too', mr.shown && mr.svg, mr);
    check('...on the page, not in a modal — which is the only reason it can print', mr.onPage && !mr.inModal, mr);

    const empty = await page.evaluate(() => {
      __blankAll();
      goPage('dash');
      const card = g('dash-ovc-card');
      return { hidden: !card || card.style.display === 'none', html: _ncrTrend12Html() };
    });
    check('with no NCRs at all the card stays hidden rather than drawing a flat line', empty.hidden && empty.html === '', empty);

    const descDate = await page.evaluate(() => {
      // n.d on an NCR is the DESCRIPTION. It must never be read as a date.
      DB.ncr = [{ id: 'z', s: 'פתוח', d: '01/01/2020' }, { id: 'y', s: 'פתוח', d: 'מעקה חסר', ts: __mon(1, 4) + 'T09:00:00Z' }];
      const m = _ncrTrend12();
      return { total: m.reduce((a, x) => a + x.opened, 0), backlog: m[11].backlog };
    });
    check('a description that looks like a date is not counted as one', descDate.total === 1, descDate);
    check('...and a row with no sd falls back to its own creation time', descDate.backlog === 1, descDate);
  }

  console.log('\n6.12 the tile says what the number is');
  {
    const r = await page.evaluate(() => {
      __blankAll();
      const y = new Date().getFullYear();
      DB.inc = [
        { id: 'a', dt: y + '-02-10', dy: 4, sv: 'בינונית' },
        { id: 'b', dt: y + '-05-20', dy: 6, sv: 'גבוהה' },
        { id: 'old', dt: (y - 3) + '-01-01', dy: 90, sv: 'גבוהה' },
      ];
      DB.ncr = []; DB.near_miss = []; DB.tasks = []; DB.rsk = []; DB.ptw = [];
      goPage('dash');
      const src = [...document.querySelectorAll('script')].map((s) => s.textContent).join('');
      return { body: g('pg-dash').textContent, hasLtifTile: /sub:'LTIF'/.test(src) };
    });
    check('no tile is captioned LTIF any more', !r.hasLtifTile, r.hasLtifTile);

    const sum = await page.evaluate(() => {
      const y = new Date().getFullYear();
      DB.inc = [
        { id: 'a', dt: y + '-02-10', dy: 4 },
        { id: 'b', dt: y + '-05-20', dy: 6 },
        { id: 'old', dt: (y - 3) + '-01-01', dy: 90 },
        { id: 'nodate', dy: 5 },
      ];
      // read the tile the dashboard builds, whatever position it lands in
      rDash();
      const kpis = [...document.querySelectorAll('#pg-dash .kpi')].map((el) => el.textContent);
      return kpis.filter((t) => /ימי אבדן/.test(t));
    });
    check('the lost-days tile exists on this fixture', sum.length === 1, sum);
    check('...and counts this year only — 10, not the 105 of all time', /10/.test(sum[0] || '') && !/105/.test(sum[0] || ''), sum);
    check('...and says so: «השנה», not a rate it cannot compute', /השנה/.test(sum[0] || ''), sum);

    const prompt = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sec2 = (prompt.match(/## 2\. [^']*/) || [''])[0];
    check('the annual ISO prompt no longer asks the model for LTIF', !/\(LTIF,/.test(sec2), sec2);
    check('...it asks for what the data actually contains', /ימי אבדן/.test(sec2) && /מספר תקריות/.test(sec2), sec2);
    check('...and says outright not to compute LTIF, so the model cannot invent one', /אל תחשב LTIF/.test(sec2), sec2);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
