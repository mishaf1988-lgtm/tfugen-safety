// BACKLOG 7, the part that was not built: the management review (9.3) and the
// evaluation of compliance (9.1.2) as yearly duties on the expiry page, like the
// drills and the internal audits. Computed, nothing stored: _mrNext / _legNext feed
// _expCollect and _expNoDate, and rExp gives each its own buttons.
// SHOT=<file.png> also saves a 390px screenshot of the page.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    Object.keys(DB).forEach((k) => { if (Array.isArray(DB[k])) DB[k] = []; });
    window.__upd = []; window.sbIns = function () {}; window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'michael' }; window._role = () => 'admin'; window._isAdminUser = () => true;
  });
  const of = (mod) => page.evaluate((m) => ({
    dated: _expCollect().filter((x) => x.mod === m),
    none: _expNoDate().filter((x) => x.mod === m),
  }), mod);

  console.log('\n1. empty registers');
  await page.evaluate(() => { SB_ON = false; });
  let r = await of('mr');
  check('before sync: no management review row (the local copy may just be empty)', !r.dated.length && !r.none.length, r);
  await page.evaluate(() => { SB_ON = true; });
  r = await of('mr');
  check('after sync, no review saved: one row "never done", no date', !r.dated.length && r.none.length === 1 && r.none[0].owner === 'לא בוצעה אף פעם', r);
  r = await of('leg');
  check('empty legal register: no rows at all (9.1.2 is na)', !r.dated.length && !r.none.length, r);

  console.log('\n2. management review: 12 months after the latest of any kind');
  await page.evaluate(() => {
    DB.mgmt_reviews = [
      { id: 'm1', kind: 'annual', ts: '2025-01-10T08:00:00Z' },
      { id: 'm2', kind: 'review', ts: '2026-03-31T09:00:00Z' },
    ];
  });
  r = await of('mr');
  check('one dated row, due 31/03/2027, from the latest review', r.dated.length === 1 && r.dated[0].e === '2027-03-31' && r.dated[0].id === 'm2' && !r.none.length, r);
  check('the owner shows the last date', r.dated[0] && r.dated[0].owner === 'אחרונה: 31/03/2026', r.dated[0]);
  r = await page.evaluate(() => _plusMonths('2024-02-29', 12));
  check('29/02 plus a year = 28/02', r === '2025-02-28', r);

  console.log('\n3. evaluation of compliance: each law 12 months after its determination');
  await page.evaluate(() => {
    DB.leg = [
      { id: 'L1', s: 'תקנות הבטיחות בעבודה (גהות תעסוקתית)', c: 'עומד', c_date: '2025-09-01', c_by: 'dana' },
      { id: 'L2', s: 'חוק החומרים המסוכנים', c: 'טרם הוערך', c_date: null },
    ];
  });
  r = await of('leg');
  check('evaluated law: dated row due 01/09/2026 (expired)', r.dated.length === 1 && r.dated[0].id === 'L1' && r.dated[0].e === '2026-09-01', r);
  check('law not yet evaluated: on the no-date tab', r.none.length === 1 && r.none[0].id === 'L2' && r.none[0].owner === 'טרם הוערך', r);

  console.log('\n4. the buttons on the expiry page');
  r = await page.evaluate(() => {
    expFilter('all'); goPage('exp'); rExp();
    const rows = [...document.querySelectorAll('#tb-exp tr')];
    const row = (txt) => rows.find((tr) => tr.textContent.includes(txt));
    const l1 = row('גהות תעסוקתית'), l2 = row('החומרים המסוכנים'), mr = row('סקירת הנהלה');
    return {
      l1: l1 && [...l1.querySelectorAll('button')].map((b) => b.textContent.trim()),
      l2: l2 && [...l2.querySelectorAll('button')].map((b) => b.textContent.trim()),
      mr: mr && [...mr.querySelectorAll('button')].map((b) => b.textContent.trim()),
      badge: l1 && l1.textContent,
    };
  });
  check('evaluated law: view, still holds, change', JSON.stringify(r.l1) === JSON.stringify(['👁', '✅ בתוקף', '✏️ קביעה']), r.l1);
  check('law not yet evaluated: view and change only', JSON.stringify(r.l2) === JSON.stringify(['👁', '✏️ קביעה']), r.l2);
  check('management review: one button to the review page', JSON.stringify(r.mr) === JSON.stringify(['+ סקירה']), r.mr);

  r = await page.evaluate(() => {
    document.querySelector('#tb-exp [data-li="L1"][onclick^="_legReconfirm"]').click();
    const l = DB.leg[0], today = new Date().toISOString().substring(0, 10);
    return { cd: l.c_date, by: l.c_by, c: l.c, today, upd: window.__upd.filter((x) => x.t === 'leg').map((x) => x.r.c_date), next: _legNext()[0].e };
  });
  check('"still holds" stamps today and the user, keeps the determination', r.cd === r.today && r.by === 'michael' && r.c === 'עומד', r);
  check('the law is synced with the new date', r.upd.length === 1 && r.upd[0] === r.today, r);
  check('the next due date moves a year on', r.next === String(+r.today.substring(0, 4) + 1) + r.today.substring(4) || r.today.substring(5) === '02-29', r);

  r = await page.evaluate(() => { document.querySelector('#tb-exp [data-li="L2"][onclick^="editLeg"]').click(); return { open: g('m-leg').style.display !== 'none', id: g('leg-id').value, s: gv('leg-s') }; });
  check('"change" opens the law form on that law', r.open && r.id === 'L2' && r.s === 'חוק החומרים המסוכנים', r);
  await page.evaluate(() => closeModal('m-leg'));

  r = await page.evaluate(() => {
    goPage('exp'); rExp();
    const b = [...document.querySelectorAll('#tb-exp button')].find((x) => x.textContent.trim() === '+ סקירה');
    b.click();
    return document.getElementById('pg-mr').classList.contains('active') || getComputedStyle(document.getElementById('pg-mr')).display !== 'none';
  });
  check('"+ review" goes to the management review page', r, r);

  if (process.env.SHOT) {
    await page.evaluate(() => { goPage('exp'); expFilter('all'); rExp(); });
    await page.locator('#tb-exp').locator('xpath=ancestor::div[contains(@class,"card")][1]').screenshot({ path: process.env.SHOT });
  }
  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
