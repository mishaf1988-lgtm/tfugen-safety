// NCR correctness. Four defects found in review, all in the same area:
//   * the week/month/quarter filters parsed r.d — the DESCRIPTION — as a date,
//     so they returned "אין רשומות" for records that exist
//   * the sort comment said "by date desc" and localeCompare'd the description
//   * NCR numbers came from DB.ncr.length+1, so deleting one reissued a live number
//   * an empty target date was written as '' (CLAUDE.md rule 2)
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const iso = (daysAgo) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d.toISOString().substring(0, 10); };
const stamp = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString(); };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const boot = (rows) => page.evaluate((rows) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    DB.ncr = JSON.parse(JSON.stringify(rows));
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); window._ncrQuickFilter = ''; goPage('ncr');
  }, rows);
  const shown = (f) => page.evaluate((f) => {
    window._ncrQuickFilter = f; rNcr();
    return Array.from(document.querySelectorAll('#tb-ncr tr'))
      .map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && !/אין רשומות/.test(t))
      .map((t) => (t.match(/NCR-\d+/) || ['?'])[0]);
  }, f);

  // Hebrew descriptions — exactly what made new Date(r.d) return Invalid Date.
  const ROWS = [
    { id: 'a', num: 'NCR-0001', d: 'דלת חירום חסומה במחסן', sd: iso(0), s: 'פתוח', p: 'גבוה', ts: stamp(0) },
    { id: 'b', num: 'NCR-0002', d: 'מטף ללא פלומבה', sd: iso(3), s: 'פתוח', p: 'גבוה', ts: stamp(3) },
    { id: 'c', num: 'NCR-0003', d: 'שפך שמן', sd: iso(20), s: 'פתוח', p: 'גבוה', ts: stamp(20) },
    { id: 'd', num: 'NCR-0004', d: 'מעקה רופף', sd: iso(60), s: 'פתוח', p: 'גבוה', ts: stamp(60) },
    { id: 'e', num: 'NCR-0005', d: 'אין תאריך גילוי — רשומה ישנה', s: 'פתוח', p: 'גבוה', ts: stamp(2) },
  ];

  console.log('\n1. the filters find records that exist');
  {
    await boot(ROWS);
    const all = await shown('');
    check('«הכל» shows all 5', all.length === 5, all);
    const week = await shown('week');
    check('«השבוע» finds the 3 from the last 7 days — it used to show "אין רשומות"', week.sort().join() === 'NCR-0001,NCR-0002,NCR-0005', week);
    const m1 = await shown('m1');
    check('«חודש» finds 4 (adds the 20-day-old one)', m1.length === 4 && m1.indexOf('NCR-0003') >= 0, m1);
    const m3 = await shown('m3');
    check('«3 חודשים» finds all 5', m3.length === 5, m3);
    check('a row with no sd still counts, by its creation stamp (NCR-0005 is in «השבוע»)', week.indexOf('NCR-0005') >= 0, week);
  }

  console.log('\n2. the description is no longer treated as a date');
  {
    // Same rows, but one description happens to LOOK like a date. Under the old
    // code that row would have been the only one the week filter could match.
    const tricky = ROWS.concat([{ id: 'x', num: 'NCR-0099', d: '2026-09-19', sd: iso(200), s: 'פתוח', p: 'גבוה', ts: stamp(200) }]);
    await boot(tricky);
    const week = await shown('week');
    check('a description that reads like a date does not sneak into «השבוע»', week.indexOf('NCR-0099') < 0, week);
    const m3 = await shown('m3');
    check('...and its real age (200 days) keeps it out of «3 חודשים» too', m3.indexOf('NCR-0099') < 0, m3);
  }

  console.log('\n3. newest first, by the discovery date');
  {
    await boot(ROWS);
    const order = await shown('');
    check('sorted newest-first: 0001, 0005, 0002, 0003, 0004', order.join() === 'NCR-0001,NCR-0005,NCR-0002,NCR-0003,NCR-0004', order);
  }

  console.log('\n4. NCR numbers are never reissued');
  {
    await boot(ROWS);
    const r = await page.evaluate(() => {
      const first = _ncrNextNum();
      DB.ncr = DB.ncr.filter((x) => x.id !== 'c');        // delete NCR-0003
      const afterDelete = _ncrNextNum();
      DB.ncr.push({ id: 'z', num: afterDelete, d: 'x', s: 'פתוח' });
      return { first: first, afterDelete: afterDelete, next: _ncrNextNum(), count: DB.ncr.length };
    });
    check('with 5 rows (0001-0005) the next number is 0006', r.first === 'NCR-0006', r);
    check('after deleting one, the next is STILL 0006 — never a live number', r.afterDelete === 'NCR-0006' && r.count === 5, r);
    check('and the one after that is 0007', r.next === 'NCR-0007', r);
    const gap = await page.evaluate(() => { DB.ncr = [{ id: 'q', num: 'NCR-0375', d: 'x', s: 'פתוח' }]; return _ncrNextNum(); });
    check('one row numbered 0375 yields 0376, not 0002 (the production case)', gap === 'NCR-0376', gap);
  }

  console.log('\n5. an empty target date is saved as null, not ""');
  {
    await boot([]);
    const r = await page.evaluate(() => {
      const saved = [];
      window.sbIns = function (t, row) { saved.push(row); };
      openNewNcrModal();
      document.getElementById('ncr-d').value = 'בדיקה ללא יעד';
      document.getElementById('ncr-u').value = '';           // no target date
      svNcr();
      return saved.length ? { u: saved[0].u, typeofU: typeof saved[0].u, num: saved[0].num } : { none: true };
    });
    check('a blank יעד לביצוע is written as null (CLAUDE.md rule 2)', r.u === null, r);
    check('and the new row still gets a number', /^NCR-\d{4}$/.test(r.num || ''), r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
