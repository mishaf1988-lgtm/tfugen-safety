// QA 2026-09-20, after #604 fixed the NCR numbering in svNcr. Two more places
// still built a number from (length+1), and one of them broke the Excel import
// outright:
//   * xlParse numbered every sheet NCR-0001.. from idx=1. With NCR-0001..0375
//     already in the table, every generated number collided with a live record,
//     xlOk's dedupe dropped all of them, and the import reported "כל הרשומות
//     כבר קיימות" having imported nothing.
//   * the OneDrive auto-import reissued a number a live record already held —
//     the worse of the two, because nobody is watching it run.
//   * xlOk deduped on that generated number, which is not an identity at all.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// A production-shaped table: 375 non-conformities already numbered.
const PROD = Array.from({ length: 375 }, (_, i) => ({
  id: 'p' + i, num: 'NCR-' + String(i + 1).padStart(4, '0'),
  d: 'רשומה קיימת ' + (i + 1), s: 'סגור', src_date: '2026-01-0' + ((i % 9) + 1),
}));
// What a fresh sheet parses into — the shape xlParse produces.
const SHEET = (n, tag) => Array.from({ length: n }, (_, i) => ({
  id: 'xl' + tag + i, num: null,
  d: 'ממצא מהגיליון ' + tag + ' ' + (i + 1),
  src_date: '2026-09-1' + (i % 9), s: 'סגור', a: 'בטיחות',
}));

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const boot = (rows) => page.evaluate((rows) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    DB.ncr = JSON.parse(JSON.stringify(rows));
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('ncr');
  }, rows);
  // Run xlOk against a parsed sheet, numbering it the way xlParse now does.
  const importSheet = (sheet) => page.evaluate((sheet) => {
    var base = _ncrMaxNum() + 1;
    window._xlData = sheet.map(function (r, i) {
      return Object.assign({}, r, { num: 'NCR-' + String(base + i).padStart(4, '0') });
    });
    var before = DB.ncr.length;
    xlOk();
    return { before: before, after: DB.ncr.length, added: DB.ncr.length - before, nums: DB.ncr.slice(before).map(function (r) { return r.num; }) };
  }, sheet);

  console.log('\n1. the numbering helpers');
  {
    await boot(PROD);
    const r = await page.evaluate(() => ({ max: _ncrMaxNum(), next: _ncrNextNum() }));
    check('375 rows numbered 0001-0375 give max 375 and next NCR-0376', r.max === 375 && r.next === 'NCR-0376', r);
    const empty = await page.evaluate(() => { DB.ncr = []; return { max: _ncrMaxNum(), next: _ncrNextNum() }; });
    check('an empty table starts at NCR-0001', empty.max === 0 && empty.next === 'NCR-0001', empty);
    const odd = await page.evaluate(() => { DB.ncr = [{ id: 'a', num: 'NCR-0007' }, { id: 'b', num: 'xl-weird' }, { id: 'c', num: null }]; return _ncrNextNum(); });
    check('rows with an unparsable number are ignored, not counted', odd === 'NCR-0008', odd);
  }

  console.log('\n2. importing a sheet into a table that already has 375 rows');
  {
    await boot(PROD);
    const r = await importSheet(SHEET(50, 'A'));
    check('all 50 rows are imported — this used to import ZERO', r.added === 50, r);
    check('they are numbered from NCR-0376 upward, never over a live record', r.nums[0] === 'NCR-0376' && r.nums[49] === 'NCR-0425', { first: r.nums[0], last: r.nums[49] });
    const dupes = await page.evaluate(() => {
      const seen = {}; const out = [];
      DB.ncr.forEach((x) => { if (x.num) { if (seen[x.num]) out.push(x.num); seen[x.num] = 1; } });
      return out;
    });
    check('no number appears twice anywhere in the table', dupes.length === 0, dupes);
  }

  console.log('\n3. re-importing the same sheet does not duplicate it');
  {
    await boot(PROD);
    const first = await importSheet(SHEET(20, 'B'));
    const second = await importSheet(SHEET(20, 'B'));
    check('the first import adds 20', first.added === 20, first);
    check('the second adds nothing — identity is the content, not the counter', second.added === 0, second);
    const third = await importSheet(SHEET(5, 'C'));
    check('but a genuinely different sheet still imports', third.added === 5, third);
  }

  console.log('\n4. a sheet with repeated rows inside it');
  {
    await boot([]);
    const dupInside = SHEET(3, 'D');
    const r = await importSheet(dupInside.concat(dupInside));
    check('six rows of which three are repeats import as three', r.added === 3, r);
  }

  console.log('\n5. the OneDrive auto-import no longer reissues a live number');
  {
    await boot(PROD);
    const r = await page.evaluate(() => {
      // what the import path does for an ncr-classified document
      var rec = { id: 'od1', num: _ncrNextNum(), d: 'ממסמך שסווג', s: 'פתוח' };
      DB.ncr.push(rec);
      var rec2 = { id: 'od2', num: _ncrNextNum(), d: 'עוד אחד', s: 'פתוח' };
      DB.ncr.push(rec2);
      return { a: rec.num, b: rec2.num, clash: DB.ncr.filter((x) => x.num === rec.num).length };
    });
    check('two imported documents get 0376 and 0377, not a repeat', r.a === 'NCR-0376' && r.b === 'NCR-0377', r);
    check('and neither collides with an existing record', r.clash === 1, r);
    const src = await page.evaluate(() => document.documentElement.outerHTML.indexOf('NCR-\'+String((DB.ncr||[]).length+1)') < 0);
    check('the old (length+1) form is gone from the import path', src, src);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
