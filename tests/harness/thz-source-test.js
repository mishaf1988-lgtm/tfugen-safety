// A corrective action from the committee or an investigation becomes a tour hazard (29/10/2026):
// source marked, no duplicate for the same investigation + action, bad input refused.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => { DB.tour_hazards = [{ id: 'a', n: 7, d: '2026-10-01', dept: 'מעבדות', descr: 'מפגע ישן', s: 'פתוח' }]; });
  const dept = await page.evaluate(() => _THZ_DEPTS[0]);

  console.log('\n1. a new action is added with its source');
  const a = await page.evaluate((dept) => thzFromSource({ src: 'investigation', ref: 'inc-26-31', action: 'להתקין מעקה', dept: dept, sev: 'גבוהה', resp: 'הנדסה' }), dept);
  check('added', a.added === true, a);
  const row = await page.evaluate(() => DB.tour_hazards[DB.tour_hazards.length - 1]);
  check('src and src_ref set', row.src === 'investigation' && row.src_ref === 'inc-26-31|להתקין מעקה', row);
  check('numbered after the highest', row.n === 8, row.n);
  check('open, due set by severity (3 days)', row.s === 'פתוח' && !!row.due, row);
  check('the action is also the description when none given', row.descr === 'להתקין מעקה' && row.action === 'להתקין מעקה', row);

  console.log('\n2. the same investigation and action again adds nothing');
  const b = await page.evaluate((dept) => thzFromSource({ src: 'investigation', ref: 'inc-26-31', action: '  להתקין   מעקה ', dept: dept }), dept);
  check('dup', b.dup === true && !b.added, b);
  check('row count unchanged', (await page.evaluate(() => DB.tour_hazards.length)) === 2);
  const c = await page.evaluate((dept) => thzFromSource({ src: 'committee', ref: 'inc-26-31', action: 'להתקין מעקה', dept: dept }), dept);
  check('same key from the committee is also a dup (one action, one hazard)', c.dup === true, c);
  const d = await page.evaluate((dept) => thzFromSource({ src: 'committee', ref: '2026-11-03', action: 'להתקין מעקה', dept: dept }), dept);
  check('another meeting, same words: added', d.added === true, d);

  console.log('\n3. bad input');
  const e1 = await page.evaluate(() => thzFromSource({ src: 'mail', ref: 'x', action: 'y', dept: 'z' }));
  const e2 = await page.evaluate(() => thzFromSource({ src: 'committee', ref: '', action: 'y', dept: 'z' }));
  const e3 = await page.evaluate(() => thzFromSource({ src: 'committee', ref: 'x', action: 'y' }));
  check('unknown source refused', e1.error === 'src', e1);
  check('no id / no department refused', e2.error === 'fields' && e3.error === 'fields', [e2, e3]);
  check('unknown severity falls back to medium', (await page.evaluate((dept) => thzFromSource({ src: 'committee', ref: 'q', action: 'w', dept: dept, sev: 'אחר' }).row.sev, dept)) === 'בינונית');

  console.log('\n5. the committee list shows the open actions from an investigation or the committee');
  await page.evaluate(() => {
    const day = (n) => new Date(Date.parse(_thzToday() + 'T12:00:00Z') + n * 86400000).toISOString().substring(0, 10);
    DB.tour_hazards = [{ id: 'tour', n: 1, d: day(-5), dept: 'x', descr: 'מסיור רגיל', s: 'פתוח' },
      { id: 'cl', n: 2, d: day(-3), dept: 'x', action: 'סגורה', s: 'סגור', src: 'investigation', src_ref: 'r|c' },
      { id: 'late', n: 3, d: day(-2), dept: 'x', action: 'באיחור', s: 'פתוח', src: 'committee', src_ref: 'r|l', due: day(-1) }];
    for (let i = 0; i < 17; i++) DB.tour_hazards.push({ id: 'o' + i, n: 10 + i, d: day(-1), dept: 'x', action: 'פעולה ' + i, s: 'פתוח', src: 'investigation', src_ref: 'r|' + i, due: day(10) });
  });
  const h1 = await page.evaluate(() => _mtgCommitteeHtml());
  const rowsN = (h1.match(/<tr/g) || []).length;
  check('15 rows + the header, the rest behind "more (3)"', rowsN === 16 && /\(3\)<\/button>/.test(h1), rowsN);
  check('a closed action and an ordinary tour hazard are not listed', h1.indexOf('סגורה') < 0 && h1.indexOf('מסיור רגיל') < 0);
  check('overdue first, and counted', h1.indexOf('באיחור</td>') > 0 && h1.indexOf('באיחור</td>') < h1.indexOf('פעולה 0') && />1<\/b>/.test(h1.replace('(18)', '')), h1.slice(0, 200));
  check('the total in the title (18 open)', /\(18\)<\/b>/.test(h1), h1.slice(0, 160));
  await page.evaluate(() => { mtgComMore(); });
  check('"more" shows all 18', (await page.evaluate(() => _mtgCommitteeHtml().match(/<tr/g).length)) === 19);
  await page.evaluate(() => { DB.tour_hazards = []; _mtgComAll = false; });
  check('nothing open: a plain line, no table', !/<table/.test(await page.evaluate(() => _mtgCommitteeHtml())));

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
