// Deleting from a page that is not the record's own (10/10/2026, Michael's screenshot):
// the tasks page shows an open NCR as a virtual row with a red trash that deletes the NCR.
// The NCR left DB.ncr, but only the NCR page was re-rendered: the row stayed on the tasks
// page, and tapping it said "record not found - try refreshing".
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    Object.keys(DB).forEach((k) => { if (Array.isArray(DB[k])) DB[k] = []; });
    window._currentUser = { username: 'admin' }; window._role = () => 'admin'; window._isAdminUser = () => true;
    window.__del = []; window.sbDel = function (t, i) { window.__del.push(t + ':' + i); }; window.sdb = function () {}; window.addLog = function () {};
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', d: 'ממצא בביקורת פנים', s: 'פתוח' }];
    DB.tasks = [{ id: 't1', title: 'משימה רגילה', status: 'פתוח' }];
    goPage('tasks');
    const html = () => (document.getElementById('pg-tasks') || document.body).innerHTML;
    const before = html().indexOf('NCR-0001') >= 0;
    delById('ncr', 'n1');
    return { before, after: html().indexOf('NCR-0001') >= 0, keeps: html().indexOf('משימה רגילה') >= 0, del: window.__del, left: DB.ncr.length };
  });
  check('the open NCR shows on the tasks page', r.before, r);
  check('deleted: gone from the data and sent to the server', r.left === 0 && r.del.join() === 'ncr:n1', r);
  check('...and gone from the tasks page on screen', !r.after, r);
  check('the other tasks stay', r.keeps, r);
  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
