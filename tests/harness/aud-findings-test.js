// Michael, 02/10/2026: an audit has several findings, each becomes its own NCR.
// Rows in the audit form: description, priority (target date by priority from
// the audit date), responsible. Linked through the audit summary like the
// single "open NCR from finding" button. Plus: a past date saved as "planned"
// asks to mark it done.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [], dialogs = [];
  let answer = true;
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('dialog', (d) => { dialogs.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    DB.ncr = []; DB.auds = [];
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
  });
  const fill = (rows) => page.evaluate((rows) => {
    rows.forEach((x, i) => {
      if (i > 0) _audFndRow();
      const r = document.querySelectorAll('#aud-fnd .aud-fr')[i];
      r.querySelector('.aud-ft').value = x.t; r.querySelector('.aud-fp').value = x.p; r.querySelector('.aud-fo').value = x.o;
    });
  }, rows);

  console.log('\n1. the form opens with one empty finding row');
  let r = await page.evaluate(() => { openModal('m-aud'); const rows = document.querySelectorAll('#aud-fnd .aud-fr'); return { n: rows.length, p: rows[0] && rows[0].querySelector('.aud-fp').value }; });
  check('one row, priority medium by default', r.n === 1 && r.p === 'בינונית', r);

  console.log('\n2. three findings = three NCRs');
  await page.evaluate(() => { g('a-n').value = 'בטיחות מחסן'; g('a-r').value = 'בטיחות'; g('a-d').value = '2026-09-30'; g('a-st').value = 'הושלם'; g('a-sm').value = 'סיכום'; });
  await fill([{ t: 'חדר חשמל פתוח', p: 'גבוהה', o: 'יוסי' }, { t: 'כימיקלים זרוקים', p: 'קריטי', o: 'דנה' }, { t: 'שילוט חסר', p: 'נמוכה', o: '' }]);
  await page.evaluate(() => { _audFndRow(); }); // an empty row is ignored
  r = await page.evaluate(() => { svAud(); return { ncr: DB.ncr.map((n) => ({ num: n.num, d: n.d, p: n.p, o: n.o, u: n.u, sd: n.sd, s: n.s })), aud: DB.auds[0], ins: window.__ins.filter((x) => x.t === 'ncr').length }; });
  check('three NCRs, each synced', r.ncr.length === 3 && r.ins === 3, r);
  check('separate descriptions, each names the audit', r.ncr[0].d === 'ממצא בביקורת פנים (בטיחות מחסן): חדר חשמל פתוח' && r.ncr[1].d.endsWith('כימיקלים זרוקים'), r.ncr);
  check('distinct numbers', new Set(r.ncr.map((n) => n.num)).size === 3, r.ncr);
  check('target by priority from the audit date (high 7, critical 1, low 60)', r.ncr[0].u === '2026-10-07' && r.ncr[1].u === '2026-10-01' && r.ncr[2].u === '2026-11-29', r.ncr);
  check('responsible, discovery date, status open', r.ncr[0].o === 'יוסי' && r.ncr[0].sd === '2026-09-30' && r.ncr.every((n) => n.s === 'פתוח'), r.ncr);
  check('the summary keeps its text and lists all three', r.aud.sm.startsWith('סיכום\n') && r.ncr.every((n) => r.aud.sm.includes('נפתח ' + n.num + ' מממצא בביקורת')), r.aud.sm);
  check('findings count = 3', r.aud.f === 3, r.aud.f);
  r = await page.evaluate(() => { rAud(); return document.getElementById('tb-aud').textContent; });
  check('the audit row: 3 open of 3', r.includes('NCR: 3 פתוחים מתוך 3'), r);

  console.log('\n3. editing the audit adds only the new rows');
  r = await page.evaluate(() => {
    const a = DB.auds[0]; _svEditing = {}; _genEdit('auds', a.id);
    return { rows: document.querySelectorAll('#aud-fnd .aud-fr').length, sm: gv('a-sm') };
  });
  check('the edit form opens with one empty row', r.rows === 1, r);
  await fill([{ t: 'מטף חסום', p: 'בינונית', o: '' }]);
  r = await page.evaluate(() => { svAud(); return { n: DB.ncr.length, auds: DB.auds.length, f: DB.auds[0].f, sm: DB.auds[0].sm }; });
  check('one more NCR, the same audit, count 4', r.n === 4 && r.auds === 1 && r.f === 4 && (r.sm.match(/NCR-\d+/g) || []).length === 4, r);

  console.log('\n4. a past date saved as "planned" asks to mark it done');
  dialogs.length = 0;
  r = await page.evaluate(() => { openModal('m-aud'); g('a-n').value = 'ביקורת ב'; g('a-d').value = '2026-09-01'; g('a-st').value = 'מתוכנן'; svAud(); return DB.auds[DB.auds.length - 1].s; });
  check('asked, and on yes it is done', dialogs.length === 1 && r === 'הושלם', { dialogs, r });
  answer = false;
  r = await page.evaluate(() => { openModal('m-aud'); g('a-n').value = 'ביקורת ג'; g('a-d').value = '2026-09-01'; g('a-st').value = 'מתוכנן'; svAud(); return DB.auds[DB.auds.length - 1].s; });
  check('on no it stays planned', r === 'מתוכנן', r);
  answer = true; dialogs.length = 0;
  r = await page.evaluate(() => { openModal('m-aud'); g('a-n').value = 'ביקורת ד'; g('a-d').value = '2099-01-01'; g('a-st').value = 'מתוכנן'; svAud(); return DB.auds[DB.auds.length - 1].s; });
  check('a future planned audit is not asked about', dialogs.length === 0 && r === 'מתוכנן', { dialogs, r });

  check('no page errors', errs.length === 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
