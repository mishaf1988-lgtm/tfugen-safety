// BACKLOG 9.7, the last code part: a finding in an internal audit opens an NCR.
// The audit view has a button that opens the NCR form filled; on save the NCR
// number is written into the audit summary (no new column, like the near-miss
// chain), and the audit list shows how many of its NCRs are still open.
// A chain that was cancelled must not link the next NCR.
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
    DB.ncr = []; DB.auds = [{ id: 'a1', n: 'ביקורת מחסן', a: 'דנה', r: 'בטיחות', d: '2026-09-30', f: 2, sc: 80, s: 'הושלם', sm: 'סיכום' }];
    window.__upd = []; window.sbIns = function () {}; window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
  });

  console.log('\n1. the audit view has the button, and it opens the NCR form filled');
  let r = await page.evaluate(() => { showView('auds', 'a1'); return !!document.querySelector('#view-body [data-aid="a1"]'); });
  check('the button is in the audit view', r);
  r = await page.evaluate(() => { document.querySelector('#view-body [data-aid="a1"]').click(); return { open: g('m-ncr').style.display !== 'none', d: gv('ncr-d'), sd: gv('ncr-sd'), notes: gv('ncr-notes'), a: gv('ncr-a'), pend: _audChainPending }; });
  check('the NCR form is open', r.open, r);
  check('description, discovery date = audit date, notes name the audit, type = safety', r.d.indexOf('ממצא בביקורת פנים (ביקורת מחסן)') === 0 && r.sd === '2026-09-30' && r.notes.indexOf('ביקורת מחסן 30/09/2026') > 0 && r.a === 'בטיחות', r);

  console.log('\n2. save: the NCR number lands in the audit summary');
  r = await page.evaluate(() => { g('ncr-d').value += 'מטף חסום'; svNcr(); const n = DB.ncr[0]; return { num: n && n.num, sm: DB.auds[0].sm, upd: window.__upd.filter((x) => x.t === 'auds').length, pend: _audChainPending }; });
  check('one NCR saved', !!r.num, r);
  check('the audit summary keeps its text and gets the NCR number', r.sm === 'סיכום\nנפתח ' + r.num + ' מממצא בביקורת', r.sm);
  check('the audit is synced, and the pending link is cleared', r.upd === 1 && r.pend === null, r);
  r = await page.evaluate(() => { rAud(); return document.getElementById('tb-aud').textContent; });
  check('the audit row: 1 open of 1', r.includes('NCR: 1 פתוחים מתוך 1'), r);
  r = await page.evaluate(() => { DB.ncr[0].s = 'סגור'; rAud(); return document.getElementById('tb-aud').textContent; });
  check('the NCR closed: 0 open of 1', r.includes('NCR: 0 פתוחים מתוך 1'), r);

  console.log('\n3. a cancelled chain does not link the next NCR');
  r = await page.evaluate(() => {
    _chainAudToNcr('a1'); closeModal('m-ncr');
    openNewNcrModal(); g('ncr-d').value = 'NCR רגיל'; svNcr();
    return { n: DB.ncr.length, sm: DB.auds[0].sm };
  });
  check('a second NCR saved, the audit summary unchanged', r.n === 2 && (r.sm.match(/NCR-\d+/g) || []).length === 1, r);
  r = await page.evaluate(() => { const n = DB.ncr[0]; _chainAudToNcr('a1'); closeModal('m-ncr'); g('ncr-id').value = n.id; g('ncr-d').value = n.d; svNcr(); return DB.auds[0].sm; });
  check('editing an existing NCR after a cancelled chain does not link it', (r.match(/NCR-\d+/g) || []).length === 1, r);

  console.log('\n4. editing an NCR keeps its number a string');
  r = await page.evaluate(() => { const n = DB.ncr[0], num = n.num; let sent; window.sbUpd = (t, x) => { if (t === 'ncr') sent = x; }; g('ncr-id').value = n.id; g('ncr-d').value = n.d + ' עודכן'; svNcr(); return { num, sent: sent && sent.num, local: DB.ncr[0].num }; });
  check('the edit sends the same number, not the old record', typeof r.sent === 'string' && r.sent === r.num && r.local === r.num, r);

  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
})();
