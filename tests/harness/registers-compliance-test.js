// 3.5 The audiometric register is statutory health surveillance, and it was
//     the one register with no expiry field at all. Its schema is
//     id/emp_name/emp_id/dob/age/gender/role/dept/category/year/notes/
//     test_date/inspector/ts — no `e`. So it was not scanned by the expiry
//     page, not in the calendar, not in the ICS feed, and not in the 30-day
//     warning; rHearing printed the test date with fd() and no eb(), so there
//     was not one colour badge on the whole page. An employee whose test
//     lapsed a year ago looked exactly like one tested yesterday.
//
// 3.7 «סטטוס עמידה» was a lone dropdown. Nothing recorded when the
//     determination was made, by whom, or on what evidence — and «סקירה
//     אחרונה» beside it is a separate field typed by hand, so «אינו מציית»
//     could become «מציית» with the review badge still showing last year's
//     date, looking as though it backed the claim. §9.1.2 asks on what basis.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'michael' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.sbIns = function () {}; window.sbDel = function () {};
    window.__upd = []; window.sbUpd = function (t, r) { window.__upd.push([t, JSON.parse(JSON.stringify(r))]); };
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__in = (n) => new Date(Date.now() + n * 864e5).toISOString().split('T')[0];
  });
  const drive = async (a) => page.evaluate((x) => {
    window.__asked = []; let pi = 0, ci = 0;
    window.prompt = function (m) { window.__asked.push(m); return x.prompts[pi++]; };
    window.confirm = function (m) { window.__asked.push(m); return x.confirms[ci++]; };
  }, a);

  console.log('\n3.5 a hearing test that lapses is visible like every other expiry');
  {
    const r = await page.evaluate(() => {
      DB.hearing_tests = [
        { id: 'h1', emp_name: 'דני כהן', dept: 'ייצור', test_date: '2025-01-05', e: __in(10) },
        { id: 'h2', emp_name: 'רונית לוי', dept: 'מעבדה', test_date: '2024-02-05', e: __in(-40) },
        { id: 'h3', emp_name: 'יוסי בר', dept: 'אחזקה', test_date: '2025-03-05' },
      ];
      ['docs', 'tr', 'ppe', 'ctr', 'equip_inspections', 'med'].forEach((t) => { DB[t] = []; });
      const coll = _expCollect();
      const none = _expNoDate();
      return {
        coll: coll.map((x) => x.mod + ':' + x.name),
        none: none.map((x) => x.mod + ':' + x.name),
      };
    });
    check('a hearing test with an expiry is on the expiry page', r.coll.indexOf('hearing:דני כהן') >= 0, r.coll);
    check('...including one that has already lapsed', r.coll.indexOf('hearing:רונית לוי') >= 0, r.coll);
    check('one with no date set is shown as such, not silently missing', r.none.indexOf('hearing:יוסי בר') >= 0, r.none);
    check('...and a dated one is not also in the no-date list', r.none.indexOf('hearing:דני כהן') < 0, r.none);

    const wired = await page.evaluate(() => {
      const src = document.documentElement.innerHTML;
      // the four scanners the register was missing from
      const cal = _calCollect(new Date(__in(10)).getFullYear(), new Date(__in(10)).getMonth());
      const found = Object.keys(cal).some((d) => (cal[d] || []).some((i) => i.tbl === 'hearing_tests'));
      return { cal: found };
    });
    check('it shows up in the calendar for the month it expires', wired.cal, wired);

    const page2 = await page.evaluate(() => {
      window._hearingQ = '';
      rHearing();
      return g('tb-hearing').innerHTML;
    });
    check('the register page has a colour badge instead of a bare date', /class="b /.test(page2), page2.slice(0, 400));
    check('...and offers to set one where none exists', /_hearSetExp/.test(page2), page2.slice(0, 600));
  }

  console.log('\n3.5 setting the expiry, one row and in bulk');
  {
    await drive({ prompts: ['2027-03-01'], confirms: [] });
    const one = await page.evaluate(() => {
      DB.hearing_tests = [{ id: 'h1', emp_name: 'דני', test_date: '2026-03-01' }];
      window.__upd = [];
      _hearSetExp('h1');
      return { e: DB.hearing_tests[0].e, sent: window.__upd.length };
    });
    check('a date typed on one row is saved', one.e === '2027-03-01' && one.sent === 1, one);

    await drive({ prompts: ['  '], confirms: [] });
    const cleared = await page.evaluate(() => { _hearSetExp('h1'); return DB.hearing_tests[0].e; });
    check('clearing it stores null, not an empty string', cleared === null, cleared);

    await drive({ prompts: ['01/03/2027'], confirms: [] });
    const badFmt = await page.evaluate(() => {
      window.__toasts = []; window.__upd = [];
      _hearSetExp('h1');
      return { e: DB.hearing_tests[0].e, sent: window.__upd.length, t: window.__toasts };
    });
    check('a date in the wrong format is refused rather than stored', badFmt.e === null && badFmt.sent === 0, badFmt);

    // the register arrives from Excel hundreds of rows at a time
    await drive({ prompts: ['12'], confirms: [true] });
    const bulk = await page.evaluate(() => {
      DB.hearing_tests = [
        { id: 'a', emp_name: 'א', test_date: '2026-01-15' },
        { id: 'b', emp_name: 'ב', test_date: '2026-06-30' },
        { id: 'c', emp_name: 'ג', test_date: '2026-02-01', e: '2030-01-01' },   // already has one
        { id: 'd', emp_name: 'ד' },                                             // no test date at all
      ];
      window.__upd = [];
      _hearFillExp();
      return {
        a: DB.hearing_tests[0].e, b: DB.hearing_tests[1].e,
        c: DB.hearing_tests[2].e, d: DB.hearing_tests[3].e,
        sent: window.__upd.length, asked: window.__asked,
      };
    });
    check('the bulk fill computes test date + the months given', bulk.a === '2027-01-15' && bulk.b === '2027-06-30', bulk);
    check('a row that already has an expiry is never overwritten', bulk.c === '2030-01-01', bulk);
    check('a row with no test date is left alone rather than guessed at', !bulk.d, bulk);
    check('...and only the rows it changed are sent', bulk.sent === 2, bulk);
    check('it asks for the period instead of assuming one', /כל כמה חודשים/.test(bulk.asked.join('|')), bulk.asked);
    check('...and says plainly that the interval is set by regulation, not by the app', /אני לא ממציא/.test(bulk.asked.join('|')), bulk.asked);

    await drive({ prompts: ['0'], confirms: [true] });   // would go through, if nothing refused 0
    const badN = await page.evaluate(() => {
      DB.hearing_tests = [{ id: 'a', emp_name: 'א', test_date: '2026-01-15' }];
      window.__upd = [];
      _hearFillExp();
      return { e: DB.hearing_tests[0].e, sent: window.__upd.length };
    });
    check('a nonsense number of months changes nothing', !badN.e && badN.sent === 0, badN);

    await drive({ prompts: ['999'], confirms: [true] });
    const tooBig = await page.evaluate(() => {
      DB.hearing_tests = [{ id: 'a', emp_name: 'א', test_date: '2026-01-15' }];
      window.__upd = [];
      _hearFillExp();
      return { e: DB.hearing_tests[0].e, sent: window.__upd.length };
    });
    check('...and neither does an absurd one', !tooBig.e && tooBig.sent === 0, tooBig);

    await drive({ prompts: ['12'], confirms: [false] });
    const declined = await page.evaluate(() => {
      DB.hearing_tests = [{ id: 'a', emp_name: 'א', test_date: '2026-01-15' }];
      window.__upd = [];
      _hearFillExp();
      return { e: DB.hearing_tests[0].e, sent: window.__upd.length };
    });
    check('saying no at the confirmation changes nothing', !declined.e && declined.sent === 0, declined);
  }

  console.log('\n3.7 the compliance determination carries its own date and author');
  {
    const r = await page.evaluate(() => {
      DB.leg = [];
      openModal('m-leg');
      ['leg-id', 'leg-s', 'leg-c-date', 'leg-c-by'].forEach((i) => { const el = g(i); if (el) el.value = ''; });
      g('leg-s').value = 'תקנות רעש';
      g('leg-c').value = 'אינו מציית';
      g('leg-last-review').value = '2025-01-01';
      svLeg();
      const rec = DB.leg[0] || {};
      return { c: rec.c, date: rec.c_date, by: rec.c_by, id: rec.id, today: new Date().toISOString().substring(0, 10) };
    });
    check('the determination is stamped with today, without anyone typing it', r.date === r.today, r);
    check('...and with who made it', r.by === 'michael', r);

    const unchanged = await page.evaluate((id) => {
      const rec = DB.leg.find((x) => x.id === id);
      rec.c_date = '2025-01-01'; rec.c_by = 'someone';       // pretend it was decided long ago
      editLeg(id);
      g('leg-summary').value = 'תיקון תקציר בלבד';
      svLeg();
      const after = DB.leg.find((x) => x.id === id);
      return { date: after.c_date, by: after.c_by, sum: after.summary };
    }, r.id);
    check('editing something else does NOT re-date the judgement', unchanged.date === '2025-01-01' && unchanged.by === 'someone', unchanged);

    // The form fields are display-only — svLeg reads the stamp off the record —
    // so nothing but this notices if they stop being filled in.
    const shown = await page.evaluate((id) => {
      editLeg(id);
      return { d: g('leg-c-date').value, b: g('leg-c-by').value, ro: !!g('leg-c-date').readOnly };
    }, r.id);
    check('opening the law shows when the determination was made, and by whom', shown.d === '2025-01-01' && shown.b === 'someone', shown);
    check('...and they cannot be typed over, because the code writes them', shown.ro, shown);
    check('...and the edit itself still saves', /תיקון תקציר/.test(unchanged.sum || ''), unchanged);

    const flipped = await page.evaluate((id) => {
      editLeg(id);
      g('leg-c').value = 'מציית';
      svLeg();
      const after = DB.leg.find((x) => x.id === id);
      return { c: after.c, date: after.c_date, by: after.c_by, today: new Date().toISOString().substring(0, 10) };
    }, r.id);
    check('changing «אינו מציית» to «מציית» re-dates it to today', flipped.c === 'מציית' && flipped.date === flipped.today, flipped);
    check('...and records who changed it, not last year’s reviewer', flipped.by === 'michael', flipped);
  }

  console.log('\n3.7 the register says on what basis, or admits it does not know');
  {
    const r = await page.evaluate(() => {
      DB.leg = [
        { id: 'l1', s: 'תקנות רעש', a: 'בטיחות', c: 'מציית', c_date: '2026-09-01', c_by: 'michael', c_evidence_url: 'https://x/y.pdf' },
        { id: 'l2', s: 'חוק ישן', a: 'בטיחות', c: 'מציית' },
      ];
      if (typeof legFilter === 'function') legFilter('all');
      rLeg();
      return g('tb-leg').innerHTML;
    });
    check('a determination with a date shows it beside the status', /01\/09\/2026/.test(r), r.slice(0, 900));
    check('...and who made it', /michael/.test(r), r.slice(0, 900));
    check('...and that there is evidence attached', /📎/.test(r), r.slice(0, 900));
    check('one with nothing recorded says so instead of looking equally solid', /לא תועד מתי נקבע/.test(r), r.slice(0, 1400));

    const view = await page.evaluate(() => {
      const f = VIEW_CONFIG.leg.fields.map((x) => x[1]);
      return { d: f.indexOf('c_date') >= 0, b: f.indexOf('c_by') >= 0 };
    });
    check('both are on the record, the print and the PDF', view.d && view.b, view);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
