// Self-check of Michael's 02/10/2026 test list (a..e, 2..8) at phone width (390px),
// Supabase mocked: the flows he was asked to test on the phone, run here first
// (lesson 24, recurred: "you know how to test by yourself"). Screenshots only when
// SHOTS=<dir> is set; then read the png, not just the text.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = process.env.SHOTS || '';
const res = [];
const say = (k, ok, d) => { res.push({ k, ok, d }); console.log((ok ? 'PASS ' : 'FAIL ') + k + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); };
const DASH = /\u2014|\u2015|\u05be|\u00ab|\u00bb|\u2026|[\u201c\u201d\u2018\u2019]/; const DSRC = DASH.source;
(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL', deviceScaleFactor: 2 })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [], dialogs = [];
  let answer = true;
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => { dialogs.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(800);
  const shot = (n) => OUT ? page.screenshot({ path: path.join(OUT, n + '.png') }) : Promise.resolve();
  await page.evaluate((dsrc) => { window.DASH_RE = new RegExp(dsrc);
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.__ins = []; window.sbIns = function (t, r) { window.__ins.push({ t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true; } , DSRC); await page.evaluate(() => {
    var iso = function (d) { var x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    DB.ncr = []; DB.auds = []; DB.drl = []; DB.tasks = []; DB.leg = DB.leg || []; DB.inc = [];
    // 8 high hazards closed from 02/09 on (recheck rows), + 27/38 on-time for the objectives card
    DB.tour_hazards = [];
    for (var i = 0; i < 38; i++) { var closed = i < 27; DB.tour_hazards.push({ id: 'h' + i, n: i + 1, descr: 'מפגע ' + (i + 1) + ' מעקה חסר', sev: i < 8 ? 'גבוהה' : 'בינונית', s: 'סגור', dept: 'ייצור', due: '2026-09-20', closed_d: closed ? '2026-09-' + String(3 + (i % 17)).padStart(2, '0') : '2026-09-28', recheck_d: null }); }
    // incidents 2026 without investigation
    for (var j = 0; j < 3; j++) DB.inc.push({ id: 'inc' + j, d: '2026-0' + (j + 3) + '-10', dt: '2026-0' + (j + 3) + '-10', ty: 'תאונת עבודה', sv: j === 0 ? 'קל' : '', l: 'ייצור', w: 'עובד ' + j, dy: '', s: 'פתוח', r: 'נפילה', p: '' });
  });

  // ---- א. modal title vs X (Chromium only: measure room) ----
  for (const m of ['m-aud', 'm-ncr']) {
    let r = await page.evaluate((id) => { openModal(id); const md = g(id); const t = md.querySelector('.modal-title'); const x = md.querySelector('.modal-close,.close,[onclick*="closeModal"]'); const tr = t.getBoundingClientRect(), xr = x ? x.getBoundingClientRect() : null; return { title: t.textContent.trim(), pr: parseInt(getComputedStyle(t).paddingRight) || 0, overlap: xr ? !(tr.right <= xr.left || tr.left >= xr.right || tr.bottom <= xr.top || tr.top >= xr.bottom) : null, mdW: md.getBoundingClientRect().width, vw: innerWidth }; }, m);
    await shot('A-' + m);
    say('א ' + m + ': title does not overlap X, has padding, modal fills width', r.overlap === false && r.pr >= 60 && Math.abs(r.mdW - r.vw) < 2, r);
    await page.evaluate((id) => closeModal(id), m);
  }

  // ---- ב. audit with 2 findings ----
  let r = await page.evaluate(() => {
    openModal('m-aud'); g('a-n').value = 'ביקורת מחסן'; g('a-r').value = 'בטיחות'; g('a-d').value = '2026-10-01'; g('a-st').value = 'הושלם'; g('a-sm').value = '';
    _audFndRow(); const rows = document.querySelectorAll('#aud-fnd .aud-fr');
    [['מטף ללא תווית בדיקה', 'גבוהה', 'יוסי'], ['שילוט יציאה חסר', 'נמוכה', 'דנה']].forEach((x, i) => { rows[i].querySelector('.aud-ft').value = x[0]; rows[i].querySelector('.aud-fp').value = x[1]; rows[i].querySelector('.aud-fo').value = x[2]; });
    const sel = rows[0].querySelector('.aud-fp');
    return { rows: rows.length, selTxt: sel.options[sel.selectedIndex].text };
  });
  await shot('B-aud-form');
  say('ב form: 2 rows, select text has "עדיפות:" label', r.rows === 2 && /^עדיפות: /.test(r.selTxt), r);
  r = await page.evaluate(() => { svAud(); rAud(); return { ncr: DB.ncr.map(n => ({ num: n.num, d: n.d, u: n.u, s: n.s })), tb: g('tb-aud').textContent, ins: window.__ins.filter(x => x.t === 'ncr').length }; });
  say('ב save: 2 NCR, 2 inserts, "NCR: 2 פתוחים מתוך 2"', r.ncr.length === 2 && r.ins === 2 && r.tb.includes('NCR: 2 פתוחים מתוך 2'), r);
  say('ב NCR due by priority (high 7d, low 60d from audit date)', r.ncr[0].u === '2026-10-08' && r.ncr[1].u === '2026-11-30', r.ncr);
  await page.evaluate(() => goPage('aud')); await page.waitForTimeout(300); await shot('B-aud-table');
  // ---- ה. audit table: "-" in empty cell, header, pencil ----
  r = await page.evaluate(() => { DB.auds.push({ id: 'a2', n: 'ביקורת ללא מבקר', r: 'סביבה', d: '2026-09-15', a: '', sc: '', s: 'מתוכנן', sm: '' }); rAud(); const tb = g('tb-aud'); const th = Array.from(document.querySelectorAll('#pg-aud th')).map(t => t.textContent.trim()); const row = Array.from(tb.querySelectorAll('tr')).find(t => t.textContent.includes('ללא מבקר')); return { th, cells: Array.from(row.querySelectorAll('td')).map(c => c.textContent.trim()), pencil: !!row.querySelector('[data-etbl]'), bad: DASH_RE.test(tb.textContent) }; }).catch(async (e) => ({ err: e.message }));
  if (r.err) { r = await page.evaluate(() => { const tb = g('tb-aud'); const th = Array.from(document.querySelectorAll('#pg-aud th')).map(t => t.textContent.trim()); const row = Array.from(tb.querySelectorAll('tr')).find(t => t.textContent.includes('ללא מבקר')); return { th, cells: Array.from(row.querySelectorAll('td')).map(c => c.textContent.trim()), pencil: !!row.querySelector('[data-etbl]'), txt: tb.textContent }; }); r.bad = DASH.test(r.txt); delete r.txt; }
  await shot('E-aud-table-empty');
  say('ה header says "סטטוס" not "סט.", empty cells show "-", pencil present, no long dash/typographic chars', r.th.includes('סטטוס') && !r.th.includes('סט.') && r.cells.some(c => c === '-') && r.pencil && !r.bad, r);

  // ---- ד. delete dialog ----
  r = await page.evaluate(() => { askDel('auds', 'a2'); const md = g('m-del-confirm'); const cs = getComputedStyle(md); return { w: md.getBoundingClientRect().width, vw: innerWidth, maxW: cs.maxWidth, txt: md.textContent, btn: !!Array.from(md.querySelectorAll('button')).find(b => /שנה סיסמת מחיקה/.test(b.textContent)) }; });
  await shot('D-delete');
  say('ד delete dialog fills the phone width, has "שנה סיסמת מחיקה" button, no long dash', Math.abs(r.w - r.vw) < 2 && r.btn && !DASH.test(r.txt), { w: r.w, vw: r.vw, maxW: r.maxW, btn: r.btn, dash: DASH.test(r.txt) });
  await page.evaluate(() => { g('ov-del-confirm').style.display = 'none'; g('m-del-confirm').style.display = 'none'; });

  // ---- NCR: due by priority, textarea 3 rows, table date plain, delete ✕ ----
  r = await page.evaluate(() => { openNewNcrModal(); const today = new Date(); const iso = (d) => { const x = new Date(today); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }; const u30 = gv('ncr-u'); g('ncr-p').value = 'קריטי'; _ncrAutoDue(); const u1 = gv('ncr-u'); return { u30, u1, exp30: iso(30), exp1: iso(1), rcRows: +g('ncr-rc').rows, cRows: +g('ncr-c').rows, rcW: g('ncr-rc').getBoundingClientRect().width, mdW: g('m-ncr').getBoundingClientRect().width }; });
  await shot('NCR-form');
  say('NCR due: 30d default, 1d on critical', r.u30 === r.exp30 && r.u1 === r.exp1, r);
  say('NCR root cause / action are 3-row textareas, full width', r.rcRows >= 3 && r.cRows >= 3 && r.rcW > r.mdW * 0.8, r);
  await page.evaluate(() => closeModal('m-ncr'));
  r = await page.evaluate(() => { goPage('ncr'); rNcr(); const tb = g('tb-ncr'); const row = tb.querySelector('tr'); return { txt: row.textContent, badge: !!row.querySelector('.badge,.eb,[class*="badge"]'), del: Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => /✕|🗑/.test(t)) }; });
  await page.waitForTimeout(300); await shot('NCR-table');
  say('NCR table: discovery date not an expiry badge ("0 י"/"פג"), delete button carries ✕ or 🗑', !/\d+ י\b|פג/.test(r.txt) && r.del.length > 0, r);

  // ---- ג. AI prompt rules (server not reachable here) ----
  r = await page.evaluate(() => { const src = _ncrAIRcAction.toString(); return { len: src.length, rules: ['\\u05dc\\u05e2\\u05d3\\u05db\\u05df \\u05e0\\u05d4\\u05dc\\u05d9\\u05dd', 'ncr-p', 'ncr-loc'].map(k => src.includes(k) || src.includes(JSON.parse('"' + k + '"'))) }; }).catch(e => ({ err: e.message }));
  say('ג prompt builder exists and reads priority/location (text rules verified by ncr-ai-prompt-test)', !r.err && r.rules[1] && r.rules[2], r);

  // ---- 2. expiry page ----
  r = await page.evaluate(() => { DB.drl.push({ id: 'd1', ty: 'שריפה', d: '2025-11-15', p: 'כולם', dur: '20', sc: 'תקין', n: '' }); goPage('exp'); rExp(); expFilter('all'); const t = g('pg-exp').textContent; const rck = (t.match(/בדיקה חוזרת למפגע/g) || []).length; const drl = (t.match(/תרגיל חירום/g) || []).length; return { rck, drl, hasNov: /15\/11\/2026/.test(t), bad: DASH_RE.test(t) }; }).catch(e => ({ err: e.message }));
  await page.waitForTimeout(300); await shot('2-exp-all');
  say('2 expiry "הכל": 8 recheck rows, drill next date 15/11/2026, no long dash', r.rck >= 8 && r.drl >= 1 && r.hasNov && !r.bad, r);
  r = await page.evaluate(() => { expFilter('none'); const t = g('pg-exp').textContent; return { plus: (t.match(/\+ תרגיל/g) || []).length, types: (t.match(/תרגיל חירום/g) || []).length }; });
  await page.waitForTimeout(200); await shot('2-exp-none');
  say('2 expiry "ללא תאריך": other drill types with "+ תרגיל"', r.plus >= 1, r);
  r = await page.evaluate(() => { DB.drl = []; rExp(); expFilter('all'); const t = g('pg-exp').textContent; return { drl: (t.match(/תרגיל חירום/g) || []).length }; });
  say('6 empty drill register: no drill rows at all', r.drl === 0, r);

  // ---- 3. drill with 2 findings ----
  r = await page.evaluate(() => { openModal('m-drl'); g('drl-ty').selectedIndex = 0; g('drl-d').value = '2026-10-01'; _drlFndRow(); const rows = document.querySelectorAll('#drl-fnd .drl-fr'); [['יציאת חירום חסומה', 'אחזקה', '2026-10-15'], ['צופר לא נשמע', 'חשמלאי', '2026-10-20']].forEach((x, i) => { rows[i].querySelector('.drl-ft').value = x[0]; rows[i].querySelector('.drl-fa').value = x[1]; rows[i].querySelector('.drl-fu').value = x[2]; }); return rows.length; });
  await shot('3-drl-form');
  r = await page.evaluate(() => { svDrl(); rDrl(); return { tasks: DB.tasks.length, src: DB.tasks.map(t => t.source_table), tb: g('tb-drl').textContent.includes('ממצאים: 2 פתוחים מתוך 2'), lbl: _tskSrcLabel('drl') }; });
  await page.evaluate(() => { goPage('drl'); rDrl(); }); await page.waitForTimeout(300); await shot('3-drl-table');
  say('3 drill: 2 tasks from drill, "ממצאים: 2 פתוחים מתוך 2", source "תרגיל חירום"', r.tasks === 2 && r.src.every(s => s === 'drl') && r.tb && r.lbl === 'תרגיל חירום', r);
  r = await page.evaluate(() => { goPage('exp'); rExp(); expFilter('all'); const t = g('pg-exp').textContent; return { next: /01\/10\/2027/.test(t) }; });
  say('2/3 expiry: drill next date = 12 months after 01/10/2026', r.next, r);

  // ---- 5/6. management review objectives card ----
  r = await page.evaluate(() => { goPage('mr'); try { rMr(); } catch (e) { } const t = g('pg-mr').textContent; const m = _objMeasure().find(o => o.k === 'thz'); return { card: /יעדים 2026/.test(t), thz: [m.n, m.d], pct: m.p, all: _objMeasure().map(o => o.k + ':' + o.st), na: (t.match(/אין נתונים/g) || []).length, near: /קרוב ליעד/.test(t), html: _objHtml().slice(0, 300) }; }).catch(e => ({ err: e.message }));
  await page.waitForTimeout(400); await shot('5-mr-objectives');
  say('5 objectives card: 27/38 = 71%, "קרוב ליעד"', r.card && r.thz && r.thz[0] === 27 && r.thz[1] === 38 && r.pct === 71 && r.near, r);
  say('6 empty registers say "אין נתונים" (tr empty; rec/ncr depend on seeds)', r.na >= 1, { na: r.na });

  // ---- 7. new law = not yet assessed ----
  r = await page.evaluate(() => { const n0 = DB.leg.length; openModal('m-leg'); const c0 = gv('leg-c'); g('leg-s').value = 'תקנות חדשות לבדיקה'; const u0 = gv('leg-c-date'), o0 = gv('leg-c-by'); svLeg(); const l = DB.leg[DB.leg.length - 1]; return { c0, u0, o0, saved: DB.leg.length === n0 + 1, c: l && l.c, u: l && l.c_date, o: l && l.c_by }; }).catch(e => ({ err: e.message }));
  await shot('7-leg');
  say('7 new law opens and saves as "טרם הוערך", no date, no assessor', r.c0 === 'טרם הוערך' && r.saved && r.c === 'טרם הוערך' && !r.u && !r.o, r);
  r = await page.evaluate(() => { goPage('dash'); rDash(); const t = g('pg-dash').textContent; const m = t.match(/טרם הוערך:\s*(\d+)/); return { line: m ? m[0] : null }; });
  await page.waitForTimeout(300); await shot('7-dash-compliance');
  say('7 dashboard compliance card: "⏳ טרם הוערך: N"', !!r.line, r);
  r = await page.evaluate(() => { const l = DB.leg[DB.leg.length - 1]; _svEditing = {}; _genEdit('leg', l.id); g('leg-c').value = 'מציית'; svLeg(); const l2 = DB.leg[DB.leg.length - 1]; return { u: l2.c_date, by: l2.c_by, today: new Date().toISOString().slice(0, 10) }; }).catch(e => ({ err: e.message }));
  say('7 switching to "מציית" fills today\'s date', r.u === r.today, r);
  await page.evaluate(() => closeModal('m-leg'));

  // ---- 8. incidents without investigation ----
  r = await page.evaluate(() => { goPage('inc'); rInc(); const t = g('pg-inc').textContent; const m = t.match(/2026 בלי חקירה:\s*(\d+)/); return { line: m ? m[0] : null }; });
  await page.waitForTimeout(300); await shot('8-inc');
  say('8 incidents card "2026 בלי חקירה: N" (3 seeded; 2 without severity, all without days)', !!r.line, r);

  // ---- Console errors ----
  say('no page errors during the walk', errs.length === 0, errs.slice(0, 5));
  await browser.close();
  const nf = res.filter(x => !x.ok).length; console.log('\n' + res.filter(x => x.ok).length + ' passed, ' + nf + ' failed'); process.exit(nf ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
