// BACKLOG 13.14 (12/10/2026, Michael: "למחוק רק את הרגיש"): the lock drops the
// employee, medical and hearing rows from memory and from tfgn2, keeps every
// other table and the offline queue, and does not empty tfgn2 when the lock
// runs at startup before ldb() filled DB.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  console.log('\n1. lock after a working session');
  {
    const r = await page.evaluate(() => {
      DB.emp = [{ id: 'e1', n: 'x' }]; DB.med = [{ id: 'm1' }]; DB.hearing_tests = [{ id: 'h1' }]; DB.docs = [{ id: 'd1', n: 'doc' }];
      localStorage.setItem('tfgn2', JSON.stringify({ emp: DB.emp, med: DB.med, hearing_tests: DB.hearing_tests, docs: DB.docs }));
      localStorage.setItem('tfgn_outbox', JSON.stringify([{ t: 'emp', op: 'upd', id: 'e1' }]));
      _lockNow();
      const snap = JSON.parse(localStorage.getItem('tfgn2'));
      return { mem: [DB.emp.length, DB.med.length, DB.hearing_tests.length, DB.docs.length], keys: Object.keys(snap), outbox: localStorage.getItem('tfgn_outbox') };
    });
    check('memory: emp, med, hearing emptied, docs kept', JSON.stringify(r.mem) === '[0,0,0,1]', r.mem);
    check('stored copy: only docs left', JSON.stringify(r.keys) === '["docs"]', r.keys);
    check('the offline queue is untouched', /e1/.test(r.outbox || ''), r.outbox);
  }

  console.log('\n2. lock at startup, before ldb()');
  {
    const r = await page.evaluate(() => {
      Object.keys(DB).forEach((k) => { if (Array.isArray(DB[k])) DB[k] = []; });
      localStorage.setItem('tfgn2', JSON.stringify({ emp: [{ id: 'e1' }], docs: [{ id: 'd1' }], tasks: [{ id: 't1' }] }));
      _lockNow();
      const snap = JSON.parse(localStorage.getItem('tfgn2'));
      ldb();
      return { keys: Object.keys(snap).sort(), docs: DB.docs.length, emp: (DB.emp || []).length };
    });
    check('an empty DB is not flushed over the stored copy', JSON.stringify(r.keys) === '["docs","tasks"]', r.keys);
    check('ldb() after the lock loads the rest and no employees', r.docs === 1 && r.emp === 0, r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
