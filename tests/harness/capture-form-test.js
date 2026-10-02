// Lesson 38 (02/10/2026): the quick-capture dispatcher opened the NCR and equipment
// forms with a bare openModal, so the hidden id of the last edited record stayed and
// the capture overwrote it on save (the inc case was fixed on 01/10, its siblings
// were not). Also the delete dialog: a Hebrew label for every table that has a trash
// button, and the topic before the date (it read "auds / 2026-09-15").
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const FILE = path.resolve(__dirname, '../../index.html');
const HTML = 'file://' + FILE;
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const src = fs.readFileSync(FILE, 'utf8');
  const tables = new Set([...src.matchAll(/data-dtbl="([a-z_]+)"/g)].map((m) => m[1]).concat([...src.matchAll(/askDel\('([a-z_]+)'/g)].map((m) => m[1])));
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
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', d: 'מטף ללא תווית', sd: '2026-09-20', p: 'גבוהה', o: 'יוסי', s: 'פתוח', u: '2026-09-27', rc: 'סיבה', c: 'פעולה' }];
    DB.equip_inspections = [{ id: 'q1', code: 'EQ-1', n: 'מלגזה 3', loc: 'מחסן', d: '2026-09-01', e: '2027-09-01', s: 'תקין' }];
    DB.auds = [{ id: 'a1', n: 'ביקורת מחסן', r: 'בטיחות', d: '2026-09-15', a: '', s: 'הושלם', sm: '' }];
    DB.inc = [{ id: 'i1', d: '2026-09-10', dt: '2026-09-10', ty: 'תאונת עבודה', sv: 'קל', l: 'ייצור', w: 'עובד', s: 'פתוח', r: 'נפילה' }];
    localStorage.removeItem('tfgn_ncr_draft_v1');
  });

  console.log('\n1. capture -> NCR after editing an NCR');
  let r = await page.evaluate(() => {
    editNcr('n1'); const before = gv('ncr-id'); closeModal('m-ncr');
    capDispatch({ type: 'ncr', description: 'שמן על הרצפה ליד קו 2', area: 'ייצור', reporter: 'דנה', date: '2026-10-01' });
    return { before, id: gv('ncr-id'), d: gv('ncr-d'), loc: gv('ncr-loc'), o: gv('ncr-o'), sd: gv('ncr-sd'), p: gv('ncr-p'), u: gv('ncr-u'), rc: gv('ncr-rc'), open: g('m-ncr').style.display !== 'none' };
  });
  check('the edited id is gone, the form is open', r.before === 'n1' && r.id === '' && r.open, r);
  check('the capture fields are filled, the old root cause is not', r.d === 'שמן על הרצפה ליד קו 2' && r.loc === 'ייצור' && r.o === 'דנה' && r.sd === '2026-10-01' && r.rc === '', r);
  check('target by priority from the capture date (medium: 30 days)', r.p === 'בינונית' && r.u === '2026-10-31', r);
  r = await page.evaluate(() => { svNcr(); return { n: DB.ncr.length, first: DB.ncr.find((x) => x.id === 'n1').d, ins: window.__ins.filter((x) => x.t === 'ncr').length, upd: window.__upd.filter((x) => x.t === 'ncr').length }; });
  check('saving adds a second NCR and leaves NCR-0001 as it was', r.n === 2 && r.first === 'מטף ללא תווית' && r.ins === 1 && r.upd === 0, r);

  console.log('\n2. capture -> equipment inspection after editing one');
  r = await page.evaluate(() => {
    g('eqi-id').value = 'q1';
    capDispatch({ type: 'eqi', description: 'מלגזה 3 בלם לא תקין', area: 'מחסן', date: '2026-10-01' });
    return { id: gv('eqi-id'), n: gv('eqi-n'), open: g('m-eqi').style.display !== 'none' };
  });
  check('the stale id is cleared, the description is filled', r.id === '' && r.n === 'מלגזה 3 בלם לא תקין' && r.open, r);
  await page.evaluate(() => closeModal('m-eqi'));

  console.log('\n3. the capture types that use _svEditing');
  r = await page.evaluate(() => { _svEditing = { near_miss: 'x1' }; capDispatch({ type: 'nm', description: 'כמעט', date: '2026-10-01' }); return { ed: _svEditId('near_miss'), open: g('m-nm').style.display !== 'none' }; });
  check('near miss: openModal resets the editing id', r.ed === null && r.open, r);
  await page.evaluate(() => closeModal('m-nm'));

  console.log('\n4. the delete dialog names what it deletes, in Hebrew');
  r = await page.evaluate((tables) => { const miss = tables.filter((t) => typeof _DEL_TBL_LABEL[t] !== 'string' || /^[a-z_]+$/.test(_DEL_TBL_LABEL[t])); return { miss, n: tables.length }; }, [...tables]);
  check('every table with a trash button has a Hebrew label (' + r.n + ' tables)', r.miss.length === 0, r.miss);
  r = await page.evaluate(() => { askDel('auds', 'a1'); const t = g('del-what').innerText; g('ov-del-confirm').style.display = 'none'; g('m-del-confirm').style.display = 'none'; return t; });
  check('an audit: "ביקורת פנים" and its topic, not "auds" and not the ISO date', /ביקורת פנים/.test(r) && /ביקורת מחסן/.test(r) && !/auds/.test(r) && !/\d{4}-\d{2}-\d{2}/.test(r), r);
  r = await page.evaluate(() => { askDel('inc', 'i1'); const t = g('del-what').innerText; g('ov-del-confirm').style.display = 'none'; g('m-del-confirm').style.display = 'none'; return t; });
  check('a row whose only title is a date shows it as DD/MM/YYYY', /תקרית/.test(r) && /10\/09\/2026/.test(r) && !/2026-09-10/.test(r), r);
  r = await page.evaluate(() => { askDel('ncr', 'n1'); const t = g('del-what').innerText; g('ov-del-confirm').style.display = 'none'; g('m-del-confirm').style.display = 'none'; return t; });
  check('an NCR still shows its description', /אי-התאמה/.test(r) && /מטף ללא תווית/.test(r), r);

  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
