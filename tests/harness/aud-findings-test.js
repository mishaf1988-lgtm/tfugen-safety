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
  r = await page.evaluate(() => { const sel = document.querySelector('#aud-fnd .aud-fp'); const m = g('m-aud'); const t = m.querySelector('.modal-title'); return { txt: sel.options[sel.selectedIndex].text, pr: parseInt(getComputedStyle(t).paddingRight, 10), fs: m.classList.contains('is-fullscreen') }; });
  check('the priority select says what it is', r.txt === 'עדיפות: בינונית', r.txt);
  check('on a phone the title leaves room for the close button (iOS Safari puts them on one line)', r.fs && r.pr >= 60, r);

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

  console.log('\n5. a restored draft is not overwritten by "open NCR from finding"');
  answer = true;
  r = await page.evaluate(() => {
    const a = DB.auds[0];
    localStorage.setItem('tfgn_ncr_draft_v1', JSON.stringify({ ts: Date.now(), snap: { 'ncr-d': 'ממצא בביקורת פנים (בטיחות מחסן): חדר חשמל פתוח', 'ncr-rc': 'סיבה', 'ncr-sd': '2026-09-30' } }));
    _chainAudToNcr(a.id);
    return { d: gv('ncr-d'), rc: gv('ncr-rc'), pend: _audChainPending === a.id };
  });
  check('the description typed before survives, and the link is still pending', r.d.endsWith('חדר חשמל פתוח') && r.rc === 'סיבה' && r.pend, r);
  await page.evaluate(() => { closeModal('m-ncr'); try { localStorage.removeItem('tfgn_ncr_draft_v1'); } catch (e) {} _audChainPending = null; });

  console.log('\n6. the NCR table: discovery date as a date, a visible delete mark');
  r = await page.evaluate(() => {
    DB.ncr = [{ id: 'n9', num: 'NCR-0009', d: 'x', a: 'בטיחות', p: 'בינונית', sd: '2026-01-15', u: '2099-01-01', s: 'פתוח' }];
    rNcr(); const tr = document.querySelector('#tb-ncr tr'); const del = tr.querySelector('[data-dtbl="ncr"]');
    return { txt: tr.textContent, color: getComputedStyle(del).color, bg: getComputedStyle(del).backgroundColor };
  });
  check('a past discovery date shows 15/01/2026, not "expired"', r.txt.includes('15/01/2026') && !r.txt.includes('פג'), r.txt);
  check('the delete mark is white on red, not red on red', r.color === 'rgb(255, 255, 255)' && r.color !== r.bg, r);

  console.log('\n7. the delete dialog on a phone');
  r = await page.evaluate(() => {
    try { localStorage.removeItem('tfgn_del_pw'); } catch (e) {}
    askDel('ncr', 'n9'); const m = g('m-del-confirm');
    return { w: m.getBoundingClientRect().width, vw: window.innerWidth, hint: g('del-pw-hint').innerHTML, warn: g('del-warn').textContent };
  });
  check('it fills the phone width (was 300px)', r.w >= r.vw - 2, r);
  check('the hint is a button, not a console command', r.hint.includes('_delPwChange') && !r.hint.includes('setDeletePassword('), r.hint);
  check('no long dash in the warning', !r.warn.includes('\u2014'), r.warn);
  answer = true;
  r = await page.evaluate(() => { cancelDel(); window.prompt = (() => { let k = 0; return () => (k++ ? '4321' : '4321'); })(); _delPwChange(); return { pw: _delPw(), hint: g('del-pw-hint').style.display }; });
  check('two matching entries set it on this device, and the hint goes away', r.pw === '4321' && r.hint === 'none', r);
  await page.evaluate(() => { try { localStorage.removeItem('tfgn_del_pw'); } catch (e) {} });

  console.log('\n8. a deleted NCR is not counted as an open finding');
  r = await page.evaluate(() => {
    DB.ncr = [{ id: 'k1', num: 'NCR-0021', d: 'x', s: 'פתוח' }];
    DB.auds = [{ id: 'z1', n: 'ז', r: 'בטיחות', d: '2026-09-30', s: 'הושלם', sm: 'נפתח NCR-0020 מממצא בביקורת\nנפתח NCR-0021 מממצא בביקורת' }];
    rAud(); return document.getElementById('tb-aud').textContent;
  });
  check('only the NCR that exists: 1 open of 1', r.includes('NCR: 1 פתוחים מתוך 1'), r);

  check('no page errors', errs.length === 0, errs);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
