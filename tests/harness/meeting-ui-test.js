// Stage 5 in the app (28/09): the meeting-data screen, its two downloads in
// the old files' shape, and the accident form after the import (department,
// reported, the UTC timestamp shown and edited as Israeli time).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  console.log('\n1. the meeting screen');
  const m = await page.evaluate(() => {
    window.addLog = function () {}; window._calls = []; window._dl = [];
    window._mtgDl = function (n, o) { window._dl.push([n, JSON.parse(JSON.stringify(o))]); };
    const dept = (d, c, o, n, cw, t, nc, op) => ({ dept: d, closed: c, open: o, newThisWeek: n, closedThisWeek: cw, total: t, newClosed: nc, openPrior: op });
    window._truApi = function (p, b) {
      window._calls.push([p, b]);
      if (p === '/api/hazard-deck') return Promise.resolve(b.op === 'status' || b.op === 'setDate' ? { ok: true, name: 'מצגת שבועית.חודשית.pptx', date: b.op === 'setDate' ? b.date : '2026-09-29', last: '2026-09-28T16:00:00Z', webUrl: 'https://od/deck' } : { ok: true, pushed: true });
      return Promise.resolve({ ok: true, ref: b.ref, generatedAt: '2026-09-28T10:00:00Z',
        hazards: { week: { start: '2026-09-13', end: '2026-09-19', reference: b.ref },
          summary: { openNow: 20, openedThisWeek: 6, closedThisWeek: 10, pastDue: 16, bySeverity: { high: 4, medium: 14, low: 2 }, newClosed: 5, newStillOpen: 1 },
          byDept: [dept('מעצבים', 4, 6, 0, 0, 10, 0, 6), dept('ייצור טוגנים', 10, 3, 6, 6, 13, 5, 2), dept('חומר גלם', 10, 7, 0, 4, 17, 0, 7), dept('תוצג', 5, 1, 0, 0, 6, 0, 1), dept('מעבדות', 3, 3, 0, 0, 6, 0, 3)],
          total: Object.assign(dept('סה"כ', 32, 20, 6, 10, 52, 5, 19), { late: 16, closedWithDue: 25, closedOnTime: 18, avgDaysToClose: 9 }), standout: { closedThisWeek: 'ייצור טוגנים', newThisWeek: 'ייצור טוגנים', open: 'חומר גלם' },
          month: { month: '2026-09', openedThisMonth: 9, closedThisMonth: 12, prevMonth: '2026-08', openedPrevMonth: 3, closedPrevMonth: 1 },
          closedThisWeek: [{ id: 40, dept: 'ייצור טוגנים', shortDescription: 'x' }], openedThisWeek: [{ id: 41, dept: 'ייצור טוגנים', shortDescription: 'y' }], check: true, meta: { totalAllTime: 52 } },
        accidents: { year: 2026, summary: { total: 14, reported: 6, notReported: 8, onSite: 13, offSite: 1 }, byMonth: [{ month: 'ינו-26', count: 3 }], byYear: { 2024: 14, 2025: 13 }, lastYearToDate: 11,
          lastAccident: { date: '2026-09-01', dept: 'מעוצבים', shortDescription: 'מעיכת אגודל', location: 'בדרך הביתה', reported: true }, daysSinceLastAccident: 21 },
        trustees: { month: '2026-09', active: 8, reported: 3, level: 'warn' } });
    };
    goPage('thz');
    const btn = !!document.querySelector('#pg-thz [onclick="mtgOpen()"]');
    mtgOpen();
    return new Promise((res) => setTimeout(() => {
      const ov = document.getElementById('mtg');
      const trs = Array.from(ov.querySelectorAll('table tr')).map((tr) => Array.from(tr.children).map((c) => c.textContent).join('|'));
      const th0 = ov.querySelector('table th'), thc = th0 ? getComputedStyle(th0).color : '', thbg = th0 ? getComputedStyle(th0).backgroundColor : '';
      mtgDownload('hz'); mtgDownload('acc');
      document.getElementById('mtg-ref').value = '2026-09-22'; mtgLoad('2026-09-22');
      setTimeout(() => {
        const deckTxt = ov.textContent;
        mtgDeckDate();
        setTimeout(() => res({ thc, thbg, btn, trs, text: ov.textContent, deckTxt, calls: window._calls, dl: window._dl, wide: ov.scrollWidth, dot: /·|—/.test(deckTxt) }), 80);
      }, 50);
    }, 50));
  });
  check('a "נתוני ישיבה" button on the tours screen', m.btn);
  // 30/09/2026 (Michael, screenshot): the header row was white on light grey.
  const lum = (c) => { const v = (c.match(/\d+/g) || []).slice(0, 3).map(Number); return v.length === 3 ? (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) : -1; };
  check('the table header can be read: dark text on its light background', lum(m.thc) >= 0 && lum(m.thc) < 60 && lum(m.thbg) > 180, [m.thc, m.thbg]);
  const md = m.calls.filter((c) => c[0] === '/api/meeting-data');
  check('opens on the deck\'s meeting date, then the date picked', m.calls[0][0] === '/api/hazard-deck' && m.calls[0][1].op === 'status' && md[0][1].ref === '2026-09-29' && md[1][1].ref === '2026-09-22', m.calls);
  check('the deck box: meeting date, last update, the buttons', /המצגת בתיקייה 13/.test(m.deckTxt) && /תאריך הישיבה במצגת: 29\/09\/2026/.test(m.deckTxt) && /עדכן את המצגת עכשיו/.test(m.deckTxt), m.deckTxt.slice(-400));
  const dk = m.calls.filter((c) => c[0] === '/api/hazard-deck');
  check('"קבע את התאריך" saves the date picked, then updates the deck', dk.some((c) => c[1].op === 'setDate' && c[1].date === '2026-09-22') && dk.some((c) => c[1].force === true), dk);
  check('the table of "סיכום שבועי למצגת": header, 5 departments, total', m.trs.length === 7 && /^מחלקה\|סגורים \(מצטבר\)/.test(m.trs[0]) && m.trs[6] === 'סה"כ|32|20|6|10|52|5|16|18/25 (72%)|9', m.trs);
  // upgrade review 26 (01/10/2026): late, on time, days to close; a reply
  // without them (an older server) shows dashes, not "undefined"
  check('committee metrics per department: an older reply shows dashes', m.trs[1] === 'מעצבים|4|6|0|0|10|0|-|-|-' && !/undefined|NaN/.test(m.text), m.trs[1]);
  check('accidents: the same stretch last year next to this year', /סה"כ השנה: 14 \(אשתקד באותה תקופה: 11\)/.test(m.text), m.text.slice(0, 2000));
  check('trustees: numbers only, "3 מתוך 8 דיווחו החודש", the target when under half', /3 מתוך 8 דיווחו החודש \(היעד: לפחות חצי\)/.test(m.text), m.text.slice(0, 3000));
  check('week, standouts, past due, days without an accident', /שבוע 13\/09\/2026 עד 19\/09\/2026/.test(m.text) && /פתוחים כעת חומר גלם/.test(m.text) && /עברו את היעד: 16/.test(m.text) && /21 ימים ללא תאונה/.test(m.text), m.text.slice(0, 400));
  check('keyboard characters only (no middle dot, no long dash)', !m.dot);
  check('fits a phone (the table scrolls inside its box)', m.wide <= 375, m.wide);
  const hz = m.dl[0] && m.dl[0][1], ac = m.dl[1] && m.dl[1][1];
  check('weekly-hazards.json in the old shape', m.dl[0][0] === 'weekly-hazards.json' && hz.week.start === '2026-09-13' && hz.summary.pastDue === 16 && hz.byDept[1].dept === 'ייצור טוגנים' && hz.byDept[1].openPrior === 2 && Object.keys(hz.byDept[0]).join() === 'dept,closed,openPrior,newThisWeek' && hz.meta.totalAllTime === 52, hz);
  check('accidents_2026.json in the old shape (total2026, daysSinceLastAccident)', m.dl[1][0] === 'accidents_2026.json' && ac.summary.total2026 === 14 && ac.daysSinceLastAccident === 21 && ac.byYear['2025'] === 13, ac);

  console.log('\n2. the accident form after the import');
  const f = await page.evaluate(() => {
    const ups = []; window.sbUpd = function (t, r) { ups.push([t, JSON.parse(JSON.stringify(r))]); }; window.sdb = function () {}; window.toast = function () {};
    DB.inc = [{ id: 'acc26-14', d: 'חתך', dt: '2026-01-20T23:00:00+00:00', ty: 'תאונה עם פציעה', l: 'החלפת סכינים', w: 'עובד', dy: null, s: 'סגור', r: 'x', dept: 'ייצור טוגנים', dept_group: 'ייצור ואריזה', reported: false, src: 'טבלת תאונות 2026-.xlsx #14', created_at: '2026-09-28T12:00:00Z' }];
    const shown = fd('2026-01-20T23:00:00+00:00'), plain = fd('2026-01-20');
    editInc('acc26-14');
    const form = { dt: g('i-dt').value, dept: g('i-dept').value, rep: g('i-rep').value, opts: Array.from(g('i-dept-list').options).map((o) => o.value) };
    svInc();
    const saved = ups[0] && ups[0][1];
    g('i-dt').value = ''; g('i-d').value = 'בלי תאריך'; g('i-id').value = ''; g('i-rep').value = 'true';
    const ins = []; window.sbIns = function (t, r) { ins.push(JSON.parse(JSON.stringify(r))); };
    svInc();
    DB.inc.push({ id: 'x2', d: '<img src=x onerror=alert(1)>', dt: null, ty: null, sv: null, s: 'סגור' });
    rInc();
    const list = document.getElementById('tb-inc').innerHTML;
    showView('inc', 'acc26-14');
    const view = (document.getElementById('view-body') || document.body).textContent;
    return { shown, plain, form, saved, fresh: ins[0], listNull: /null/.test(document.getElementById('tb-inc').textContent), listEsc: !list.includes('<img'), view };
  });
  check('a UTC timestamp is shown as the Israeli date (23:00 UTC on 20.01 = 21.01)', f.shown === '21/01/2026' && f.plain === '20/01/2026', [f.shown, f.plain]);
  check('edit: the time in Israeli local time, department and "לא מדווח" filled', f.form.dt === '2026-01-21T01:00' && f.form.dept === 'ייצור טוגנים' && f.form.rep === 'false', f.form);
  check('department suggestions include the plant departments and those used', f.form.opts.includes('מעצבים') && f.form.opts.includes('ייצור טוגנים'), f.form.opts);
  check('save: the same instant back as ISO, imported fields kept', f.saved && f.saved.dt === '2026-01-20T23:00:00.000Z' && f.saved.w === 'עובד' && f.saved.src === 'טבלת תאונות 2026-.xlsx #14' && f.saved.dept_group === 'ייצור ואריזה' && f.saved.reported === false, f.saved);
  check('a new accident with no date: dt null (never ""), reported true', f.fresh && f.fresh.dt === null && f.fresh.reported === true, f.fresh);
  check('the list: no "null" for a missing severity or type, text escaped', !f.listNull && f.listEsc, f.listNull);
  check('the view: department, worker and "דיווח (טופס 250)"', /ייצור טוגנים/.test(f.view) && /עובד/.test(f.view) && /דיווח \(טופס 250\)/.test(f.view), f.view.slice(0, 300));
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
