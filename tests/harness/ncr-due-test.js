// The NCR target date by priority (Michael, 02/10/2026): critical 1 day,
// high 7, medium 30, low 60, counted from the discovery date (or today).
// A date typed by hand is never overwritten; one the form filled itself is.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    DB.ncr = []; DB.auds = [{ id: 'a1', n: 'ביקורת מחסן', a: 'דנה', r: 'בטיחות', d: '2026-09-30', f: 2, sc: 80, s: 'הושלם', sm: '' }];
    window.sbIns = function () {}; window.sbUpd = function () {};
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    try { localStorage.removeItem('tfgn_ncr_draft_v1'); } catch (e) {}
  });
  const pick = (v) => page.evaluate((v) => { const p = g('ncr-p'); p.value = v; p.dispatchEvent(new Event('change')); return gv('ncr-u'); }, v);
  const today = (n) => page.evaluate((n) => { const b = new Date(); b.setDate(b.getDate() + n); return b.getFullYear() + '-' + String(b.getMonth() + 1).padStart(2, '0') + '-' + String(b.getDate()).padStart(2, '0'); }, n);

  console.log('\n1. a new NCR gets a target from the default priority');
  let r = await page.evaluate(() => { openNewNcrModal(); return { p: gv('ncr-p'), u: gv('ncr-u') }; });
  check('medium, no discovery date: today + 30', r.p === 'בינונית' && r.u === await today(30), r);

  console.log('\n2. changing the priority moves a target the form filled');
  check('critical: +1', (await pick('קריטי')) === await today(1));
  check('high: +7', (await pick('גבוהה')) === await today(7));
  check('low: +60', (await pick('נמוכה')) === await today(60));

  console.log('\n3. counted from the discovery date when there is one');
  r = await page.evaluate(() => { const s = g('ncr-sd'); s.value = '2026-09-30'; s.dispatchEvent(new Event('change')); return gv('ncr-u'); });
  check('low from 30/09/2026 = 29/11/2026', r === '2026-11-29', r);
  check('high from 30/09/2026 = 07/10/2026', (await pick('גבוהה')) === '2026-10-07');

  console.log('\n4. a date typed by hand is kept');
  r = await page.evaluate(() => { g('ncr-u').value = '2026-12-25'; const p = g('ncr-p'); p.value = 'קריטי'; p.dispatchEvent(new Event('change')); return gv('ncr-u'); });
  check('priority change does not overwrite it', r === '2026-12-25', r);

  console.log('\n5. from an audit finding: counted from the audit date');
  r = await page.evaluate(() => { closeModal('m-ncr'); _chainAudToNcr('a1'); return { sd: gv('ncr-sd'), u: gv('ncr-u') }; });
  check('medium from 30/09/2026 = 30/10/2026', r.sd === '2026-09-30' && r.u === '2026-10-30', r);

  console.log('\n6. editing an NCR keeps its saved target');
  r = await page.evaluate(() => {
    closeModal('m-ncr');
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', d: 'x', p: 'בינונית', u: '2026-10-05', sd: '2026-09-01', s: 'פתוח' }];
    editNcr('n1'); const before = gv('ncr-u');
    const p = g('ncr-p'); p.value = 'נמוכה'; p.dispatchEvent(new Event('change'));
    return { before, after: gv('ncr-u') };
  });
  check('the saved date loads and survives a priority change', r.before === '2026-10-05' && r.after === '2026-10-05', r);

  console.log('\n7. root cause and corrective action show the whole text (02/10/2026)');
  r = await page.evaluate(() => ['ncr-rc', 'ncr-c'].map((id) => { const el = g(id); return { tag: el.tagName, rows: el.rows, fw: el.closest('.field').classList.contains('fw') }; }));
  check('both are 3-row textareas, full width', r.every((x) => x.tag === 'TEXTAREA' && x.rows === 3 && x.fw), r);

  check('no page errors', errs.length === 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
