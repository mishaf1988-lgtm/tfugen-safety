// Trustees T3: the manager screen — month picker, summary pills, leaderboard
// with the document's tie-break, findings table + row menu (close / reopen /
// task / note / delete), CSV for the safety committee, Today-list item for
// unrouted hazards, modules-sheet entry, reporter kept out.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const M = new Date().toISOString().substring(0, 7), D = new Date().toISOString().substring(0, 10);
  const prev = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().substring(0, 7); })();

  console.log('\n1. admin opens the page: month, pills, leaderboard');
  const s1 = await page.evaluate(({ M, D, prev }) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','trustee_reports'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__upd = []; const ou = window.sbUpd; window.sbUpd = function (t, r) { window.__upd.push({ t, id: r.id, s: r.s, note: r.mgr_note }); return ou(t, r); };
    const r = (id, u, t, ok, s, extra) => Object.assign({ id, u, t, ok, s, d: D, m: M, loc: 'אולם טיגון', f: ok ? null : 'ממצא ' + id, ts: '2026-09-1' + (id.length % 10) + 'T08:00:00Z' }, extra || {});
    DB.trustee_reports = [
      // דנה: tasks 1,2,3,4,5 (5 tasks → eligible), 2 hazards: one open, one closed via an "after" report
      r('d1', 'דנה', 1, false, 'פתוח', { f: 'דלת חירום חסומה', photo_url: 'https://x/d1.jpg' }), r('d2', 'דנה', 2, true, 'תקין'), r('d3', 'דנה', 3, true, 'תקין'), r('d4', 'דנה', 4, true, 'תקין'),
      r('d5', 'דנה', 5, false, 'נסגר', { f: 'מטף ללא פלומבה' }), r('d8', 'דנה', 8, true, 'תקין', { ref: 'd5', photo_url: 'https://x/after.jpg' }),
      // יוסי: same 60 task points (6 tasks) but 0 closed → tie-break puts him below רון
      r('y1', 'יוסי', 1, true, 'תקין'), r('y2', 'יוסי', 2, true, 'תקין'), r('y3', 'יוסי', 3, true, 'תקין'), r('y4', 'יוסי', 4, true, 'תקין'), r('y5', 'יוסי', 5, true, 'תקין'), r('y6', 'יוסי', 6, false, 'פתוח', { f: 'מגן מכונה מנוטרל', mgr_note: 'הועבר לאחזקה' }),
      // רון: 5 tasks + 5 closed → 50 + 10 = 60 — ties יוסי on points, wins on hazards closed
      r('r1', 'רון', 1, false, 'נסגר'), r('r2', 'רון', 2, false, 'נסגר'), r('r3', 'רון', 3, false, 'נסגר'), r('r4', 'רון', 4, false, 'נסגר'), r('r5', 'רון', 5, false, 'נסגר'),
      // last month: must not show
      r('old1', 'דנה', 7, false, 'פתוח', { d: prev + '-20', m: prev, f: 'ישן' }),
    ];
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates();
    goPage('trustees');
    const pills = Array.from(document.querySelectorAll('#tru-mgr-summary button')).map(b => b.textContent.trim());
    const board = Array.from(document.querySelectorAll('#tru-mgr-board .tru-board-row')).map(x => ({ u: x.dataset.truU, total: x.lastElementChild.textContent.trim(), elig: /זכאי/.test(x.textContent), chips: Array.from(x.querySelectorAll('span[title]')).filter(c => /16a34a/.test(c.getAttribute('style'))).length }));
    return { cur: CUR, month: document.getElementById('tru-mgr-month').textContent, pills, board, rows: document.querySelectorAll('#tb-trustees tr[data-tru-row]').length };
  }, { M, D, prev });
  check('page opens on this month', s1.cur === 'trustees' && /2026/.test(s1.month), s1.month);
  check('pills: 2 open, 6 closed, 9 ok, 17 all (last month excluded)', s1.pills.join(' ') === 'פתוחים: 2 נסגרו: 6 תקינים: 9 הכל: 17', s1.pills);
  check('leaderboard: דנה 62 (eligible) · רון 60 · יוסי 60 — tie broken by hazards closed', s1.board.map(x => x.u + ':' + x.total).join(' ') === 'דנה:62 רון:60 יוסי:60' && s1.board[0].elig && s1.board[1].elig && s1.board[2].elig && s1.board[0].chips === 6, s1.board);
  check('default filter "open" lists the 2 open hazards', s1.rows === 2, s1.rows);

  console.log('\n2. findings table + filters');
  const t1 = await page.evaluate(() => {
    const rowsOf = () => Array.from(document.querySelectorAll('#tb-trustees tr[data-tru-row]')).map(tr => tr.dataset.truRow);
    const out = { open: rowsOf() };
    const d1 = document.querySelector('#tb-trustees tr[data-tru-row="d1"]'); out.d1 = d1 ? { txt: d1.textContent.replace(/\s+/g, ' '), photo: !!d1.querySelector('a[href*="d1.jpg"], a[data-sign*="d1.jpg"]'), menu: !!d1.querySelector('[onclick^="_truRowMenu("]'), badge: d1.querySelector('.b').textContent } : null;
    const y6 = document.querySelector('#tb-trustees tr[data-tru-row="y6"]'); out.y6note = y6 && /הועבר לאחזקה/.test(y6.textContent);
    _truMgrSetFilter('closed'); out.closed = rowsOf();
    const d5 = document.querySelector('#tb-trustees tr[data-tru-row="d5"]'); out.d5after = d5 && /תמונת "אחרי"/.test(d5.textContent);
    _truMgrSetFilter('ok'); out.ok = rowsOf().length;
    const d8 = document.querySelector('#tb-trustees tr[data-tru-row="d8"]'); out.d8ref = d8 && /סוגר ממצא: מטף/.test(d8.textContent);
    _truMgrSetFilter('all'); out.all = rowsOf().length;
    _truMgrSetFilter('open');
    return out;
  });
  check('open rows are d1 + y6 with trustee, task, area, finding, photo link, פתוח badge and a ⋯ menu', t1.open.sort().join() === 'd1,y6' && t1.d1 && /דנה/.test(t1.d1.txt) && /1\. סיור מפגעים/.test(t1.d1.txt) && /אולם טיגון/.test(t1.d1.txt) && /דלת חירום חסומה/.test(t1.d1.txt) && t1.d1.menu && t1.d1.badge === 'פתוח', t1.d1);
  check('routing note shown on y6; closed filter shows the 6 closed with the "after" photo line on d5; ok 9; all 17; d8 names the finding it closes', t1.y6note && t1.closed.length === 6 && t1.d5after && t1.ok === 9 && t1.all === 17 && t1.d8ref, { y6: t1.y6note, closed: t1.closed.length, d5: t1.d5after, ok: t1.ok, all: t1.all, d8: t1.d8ref });

  console.log('\n3. row menu: close → reopen → note → task');
  const m1 = await page.evaluate(() => {
    const btn = document.querySelector('#tb-trustees tr[data-tru-row="d1"] [onclick^="_truRowMenu("]'); btn.click();
    const menu = document.getElementById('tru-row-menu');
    const items = Array.from(menu.querySelectorAll('button')).map(b => b.textContent.trim());
    Array.from(menu.querySelectorAll('button')).find(b => /סמן נסגר/.test(b.textContent)).click();
    const r = DB.trustee_reports.find(x => x.id === 'd1');
    return { items, s: r.s, upd: window.__upd.slice(-1)[0], toast: window.__toasts.slice(-1)[0], menuGone: !document.getElementById('tru-row-menu'), openRows: document.querySelectorAll('#tb-trustees tr[data-tru-row]').length, pills: Array.from(document.querySelectorAll('#tru-mgr-summary button')).map(b => b.textContent.trim()).slice(0, 2).join(' '), board: Array.from(document.querySelectorAll('#tru-mgr-board .tru-board-row')).map(x => x.dataset.truU + ':' + x.lastElementChild.textContent.trim()).join(' ') };
  });
  check('menu offers: סמן נסגר · צור משימה · הערת ניתוב · מחק', /סמן נסגר/.test(m1.items[0]) && /צור משימה/.test(m1.items[1]) && /הערת ניתוב/.test(m1.items[2]) && /מחק/.test(m1.items[3]), m1.items);
  check('close: s=נסגר, sbUpd once, toast, list/pills/board re-rendered (דנה 64)', m1.s === 'נסגר' && m1.upd.id === 'd1' && m1.upd.s === 'נסגר' && /נסגר/.test(m1.toast) && m1.menuGone && m1.openRows === 1 && m1.pills === 'פתוחים: 1 נסגרו: 7' && /דנה:64/.test(m1.board), m1);
  const m2 = await page.evaluate(() => {
    _truMgrSetFilter('closed');
    document.querySelector('#tb-trustees tr[data-tru-row="d1"] [onclick^="_truRowMenu("]').click();
    const items = Array.from(document.querySelectorAll('#tru-row-menu button')).map(b => b.textContent.trim());
    Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /פתח מחדש/.test(b.textContent)).click();
    _truMgrSetFilter('open');
    document.querySelector('#tb-trustees tr[data-tru-row="d1"] [onclick^="_truRowMenu("]').click();
    Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /הערת ניתוב/.test(b.textContent)).click();
    const ta = document.getElementById('tru-note-ta'); const inline = !!ta && !!ta.closest('tr[data-tru-row="d1"]');
    if (ta) { ta.value = 'הועבר למנהל הייצור'; } _truMgrNoteSave('d1');
    const r = DB.trustee_reports.find(x => x.id === 'd1');
    return { items, inline, s: r.s, note: r.mgr_note, upd: window.__upd.length, shown: /הועבר למנהל הייצור/.test(document.querySelector('#tb-trustees tr[data-tru-row="d1"]').textContent) };
  });
  check('closed row offers פתח מחדש; reopen → פתוח; routing note edited INLINE in the row (no prompt), saved (sbUpd) and shown', /פתח מחדש/.test(m2.items[0]) && m2.inline && m2.s === 'פתוח' && m2.note === 'הועבר למנהל הייצור' && m2.upd === 3 && m2.shown, m2);
  const m3 = await page.evaluate(() => {
    document.querySelector('#tb-trustees tr[data-tru-row="d1"] [onclick^="_truRowMenu("]').click();
    Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /צור משימה/.test(b.textContent)).click();
    const open = document.getElementById('m-tsk').style.display === 'block';
    const out = { open, title: document.getElementById('tsk-title').value, src: document.getElementById('tsk-src-view').textContent, notes: document.getElementById('tsk-notes').value, srcTbl: document.getElementById('tsk-src-tbl').value, srcId: document.getElementById('tsk-src-id').value, due: document.getElementById('tsk-due').value };
    svTsk();
    const tsk = DB.tasks.find(t => t.source_table === 'trustee_reports' && t.source_id === 'd1');
    out.saved = !!tsk; out.link = /📝 משימה:/.test(document.querySelector('#tb-trustees tr[data-tru-row="d1"]').textContent);
    document.querySelector('#tb-trustees tr[data-tru-row="d1"] [onclick^="_truRowMenu("]').click();
    out.items2 = Array.from(document.querySelectorAll('#tru-row-menu button')).map(b => b.textContent.trim()); document.body.click();
    return out;
  });
  check('צור משימה: task modal prefilled (title with area + finding, source label נאמן בטיחות, notes with reporter/date/photo, due 30 days from the report, assignee = the trustee)', m3.open && /נאמן בטיחות — אולם טיגון: דלת חירום חסומה/.test(m3.title) && /נאמן בטיחות/.test(m3.src) && /דווח ע"י דנה/.test(m3.notes) && /d1\.jpg/.test(m3.notes) && m3.srcTbl === 'trustee_reports' && m3.srcId === 'd1'
    // #609: the due date used to be blanked after openTskModal derived it,
    // so the manager opened the date wheel for a value the code knew.
    && /^\d{4}-\d{2}-\d{2}$/.test(m3.due) && m3.due === (function(){var d=new Date(D);d.setDate(d.getDate()+30);return d.toISOString().substring(0,10);})(), m3);
  check('saved task links back on the row; the menu now says "פתח את המשימה"', m3.saved && m3.link && m3.items2.some(x => /פתח את המשימה/.test(x)), { saved: m3.saved, link: m3.link, items: m3.items2 });

  console.log('\n4. CSV for the committee, month picker, header ⋯ menu');
  const c1 = await page.evaluate(async () => {
    window.__blob = null; URL.createObjectURL = (b) => { window.__blob = b; return 'blob:x'; }; URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () { window.__dl = this.download; };
    _truExportCsv();
    // Blob.text() strips a leading BOM by spec — check the raw bytes instead.
    const bytes = new Uint8Array(await new Response(window.__blob).arrayBuffer());
    const txt = new TextDecoder('utf-8').decode(bytes);
    const lines = txt.split('\r\n');
    return { dl: window.__dl, bom: bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF, head: lines[0], boardHdr: lines[1], boardRows: lines.slice(2, 5), blank: lines[5] === '', repHdr: lines[6], nRep: lines.length - 7, toast: window.__toasts.slice(-1)[0] };
  });
  check('CSV: BOM, file name with the month, leaderboard block (3 rows) then a blank line then 17 report rows', c1.bom && c1.dl === 'tapugan-trustees-' + M + '.csv' && /לוח ניקוד/.test(c1.head) && /"נאמן","משימות/.test(c1.boardHdr) && c1.boardRows.length === 3 && /"דנה","6","60","1","2","62","כן"/.test(c1.boardRows[0]) && c1.blank && /"נאמן","משימה","שם המשימה"/.test(c1.repHdr) && c1.nRep === 17, c1);
  const mo = await page.evaluate(() => { _truMgrShift(-1); const a = { month: document.getElementById('tru-mgr-month').textContent, rows: document.querySelectorAll('#tb-trustees tr[data-tru-row]').length, all: Array.from(document.querySelectorAll('#tru-mgr-summary button')).slice(-1)[0].textContent.trim() }; _truExportCsv(); a.toastPrev = window.__toasts.slice(-1)[0]; _truMgrShift(0); a.back = document.getElementById('tru-mgr-month').textContent; return a; });
  check('previous month: 1 row (old1 open), all: 1; CSV still exports; "החודש" returns', mo.rows === 1 && mo.all === 'הכל: 1' && /יוצא/.test(mo.toastPrev) && /2026/.test(mo.back) && mo.month !== mo.back, mo);
  const hm = await page.evaluate(() => { document.getElementById('tru-mgr-more-btn').click(); const items = Array.from(document.querySelectorAll('#tru-mgr-menu button')).map(b => b.textContent.trim()); document.body.click(); return items; });
  check('header ⋯: roster · trustee link · task catalogue · winner · CSV export · print · open the trustee screen', hm.length === 7 && /רשימת הנאמנים/.test(hm[0]) && /קישור לנאמנים/.test(hm[1]) && /קטלוג המשימות/.test(hm[2]) && /זוכה החודש/.test(hm[3]) && /CSV/.test(hm[4]) && /הדפס/.test(hm[5]) && /מסך הנאמן/.test(hm[6]), hm);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/trustees-mgr-375.png', fullPage: true });

  console.log('\n5. Today list + modules sheet + reporter gate');
  const td = await page.evaluate(() => {
    goPage('dash'); rDash();
    const items = Array.from(document.querySelectorAll('#today-items .today-item')).map(x => x.querySelector('.ti-title').textContent);
    const tru = items.find(t => /נאמני בטיחות/.test(t));
    const await0 = _truAwaitingRouting().map(r => r.id);
    return { tru, await0, sheet: !!document.querySelector('#m-modules-sheet [onclick*="\'trustees\'"]') };
  });
  check('Today: one line for hazards awaiting routing — only old1 (d1 has a task+note, y6 has a note)', /1 ממצאי נאמני בטיחות ממתינים לניתוב/.test(td.tru || '') && td.await0.join() === 'old1' && td.sheet, td);
  const tc = await page.evaluate(() => { const it = Array.from(document.querySelectorAll('#today-items .today-item')).find(x => /נאמני בטיחות/.test(x.textContent)); it.click(); return CUR; });
  check('clicking it opens the trustees page', tc === 'trustees', tc);

  console.log('\n6. Phase 2: announce the winner, history, "who has not won yet" tie-break');
  const w1 = await page.evaluate(() => {
    DB.trustee_winners = [];
    goPage('trustees'); _truMgrShift(0); rTrustees();
    window.__ins = []; const oi = window.sbIns; window.sbIns = function (t, r) { window.__ins.push({ t, r }); return oi(t, r); };
    const btn = document.querySelector('#tru-mgr-board button[onclick*="_truWinnerOpen"]');
    const label = btn ? btn.textContent.trim() : null;
    if (btn) btn.click();
    const sel = document.getElementById('tru-win-u');
    return { label, month: document.getElementById('tru-win-month').textContent, opts: Array.from(sel.options).map(o => o.textContent.trim()), picked: sel.value, hint: document.getElementById('tru-win-hint').textContent, hist: document.getElementById('tru-win-hist').textContent };
  });
  check('no winner yet: board offers "הכרז זוכה"; modal opens on the shown month with the eligible leader preselected', /הכרז זוכה/.test(w1.label || '') && /2026/.test(w1.month) && w1.picked === 'דנה' && w1.opts.length === 3 && /62/.test(w1.opts[0]) && /3 נאמנים זכאים/.test(w1.hint) && /לא הוכרז אף זוכה/.test(w1.hist), w1);

  const w2 = await page.evaluate(() => {
    document.getElementById('tru-win-note').value = 'סגרה מפגע אחד';
    _truWinnerSave();
    const strip = document.getElementById('tru-mgr-winner');
    return { n: DB.trustee_winners.length, row: DB.trustee_winners[0], ins: window.__ins.filter(x => x.t === 'trustee_winners').length, strip: strip ? strip.textContent.replace(/\s+/g, ' ').trim() : null, toast: window.__toasts.slice(-1)[0], hist: document.getElementById('tru-win-hist').textContent.replace(/\s+/g, ' ').trim() };
  });
  check('announce: one row id win_<month>, score frozen at 62, sent to Supabase, strip + history show it', w2.n === 1 && w2.row.id === 'win_' + M && w2.row.u === 'דנה' && w2.row.pts === 62 && w2.row.note === 'סגרה מפגע אחד' && w2.ins === 1 && /זוכה החודש: דנה/.test(w2.strip || '') && /62/.test(w2.strip || '') && /דנה/.test(w2.hist), w2);

  const w3 = await page.evaluate(() => {
    window.__wupd = []; const ou = window.sbUpd; window.sbUpd = function (t, r) { if (t === 'trustee_winners') window.__wupd.push(r.u); return ou(t, r); };
    _truWinnerOpen();
    document.getElementById('tru-win-u').value = 'רון';
    _truWinnerSave();
    return { n: DB.trustee_winners.length, u: DB.trustee_winners[0].u, pts: DB.trustee_winners[0].pts, upd: window.__wupd, hint: document.getElementById('tru-win-hint').textContent };
  });
  check('re-announcing the same month updates that one row (no second winner) and re-freezes the score', w3.n === 1 && w3.u === 'רון' && w3.pts === 60 && w3.upd.join() === 'רון' && /כבר הוכרז/.test(w3.hint), w3);

  const w4 = await page.evaluate(({ M, D, prev }) => {
    // Strip רון's closures so he ties יוסי on points AND on hazards closed:
    // the only thing left to separate them is who has already won.
    DB.trustee_reports = DB.trustee_reports.filter(r => !/^r[1-5]$/.test(r.id))
      .concat([1, 2, 3, 4, 5, 6].map(t => ({ id: 'n' + t, u: 'רון', t, ok: true, s: 'תקין', d: D, m: M })));
    DB.trustee_winners = [{ id: 'win_' + prev, m: prev, u: 'רון', pts: 70, note: null, ts: '2026-08-01T00:00:00Z' }];
    rTrustees();
    return { board: _truBoard(M).map(x => x.u + ':' + x.total + ':' + x.closed + ':' + x.wins), names: Array.from(document.querySelectorAll('#tru-mgr-board .tru-board-row')).map(r => r.getAttribute('data-tru-u')), txt: document.getElementById('tru-mgr-board').textContent };
  }, { M, D, prev });
  check('tie on points AND on closures: whoever has not won yet ranks first, and the board shows "טרם זכה"', w4.board[1] === 'יוסי:60:0:0' && w4.board[2] === 'רון:60:0:1' && w4.names.indexOf('יוסי') < w4.names.indexOf('רון') && /טרם זכה/.test(w4.txt), w4);

  const w5 = await page.evaluate(({ prev }) => {
    DB.trustee_winners = [{ id: 'win_' + prev, m: prev, u: 'רון', pts: 70, note: 'סגר 9 מפגעים', ts: '2026-08-01T00:00:00Z' }];
    _truSetMe('רון'); _truRender();
    const b = document.getElementById('tru-winner'), body = document.getElementById('tru-body');
    return { txt: b ? b.textContent.replace(/\s+/g, ' ').trim() : null, beforeLead: b && document.getElementById('tru-lead') ? (Array.prototype.indexOf.call(body.children, b) < Array.prototype.indexOf.call(body.children, document.getElementById('tru-lead'))) : false };
  }, { prev });
  check('trustee screen: banner for the announced winner, above "מי מוביל החודש"', /זוכה/.test(w5.txt || '') && /רון/.test(w5.txt || '') && /70 נק/.test(w5.txt || '') && /כל הכבוד/.test(w5.txt || '') && /סגר 9 מפגעים/.test(w5.txt || '') && w5.beforeLead, w5);

  const rep = await page.evaluate(() => { window._currentUser = null; _applyRoleGates(); goPage('trustees'); const cur = CUR; rDash(); const tru = Array.from(document.querySelectorAll('#today-items .today-item')).some(x => /נאמני בטיחות/.test(x.textContent)); const sheetBtn = document.querySelector('#m-modules-sheet [onclick*="\'trustees\'"]'); return { cur, tru, hidden: sheetBtn && getComputedStyle(sheetBtn).display === 'none' }; });
  check('reporter: kicked to the dashboard, no Today line, sheet entry hidden', rep.cur === 'dash' && !rep.tru && rep.hidden, rep);


  console.log('\n7. Quick win 2026-09-19: «הכרז זוכה» only when someone is eligible');
  const el = await page.evaluate(({ prev }) => {
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates(); goPage('trustees');
    DB.trustee_winners = [];
    _truMgrShift(-1); rTrustees();                      // previous month: דנה has 1 task → nobody eligible
    const b = document.getElementById('tru-mgr-board');
    const out = { prevBtn: !!b.querySelector('button[onclick*="_truWinnerOpen"]'), prevHint: /אין עדיין זכאים/.test(b.textContent), prevRows: b.querySelectorAll('.tru-board-row').length };
    _truMgrShift(0); rTrustees();                       // this month: 3 eligible → button back
    out.nowBtn = !!document.getElementById('tru-mgr-board').querySelector('button[onclick*="_truWinnerOpen"]');
    return out;
  }, { prev });
  check('month with reports but no eligible trustee: no «הכרז זוכה» button, grey «אין עדיין זכאים» line instead', !el.prevBtn && el.prevHint && el.prevRows >= 1, el);
  check('month with eligible trustees: the button is offered again', el.nowBtn === true, el);

  console.log('\n8. Compact findings card (2026-09-19)');
  const cc = await page.evaluate(() => {
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates(); goPage('trustees'); _truMgrShift(0); _truMgrSetFilter('all');
    const tr = document.querySelector('#tb-trustees tr[data-tru-row="d1"]');
    const head = tr && tr.querySelector('td.tru-head');
    return { tds: tr ? tr.querySelectorAll('td').length : 0, head: head ? head.textContent.replace(/\s+/g, ' ').trim() : null, ths: document.querySelectorAll('#tb-trustees').length ? document.querySelector('#tb-trustees').closest('table').querySelectorAll('th').length : 0 };
  });
  check('finding row is 5 cells: one head line «נאמן · N. משימה · תאריך» + אזור, ממצא, סטטוס, ⋯', cc.tds === 5 && cc.ths === 5 && /דנה/.test(cc.head || '') && /1\. /.test(cc.head || '') && /\d{2}\/\d{2}\/\d{4}/.test(cc.head || ''), cc);

  console.log('\n9. Mid-month nudge: trustees still short of the threshold (2026-09-19)');
  const nd = await page.evaluate(() => {
    const M = new Date().toISOString().substring(0, 7), D = new Date().toISOString().substring(0, 10);
    // דנה / יוסי / רון already have 5+ tasks from the seed; לב has none;
    // גלינה 2, טטינה 1; עזב is inactive and must never be counted or named.
    DB.trustees = ['דנה', 'יוסי', 'רון', 'לב', 'גלינה', 'טטינה'].map((n, i) => ({ id: 'n' + i, n, active: true }))
      .concat([{ id: 'nx', n: 'עזב', active: false }]);
    [['g1', 'גלינה', 1], ['g2', 'גלינה', 2], ['t1', 'טטינה', 1], ['z1', 'עזב', 1]].forEach((x) => {
      DB.trustee_reports.push({ id: 'nd_' + x[0], u: x[1], t: x[2], ok: true, s: 'תקין', d: D, m: M, loc: 'x', ts: D + 'T09:00:00Z' });
    });
    const out = { behind: _truBehind().map(s => s.u + ':' + s.nTasks), left: _truDaysLeft(), window: TRUSTEE_NUDGE_DAYS };
    window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash'); rDash();
    const find = () => Array.from(document.querySelectorAll('#today-items .today-item')).find(x => /טרם השל/.test(x.textContent));
    const line = find();
    out.title = line ? line.querySelector('.ti-title').textContent : null;
    out.sub = line ? line.querySelector('.ti-sub').textContent : null;
    out.badge = line ? line.querySelector('.ti-badge').textContent : null;
    // a fourth trustee behind → the sub truncates to three names + "ועוד N"
    DB.trustees.push({ id: 'n9', n: 'מוסא', active: true }); rDash();
    out.sub4 = find() ? find().querySelector('.ti-sub').textContent : null;
    out.title4 = find() ? find().querySelector('.ti-title').textContent : null;
    // everyone on track → the line disappears, like every other empty panel
    DB.trustees = ['דנה', 'יוסי', 'רון'].map((n, i) => ({ id: 'ok' + i, n, active: true })); rDash();
    out.onTrack = !find();
    // outside the mid-month window → hidden even when someone is behind
    DB.trustees.push({ id: 'nb', n: 'לב', active: true }); rDash(); out.inWindow = !!find();
    TRUSTEE_NUDGE_DAYS = -1; rDash(); out.outOfWindow = !find(); TRUSTEE_NUDGE_DAYS = out.window; rDash();
    return out;
  });
  check('helper: active trustees under 5 tasks, most behind first (לב 0 · טטינה 1 · גלינה 2); the inactive one is excluded', nd.behind.join(' ') === 'לב:0 טטינה:1 גלינה:2', nd.behind);
  check('home line: counts them, names each with its task count, and says how long is left', /3 נאמנים טרם השלימו 5 משימות/.test(nd.title || '') && /לב \(0\/8\)/.test(nd.sub || '') && /טטינה \(1\/8\)/.test(nd.sub || '') && /גלינה \(2\/8\)/.test(nd.sub || '') && (nd.left === 0 ? /היום האחרון/.test(nd.sub) : new RegExp('נותרו ' + nd.left + ' ימים').test(nd.sub || '')) && nd.badge === (nd.left === 0 ? 'היום' : nd.left + 'י'), nd);
  check('a fourth one behind: three names then «ועוד 1», title follows the count', /4 נאמנים טרם השלימו/.test(nd.title4 || '') && /ועוד 1/.test(nd.sub4 || '') && (nd.sub4.match(/\(\d\/8\)/g) || []).length === 3, { title4: nd.title4, sub4: nd.sub4 });
  check('hidden when everyone is on track, shown again when one falls behind, hidden outside the mid-month window', nd.onTrack && nd.inWindow && nd.outOfWindow, nd);
  const ndClick = await page.evaluate(() => { const it = Array.from(document.querySelectorAll('#today-items .today-item')).find(x => /טרם השל/.test(x.textContent)); it.click(); return CUR; });
  check('clicking the line opens the trustees page', ndClick === 'trustees', ndClick);
  const ndRep = await page.evaluate(() => { window._currentUser = null; _applyRoleGates(); goPage('dash'); rDash(); return Array.from(document.querySelectorAll('#today-items .today-item')).some(x => /טרם השל/.test(x.textContent)); });
  check('a reporter never sees it', ndRep === false, ndRep);

  console.log('\n10. Hazards reported, routed, and still not fixed (2026-09-19)');
  const st = await page.evaluate(() => {
    const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
    const M = new Date().toISOString().substring(0, 7);
    DB.trustees = []; DB.trustee_reports = DB.trustee_reports.filter((r) => !/^(nd_|st_)/.test(r.id));
    // two long-open hazards (45 and 60 days), one young (3), one closed at 90,
    // one תקין at 90 — only the first two may ever count as stale.
    [['st_a', 60, false, 'פתוח', 'מחסן · הידרנט', 'ללא פלומבה'], ['st_b', 45, false, 'פתוח', 'אולם טיגון', 'דלת חסומה'],
     ['st_c', 3, false, 'פתוח', 'מעבדה', 'טרי'], ['st_d', 90, false, 'נסגר', 'ישן', 'תוקן'],
     ['st_e', 90, true, 'תקין', 'מעוצבים', null]].forEach((x) => {
      DB.trustee_reports.push({ id: x[0], u: 'דנה', t: 5, ok: x[2], s: x[3], loc: x[4], f: x[5], d: ago(x[1]).substring(0, 10), m: M, ts: ago(x[1]) });
    });
    const out = { stale: _truStale().map((r) => r.id), ages: _truStale().map((r) => _truAgeDays(r)), none: _truStale(365).length, limit: TRUSTEE_STALE_DAYS };
    window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash'); rDash();
    const line = Array.from(document.querySelectorAll('#today-items .today-item')).find(x => /פתוח.* מעל |פתוחים מעל /.test(x.textContent));
    out.title = line ? line.querySelector('.ti-title').textContent : null;
    out.sub = line ? line.querySelector('.ti-sub').textContent : null;
    out.badge = line ? line.querySelector('.ti-badge').textContent : null;
    out.cls = line ? line.querySelector('.ti-badge').className : null;
    return out;
  });
  check('helper: only open hazards past the limit, oldest first (60 then 45); young, closed and תקין rows never count', st.stale.join() === 'st_a,st_b' && st.ages.join() === '60,45' && st.none === 0, st);
  check('home line: counts them, names the oldest with its age, red badge', new RegExp('2 ליקויי נאמנים פתוחים מעל ' + st.limit + ' יום').test(st.title || '') && /מחסן · הידרנט/.test(st.sub || '') && /ללא פלומבה/.test(st.sub || '') && /\(60 יום\)/.test(st.sub || '') && st.badge === '60י' && /red/.test(st.cls || ''), st);
  const st1 = await page.evaluate(() => {
    DB.trustee_reports = DB.trustee_reports.filter((r) => r.id !== 'st_a'); rDash();
    const line = Array.from(document.querySelectorAll('#today-items .today-item')).find(x => /פתוח.* מעל /.test(x.textContent));
    const one = line ? line.querySelector('.ti-title').textContent : null;
    DB.trustee_reports = DB.trustee_reports.filter((r) => !/^st_/.test(r.id)); rDash();
    const gone = !Array.from(document.querySelectorAll('#today-items .today-item')).some(x => /פתוח.* מעל |פתוחים מעל /.test(x.textContent));
    return { one, gone };
  });
  check('one left reads in the singular; none left hides the line', /^ליקוי נאמן פתוח מעל /.test(st1.one || '') && st1.gone, st1);
  const ch = await page.evaluate(() => {
    const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
    const M = new Date().toISOString().substring(0, 7);
    [['ag_old', 40, false, 'פתוח'], ['ag_new', 5, false, 'פתוח'], ['ag_cl', 40, false, 'נסגר'], ['ag_ok', 40, true, 'תקין']].forEach((x) => {
      DB.trustee_reports.push({ id: x[0], u: 'דנה', t: 5, ok: x[2], s: x[3], loc: 'x', f: 'y', d: ago(x[1]).substring(0, 10), m: M, ts: ago(x[1]) });
    });
    goPage('trustees'); _truMgrShift(0); _truMgrSetFilter('all'); rTrustees();
    const cell = (id) => { const tr = document.querySelector('#tb-trustees tr[data-tru-row="' + id + '"]'); return tr ? tr.querySelector('[data-tru-age]') : null; };
    const old = cell('ag_old'), fresh = cell('ag_new');
    return { oldTxt: old && old.textContent, oldRed: old && /bR/.test(old.className), newTxt: fresh && fresh.textContent, newRed: fresh && /bR/.test(fresh.className), closed: !cell('ag_cl'), ok: !cell('ag_ok'), status: document.querySelector('#tb-trustees tr[data-tru-row="ag_old"] .b').textContent };
  });
  check('findings row: age chip on open hazards — red past the limit, grey while young, none on closed or תקין rows', ch.oldTxt === '40 ימים' && ch.oldRed && ch.newTxt === '5 ימים' && !ch.newRed && ch.closed && ch.ok, ch);
  check('the status badge itself is unchanged — the chip sits beside it', ch.status === 'פתוח', ch.status);
  const stRep = await page.evaluate(() => { window._currentUser = null; _applyRoleGates(); goPage('dash'); rDash(); return Array.from(document.querySelectorAll('#today-items .today-item')).some(x => /פתוח.* מעל |פתוחים מעל /.test(x.textContent)); });
  check('a reporter never sees the stale line', stRep === false, stRep);

  console.log('\n11. Area coverage — which parts of the plant were toured (2026-09-19)');
  const cv = await page.evaluate(async () => {
    const M = new Date().toISOString().substring(0, 7), D = new Date().toISOString().substring(0, 10);
    DB.trustee_reports = DB.trustee_reports.filter((r) => !/^(ag_|st_|nd_)/.test(r.id));
    // מוסא and יוני share "חומר גלם" — either one covers it. רנט has no reports.
    // עזב is inactive; "בלי" has no area at all and falls into the catch-all.
    DB.trustees = [
      { id: 'c1', n: 'דנה', dep: 'ייצור ואריזה', active: true }, { id: 'c2', n: 'מוסא', dep: 'חומר גלם', active: true },
      { id: 'c3', n: 'יוני', dep: 'חומר גלם', active: true }, { id: 'c4', n: 'רנט', dep: 'מט"ש וסביבה', active: true },
      { id: 'c5', n: 'בלי', active: true }, { id: 'c6', n: 'עזב', dep: 'אזור נטוש', active: false },
    ];
    [['cv1', 'יוני'], ['cv2', 'עזב']].forEach((x) => {
      DB.trustee_reports.push({ id: x[0], u: x[1], t: 5, ok: true, s: 'תקין', loc: 'x', d: D, m: M, ts: D + 'T09:00:00Z' });
    });
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates();
    goPage('trustees'); _truMgrShift(0); rTrustees();
    const out = {
      areas: _truAreas(), areaOf: [_truAreaOf('מוסא'), _truAreaOf('בלי'), _truAreaOf('לא קיים')],
      cov: _truCoverage().map((c) => c.area + ':' + c.reports + ':' + c.trustees.join('+')),
      chips: Array.from(document.querySelectorAll('#tru-mgr-cov [data-tru-area]')).map((x) => ({ a: x.dataset.truArea, on: /bG/.test(x.className), txt: x.textContent.trim(), tip: x.title })),
      summary: (document.getElementById('tru-mgr-cov').textContent.match(/\d+ מתוך \d+/) || [])[0],
      cardShown: getComputedStyle(document.getElementById('tru-mgr-cov-card')).display !== 'none',
    };
    // CSV gains a coverage block; with no areas on the roster it is left out entirely
    window.__blob = null; URL.createObjectURL = (b) => { window.__blob = b; return 'blob:x'; }; URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    _truExportCsv();
    out.csv = await window.__blob.text();
    DB.trustees = []; rTrustees();
    out.cardHidden = getComputedStyle(document.getElementById('tru-mgr-cov-card')).display === 'none';
    _truExportCsv(); out.csvNoRoster = await window.__blob.text();
    return out;
  });
  check('helpers: the area set skips the one with none and the inactive trustee; _truAreaOf resolves a name and returns empty for unknown', cv.areas.join() === 'חומר גלם,ייצור ואריזה,מט"ש וסביבה' && cv.areaOf[0] === 'חומר גלם' && cv.areaOf[1] === '' && cv.areaOf[2] === '', cv);
  check('coverage groups by area, sorted in Hebrew: shared "חומר גלם" counts יוני\'s report for both its trustees, דנה\'s six from the seed cover hers, unreported areas sit at 0, and the trustee with no area falls into a catch-all', cv.cov.join(' | ') === 'חומר גלם:1:יוני+מוסא | ייצור ואריזה:6:דנה | ללא אזור:0:בלי | מט"ש וסביבה:0:רנט', cv.cov);
  check('card: ✓ chips with counts for the two covered areas, ✗ for the two that were not toured, trustees in the tooltip, "2 מתוך 4" summary', cv.chips.length === 4 && cv.chips.filter(c => c.on).map(c => c.a).join() === 'חומר גלם,ייצור ואריזה' && /✓ חומר גלם \(1\)/.test(cv.chips[0].txt) && cv.chips[0].tip === 'יוני, מוסא' && /^✗ ללא אזור$/.test(cv.chips[2].txt) && cv.summary === '2 מתוך 4' && cv.cardShown, cv.chips);
  check('CSV carries the coverage block with a כן/לא column, escapes the quote inside מט"ש, and still ends with the reports block', /"כיסוי אזורים"/.test(cv.csv) && /"חומר גלם","יוני \/ מוסא","1","כן"/.test(cv.csv) && /"ללא אזור","בלי","0","לא"/.test(cv.csv) && /"מט""ש וסביבה","רנט","0","לא"/.test(cv.csv) && /"נאמן","משימה","שם המשימה"/.test(cv.csv), (cv.csv || '').split('\r\n').slice(10, 17));
  check('a roster with no areas: the card hides and the CSV goes back to exactly what it was', cv.cardHidden && !/כיסוי אזורים/.test(cv.csvNoRoster), { hidden: cv.cardHidden });

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
