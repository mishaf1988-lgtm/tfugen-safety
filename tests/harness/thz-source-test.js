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

  console.log('\n4. only from 29/10/2026 on');
  const o1 = await page.evaluate((dept) => thzFromSource({ src: 'investigation', ref: 'old-1', action: 'ישן', dept: dept, opened: '2026-10-28' }), dept);
  const o2 = await page.evaluate((dept) => thzFromSource({ src: 'investigation', ref: 'new-1', action: 'חדש', dept: dept, opened: '2026-10-29' }), dept);
  check('opened before the accident: skipped, nothing added', o1.skip === 'old' && !o1.added && !(await page.evaluate(() => DB.tour_hazards.some(x => x.src_ref === 'old-1|ישן'))), o1);
  check('opened on the day: added', o2.added === true, o2);

  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
