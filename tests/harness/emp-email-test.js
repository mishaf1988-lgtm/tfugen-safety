// Employee email field (BACKLOG follow-up): the add-employee form and the
// employees table gained an email column; it was only visible in the view
// dialog before. This adds one through the real form and checks it round-trips
// into DB.emp, the table row, and the view dialog.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' };
    if (!DB.emp) DB.emp = [];
    DB.emp = [];
    // save straight to the local store (no network) like the app does offline
    window.sdb = function () {}; window.sbSync = function () {};
  });

  // the form has an email input now
  const hasField = await page.evaluate(() => !!document.getElementById('e-em'));
  check('the add-employee form has an email field', hasField);

  // fill and save through the real svEmp
  const saved = await page.evaluate(() => {
    document.getElementById('e-n').value = 'יוסי כהן';
    document.getElementById('e-r').value = 'חשמלאי';
    document.getElementById('e-ph').value = '0501234567';
    document.getElementById('e-em').value = 'yossi@tapugan.co.il';
    svEmp();
    const row = DB.emp[0] || {};
    return { em: row.em, n: row.n, id: row.id };
  });
  check('svEmp stores the email on the row (em)', saved.em === 'yossi@tapugan.co.il', saved);

  // the table shows an email column with the value
  const table = await page.evaluate(() => {
    goPage('emp');
    const tb = document.getElementById('tb-emp');
    const heads = Array.from(document.querySelectorAll('#pg-emp thead th')).map((t) => t.textContent.trim());
    return { html: tb.innerHTML, heads };
  });
  check('the table header has a מייל column', table.heads.indexOf('מייל') >= 0, table.heads);
  check('the row shows the email', table.html.indexOf('yossi@tapugan.co.il') >= 0);

  // the view dialog still shows it (was the only place before)
  const view = await page.evaluate((id) => { showView('emp', id); return document.body.innerText; }, saved.id);
  check('the view dialog shows the email too', view.indexOf('yossi@tapugan.co.il') >= 0);

  // editing keeps the email (round-trips through _EDIT_MODS)
  const edited = await page.evaluate((id) => {
    _genEdit('emp', id);
    const v = document.getElementById('e-em').value;
    return v;
  }, saved.id);
  check('opening the row for edit refills the email', edited === 'yossi@tapugan.co.il', edited);

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
