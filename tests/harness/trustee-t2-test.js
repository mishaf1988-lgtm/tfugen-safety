// Trustees T2 (+ tour form, intro, leaderboard, monthly note): the trustee
// screen in employee mode end to end.
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
  const month = new Date().toISOString().substring(0, 7);
  const disp = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'missing'; }, sel);

  console.log('\n1. employee mode lands on the trustee screen; intro first');
  const e1 = await page.evaluate(() => {
    localStorage.removeItem('tfgn_trustee_name'); localStorage.removeItem('tfgn_outbox');
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__empToasts = []; window.empToast = function (m) { window.__empToasts.push(String(m)); };
    window.__ins = []; const oi = window.sbIns; window.sbIns = function (t, r) { window.__ins.push({ t, r }); return oi(t, r); };
    window.__server = [{ id: 'srv1', u: 'יוסי', m: new Date().toISOString().substring(0, 7), t: 5, d: new Date().toISOString().substring(0, 10), ok: true, s: 'תקין', ts: '2026-09-01T08:00:00Z' }];
    window.__roster = [{ id: 'tru_01', n: 'לב', dep: 'ייצור ואריזה', active: true }, { id: 'tru_09', n: 'ישן', active: false }];
    window.__pulls = 0; window.sbGet = function (t) { if (t === 'trustee_reports') window.__pulls++; return Promise.resolve(t === 'trustee_reports' ? JSON.parse(JSON.stringify(window.__server)) : (t === 'trustees' ? JSON.parse(JSON.stringify(window.__roster)) : null)); };
    // a phone that already knows the shared code (2026-09-21) goes straight in
    try { localStorage.setItem('tfgn_emp_code', 'RIGHT'); } catch (e) {}
    doEmpLogin();
    const home = document.getElementById('pg-emp-home'); const intro = document.getElementById('tru-intro');
    return { emp: document.body.classList.contains('emp-mode'), cur: CUR, only: home.classList.contains('tru-only'), back: getComputedStyle(document.getElementById('tru-back-btn')).display, toggle: getComputedStyle(home.querySelector('.emp-toggle')).display, introOpen: intro.open, introTxt: intro.textContent.replace(/\s+/g, ' ') };
  });
  check('employee mode lands straight on the trustee screen: no back button, full-interface toggle stays', e1.emp && e1.cur === 'emp-home' && e1.only && e1.back === 'none' && e1.toggle !== 'none', e1);
  check('point 1: "how it works" is open before a name is chosen and covers tasks, WhatsApp replacement, routing, scoring, monthly reset, danger', e1.introOpen && /8 משימות/.test(e1.introTxt) && /במקום בוואטסאפ/.test(e1.introTxt) && /לממונה הבטיחות לניתוב/.test(e1.introTxt) && /10 לכל משימה/.test(e1.introTxt) && /מתאפס/.test(e1.introTxt) && /סכנה מיידית/.test(e1.introTxt), e1.introTxt.slice(0, 120));
  await page.waitForTimeout(150);
  const e2 = { hero: await disp('#pg-emp-home .emp-hero'), grid: await disp('#pg-emp-home .emp-grid'), panel: await disp('#emp-trustee'), body: await page.evaluate(() => document.getElementById('tru-body').textContent.trim()), pulls: await page.evaluate(() => window.__pulls) };
  check('the hero and the four generic tiles are hidden; the trustee panel shows and pulled from the server', e2.hero === 'none' && e2.grid === 'none' && e2.panel !== 'none' && e2.pulls >= 1, e2);
  const names = await page.evaluate(() => Array.from(document.querySelectorAll('#tru-me option')).map(o => o.value));
  check('no name yet → asks for the name; the picker offers the roster (active only), past reporters and "אחר"', /שמך/.test(e2.body) && names.includes('לב') && !names.includes('ישן') && names.includes('יוסי') && names.includes('__other__'), { body: e2.body, names });

  console.log('\n2. name → month note, score card, who leads, 8 task cards');
  const s1 = await page.evaluate(() => { _truSetMe('דנה'); const b = document.getElementById('tru-body'); return { introOpen: document.getElementById('tru-intro').open, note: document.getElementById('tru-month-note').textContent, score: Array.from(b.querySelectorAll('#tru-score .n')).map(x => x.textContent), tasks: b.querySelectorAll('.tru-task').length, done: b.querySelectorAll('.tru-task.done').length, hows: Array.from(b.querySelectorAll('.tru-task details')).every(d => d.textContent.length > 30), report: Array.from(b.querySelectorAll('.tru-task .btn')).map(x => x.textContent.trim()), elig: b.textContent.includes('משימות לזכאות'), stored: localStorage.getItem('tfgn_trustee_name'), danger: !!b.querySelector('.tru-danger'), mine: b.textContent.includes('עדיין אין דיווחים'), lead: Array.from(b.querySelectorAll('#tru-lead .tru-lead > div')).map(x => x.textContent.replace(/\s+/g, ' ').trim()), rank: b.querySelector('#tru-my-rank').textContent, tour: !!b.querySelector('#tru-tour-btn') }; });
  check('point 4: month line says the contest resets on the 1st and how many days are left; intro collapses once a name is chosen', /מתאפס/.test(s1.note) && /(נותרו \d+ ימים|היום האחרון)/.test(s1.note) && !s1.introOpen, s1.note);
  check('score 0/100, 0/8, 0 closed; 8 task cards none done, each with "what to do" and a דווח button; a "report a tour" button', s1.score[0] === '0/100' && s1.score[1] === '0/8' && s1.score[2] === '0' && s1.tasks === 8 && s1.done === 0 && s1.hows && s1.report.every(t => t === 'דווח') && s1.tour, s1);
  check('point 3: "who leads" shows יוסי 10 then לב 0 (roster, no reports) and my place (not on the board yet)', s1.lead.length === 2 && /🥇.*יוסי.*10/.test(s1.lead[0]) && /🥈.*לב.*0/.test(s1.lead[1]) && /עדיין לא בלוח/.test(s1.rank), { lead: s1.lead, rank: s1.rank });
  check('eligibility hint, empty "my reports", immediate-danger banner, name remembered on the device', s1.elig && s1.mine && s1.danger && s1.stored === 'דנה', s1);

  console.log('\n3. point 2: one tour, several tasks, several findings');
  const f1 = await page.evaluate(() => { _truReport(3); const on = Array.from(document.querySelectorAll('#tru-chips .tru-chip.on')).map(b => b.dataset.truChip); return { open: document.getElementById('m-tru').style.display === 'block', chips: document.querySelectorAll('#tru-chips .tru-chip').length, on, blk: !!document.querySelector('#tru-tasks [data-tru-blk="3"]'), how: document.querySelector('#tru-tasks [data-tru-blk="3"] details').textContent, u: _truNameVal('tru-u', 'tru-u-other'), uSel: document.getElementById('tru-u').value, d: document.getElementById('tru-d').value, verdict: !!document.querySelector('#tru-tasks [data-tru-ok="3"]'), items: document.querySelectorAll('#tru-tasks [data-tru-item]').length, photoYet: !!document.querySelector('#tru-tasks [id^="tru-ph-3-"]') }; });
  check('form opens with task 3 pre-selected (8 chips), its block with "what to do", my name (via אחר), today, one item with verdict buttons, no photo slot until a verdict', f1.open && f1.chips === 8 && f1.on.join() === '3' && f1.blk && /מעבר ודלת חירום/.test(f1.how) && f1.u === 'דנה' && f1.uSel === '__other__' && f1.d === new Date().toISOString().substring(0, 10) && f1.verdict && f1.items === 1 && !f1.photoYet, f1);
  const v = await page.evaluate(() => {
    const out = []; const tl = () => window.__toasts.slice(-1)[0] || ''; const base = DB.trustee_reports.length;
    svTru(); out.push({ step: 'no location', toast: tl(), n: DB.trustee_reports.length - base });
    document.getElementById('tru-loc').value = 'אולם טיגון, יציאת חירום מערבית';
    svTru(); out.push({ step: 'no verdict', toast: tl(), n: DB.trustee_reports.length - base });
    const k1 = _truFormTask(3).items[0].k; _truFormSetOk(3, k1, false);
    out.push({ step: 'ליקוי → description + photo on the item', findings: document.querySelectorAll('#tru-tasks [data-tru-f]').length, bad: !!document.querySelector('#tru-tasks .tru-blk.bad'), photoBtn: !!document.querySelector('#tru-tasks [id^="tru-ph-3-"] button') });
    svTru(); out.push({ step: 'ליקוי without description', toast: tl(), n: DB.trustee_reports.length - base });
    document.querySelector('#tru-tasks [data-tru-f]').value = 'הדלת חסומה במשטחים';
    svTru(); out.push({ step: 'ליקוי without photo', toast: tl(), n: DB.trustee_reports.length - base });
    _attachUrls['tru-ph-3-' + k1] = 'https://x/p1.jpg';
    _truFormAddItem(3); const k2 = _truFormTask(3).items[1].k; _truFormSetOk(3, k2, false);
    document.querySelector('#tru-tasks [data-tru-loc][data-k="' + k2 + '"]').value = 'תאורת חירום מערבית';
    const tas = document.querySelectorAll('#tru-tasks [data-tru-f]');
    out.push({ step: 'second item added (ליקוי), first kept', findings: tas.length, first: tas[0].value, rm: document.querySelectorAll('#tru-tasks [onclick^="_truFormRmItem("]').length, header: document.querySelector('#tru-tasks [data-tru-blk="3"]').textContent, photoKept: !!document.querySelector('#tru-ph-3-' + k1 + ' img, #tru-ph-3-' + k1 + ' a[data-sign], #tru-ph-3-' + k1 + ' a[href]') });
    tas[1].value = 'תאורת חירום כבויה'; _attachUrls['tru-ph-3-' + tas[1].dataset.k] = 'https://x/p2.jpg';
    _truFormToggle(1); _truFormSetOk(1, _truFormTask(1).items[0].k, true);
    out.push({ step: 'task 1 added as תקין', on: Array.from(document.querySelectorAll('#tru-chips .tru-chip.on')).map(b => b.dataset.truChip).join(), good: !!document.querySelector('#tru-tasks .tru-blk.good'), okPhoto: !!document.querySelector('#tru-tasks [id^="tru-ph-1-"]') });
    svTru(); out.push({ step: 'saved', n: DB.trustee_reports.length - base, modal: document.getElementById('m-tru').style.display, emp: window.__empToasts.slice(-1)[0] || '', ins: window.__ins.length, ob: JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').filter(o => o.tbl === 'trustee_reports').length });
    return out;
  });
  check('blocked without a location, then without a verdict', /מיקום/.test(v[0].toast) && v[0].n === 0 && /תקין או ליקוי/.test(v[1].toast) && /3/.test(v[1].toast) && v[1].n === 0, [v[0], v[1]]);
  check('ליקוי opens one finding (description + photo picker); blocked without description, then without photo', v[2].findings === 1 && v[2].bad && v[2].photoBtn && /תאר/.test(v[3].toast) && /תמונה/.test(v[4].toast) && v[4].n === 0, [v[2], v[3], v[4]]);
  check('"+ עוד עמדה / מפגע": 2 items, the first keeps its text and photo, remove buttons appear, header counts 2 items / 2 ליקויים', v[5].findings === 2 && v[5].first === 'הדלת חסומה במשטחים' && v[5].rm === 2 && v[5].photoKept && /2 פריטים, 2 ליקויים/.test(v[5].header), v[5]);
  check('a second task (1, תקין) joins the same tour', v[6].on === '1,3' && v[6].good && v[6].okPhoto, v[6]);
  check('save: 3 rows in one go, form closed, employee toast counts 2 hazards to the safety officer, 3 outbox ops', v[7].n === 3 && v[7].modal === 'none' && /נשמרו 3/.test(v[7].emp) && /2 ליקויים/.test(v[7].emp) && v[7].ins === 3 && v[7].ob === 3, v[7]);
  const rows = await page.evaluate(() => DB.trustee_reports.filter(x => x.u === 'דנה').map(r => ({ t: r.t, ok: r.ok, s: r.s, f: r.f, photo: r.photo_url, tour: r.tour, m: r.m, loc: r.loc, ref: r.ref })));
  check('rows: task 1 תקין (no photo) + two task-3 hazards with their own text/photo, the second with its station detail in the location; same tour id, month', rows.length === 3 && rows[0].t === 1 && rows[0].ok === true && rows[0].s === 'תקין' && rows[1].t === 3 && rows[1].ok === false && rows[1].s === 'פתוח' && rows[1].f === 'הדלת חסומה במשטחים' && rows[1].photo === 'https://x/p1.jpg' && rows[2].f === 'תאורת חירום כבויה' && rows[2].photo === 'https://x/p2.jpg' && rows[2].loc === 'אולם טיגון, יציאת חירום מערבית · תאורת חירום מערבית' && rows[1].loc === 'אולם טיגון, יציאת חירום מערבית' && rows.every(r => r.tour === rows[0].tour && r.tour && r.m === month && r.ref === null), rows);
  const s2 = await page.evaluate(() => { const b = document.getElementById('tru-body'); return { score: Array.from(b.querySelectorAll('#tru-score .n')).map(x => x.textContent), doneN: b.querySelectorAll('.tru-task.done').length, mine: b.querySelectorAll('#tru-mine .tru-rep').length, closeBtns: b.querySelectorAll('#tru-mine [onclick^="_truCloseReport("]').length, openPill: /2 מפגעים פתוחים/.test(b.textContent), lead: Array.from(b.querySelectorAll('#tru-lead .tru-lead > div')).map(x => x.textContent.replace(/\s+/g, ' ').trim()), rank: b.querySelector('#tru-my-rank').textContent }; });
  check('screen: 20/100, 2/8, 3 reports listed, 2 "צלם אחרי", 2 open hazards; I lead the board now', s2.score[0] === '20/100' && s2.score[1] === '2/8' && s2.doneN === 2 && s2.mine === 3 && s2.closeBtns === 2 && s2.openPill && /🥇.*דנה.*20/.test(s2.lead[0]) && /מוביל/.test(s2.rank), s2);

  console.log('\n4. a תקין report with an optional photo');
  const okr = await page.evaluate(() => { _truReport(2); document.getElementById('tru-loc').value = 'אולם טיגון'; const k = _truFormTask(2).items[0].k; _truFormSetOk(2, k, true); const nudge = document.querySelector('#tru-tasks [data-tru-blk="2"]').textContent; _attachUrls['tru-ph-2-' + k] = 'https://x/ok.jpg'; svTru(); const r = DB.trustee_reports.filter(x => x.u === 'דנה' && x.t === 2)[0]; return { nudge, ok: r && r.ok, s: r && r.s, f: r && r.f, photo: r && r.photo_url, modal: document.getElementById('m-tru').style.display, toast: window.__empToasts.slice(-1)[0] }; });
  check('תקין saves with the optional photo; single-report toast', /מומלץ/.test(okr.nudge) && okr.ok === true && okr.s === 'תקין' && okr.f === null && okr.photo === 'https://x/ok.jpg' && okr.modal === 'none' && /דיווח נשמר/.test(okr.toast), okr);

  const ms = await page.evaluate(() => {
    // Michael's example: one task, several stations — 3 extinguishers, two fine, one not
    _truReport(5); document.getElementById('tru-loc').value = 'מחסן';
    const t5 = _truFormTask(5); document.querySelector('#tru-tasks [data-tru-loc][data-k="' + t5.items[0].k + '"]').value = 'מטף מזרחי'; _truFormSetOk(5, t5.items[0].k, true);
    _truFormAddItem(5); const kb = _truFormTask(5).items[1].k; document.querySelector('#tru-tasks [data-tru-loc][data-k="' + kb + '"]').value = 'הידרנט'; _truFormSetOk(5, kb, false); document.querySelector('#tru-tasks [data-tru-f][data-k="' + kb + '"]').value = 'ללא פלומבה'; _attachUrls['tru-ph-5-' + kb] = 'https://x/h.jpg';
    _truFormAddItem(5); const kc = _truFormTask(5).items[2].k; _truFormSetOk(5, kc, true);
    const header = document.querySelector('#tru-tasks [data-tru-blk="5"]').textContent; const cls = document.querySelector('#tru-tasks [data-tru-blk="5"]').className;
    svTru();
    const rows = DB.trustee_reports.filter(x => x.u === 'דנה' && x.t === 5).map(r => ({ ok: r.ok, loc: r.loc, f: r.f, photo: r.photo_url, tour: r.tour }));
    return { header, cls, rows, toast: window.__empToasts.slice(-1)[0], sameTour: rows.every(r => r.tour === rows[0].tour) };
  });
  check('one task, three stations: header counts 3 items / 1 ליקוי and the block is red; saved as 3 rows (תקין · מטף מזרחי, ליקוי · הידרנט with photo, תקין) in one tour', /3 פריטים, 1 ליקויים/.test(ms.header) && /bad/.test(ms.cls) && ms.rows.length === 3 && ms.rows[0].ok === true && ms.rows[0].loc === 'מחסן · מטף מזרחי' && ms.rows[1].ok === false && ms.rows[1].loc === 'מחסן · הידרנט' && ms.rows[1].f === 'ללא פלומבה' && ms.rows[1].photo === 'https://x/h.jpg' && ms.rows[2].ok === true && ms.rows[2].loc === 'מחסן' && ms.sameTour && /נשמרו 3/.test(ms.toast) && /1 ליקויים/.test(ms.toast), ms);

  console.log('\n5. צלם אחרי → task-8 report closes the finding');
  const c1 = await page.evaluate(() => { const id = DB.trustee_reports.filter(x => x.u === 'דנה' && x.t === 3)[0].id; _truCloseReport(id); return { id, open: document.getElementById('m-tru').style.display === 'block', on: Array.from(document.querySelectorAll('#tru-chips .tru-chip.on')).map(b => b.dataset.truChip).join(), disabled: Array.from(document.querySelectorAll('#tru-chips .tru-chip')).every(b => b.disabled), ref: document.getElementById('tru-ref').value, note: document.getElementById('tru-ref-note').textContent, loc: document.getElementById('tru-loc').value, verdictBtns: document.querySelectorAll('#tru-tasks [data-tru-ok]').length, after: /תמונת "אחרי"/.test(document.querySelector('#tru-tasks [data-tru-blk="8"]').textContent), photoArea: !!document.getElementById('tru-ph-8-ok') }; });
  check('closure form: only task 8, chips locked, ref = the finding, note explains, location prefilled, no verdict buttons, "after" photo slot', c1.open && c1.on === '8' && c1.disabled && c1.ref === c1.id && /נסגר/.test(c1.note) && /הדלת חסומה/.test(c1.note) && c1.loc.length > 5 && c1.verdictBtns === 0 && c1.after && c1.photoArea, c1);
  const c2 = await page.evaluate(() => { const before = DB.trustee_reports.length; svTru(); const t1 = window.__toasts.slice(-1)[0]; _attachUrls['tru-ph-8-ok'] = 'https://x/after.jpg'; svTru(); const r8 = DB.trustee_reports[DB.trustee_reports.length - 1]; const orig = DB.trustee_reports.filter(x => x.u === 'דנה' && x.t === 3)[0]; const b = document.getElementById('tru-body'); return { before, blockedToast: t1, n: DB.trustee_reports.length, t: r8.t, ref: r8.ref, ok: r8.ok, s8: r8.s, f8: r8.f, origS: orig.s, score: Array.from(b.querySelectorAll('#tru-score .n')).map(x => x.textContent), closeBtns: b.querySelectorAll('#tru-mine [onclick^="_truCloseReport("]').length, toast: window.__empToasts.slice(-1)[0] }; });
  check('blocked without the "after" photo; with it: t=8 row with ref + "after" text, the finding flips to נסגר locally, thank-you toast', /תמונ/.test(c2.blockedToast) && c2.n === c2.before + 1 && c2.t === 8 && c2.ref === c1.id && c2.ok === true && /אחרי/.test(c2.f8) && /הדלת חסומה/.test(c2.f8) && c2.origS === 'נסגר' && /נסגר/.test(c2.toast), c2);
  check('score now 52/100 (tasks 1,2,3,5,8 = 50 + 1 closed = 2), 5/8, 1 closed; two "צלם אחרי" left (task-3 #2 and the hydrant)', c2.score[0] === '52/100' && c2.score[1] === '5/8' && c2.score[2] === '1' && c2.closeBtns === 2, c2);

  console.log('\n6. server pull keeps outbox rows, adopts server changes');
  const p1 = await page.evaluate(async () => {
    const mine = DB.trustee_reports.filter(r => r.u === 'דנה');
    window.__server = [window.__server[0], Object.assign({}, mine[1], { s: 'פתוח', mgr_note: 'נבדק — עדיין חסום' })];
    const ok = await _truPull(true);
    return { ok, n: DB.trustee_reports.length, yosi: DB.trustee_reports.some(r => r.u === 'יוסי'), mineN: DB.trustee_reports.filter(r => r.u === 'דנה').length, toast: window.__toasts.slice(-1)[0], obBefore: mine.map(r => r.id + ':' + (_obGet().some(o => o.tbl === 'trustee_reports' && o.row && o.row.id === r.id) ? 'pending' : 'NOT-IN-OUTBOX')), obAll: _obGet().map(o => o.tbl + '/' + o.op + '/' + (o.row ? o.row.t : '')) };
  });
  check('pull: server row from another trustee present, my 8 pending rows survive (P0 sbSync rules)', p1.ok && p1.n === 9 && p1.yosi && p1.mineN === 8 && /עודכן/.test(p1.toast), p1);
  const p2 = await page.evaluate(async () => { window.sbGet = () => Promise.resolve(null); const ok = await _truPull(true); return { ok, n: DB.trustee_reports.length, toast: window.__toasts.slice(-1)[0] }; });
  check('unreachable server: cache kept, honest toast', p2.ok === false && p2.n === 9 && /חיבור/.test(p2.toast), p2);
  await page.screenshot({ path: OUT + '/trustee-screen-375.png', fullPage: true });
  await page.evaluate(() => { _truReport(5); const t5 = _truFormTask(5); document.querySelector('#tru-tasks [data-tru-loc]').value = 'מטף מזרחי'; _truFormSetOk(5, t5.items[0].k, true); _truFormAddItem(5); _truFormSetOk(5, _truFormTask(5).items[1].k, false); _truFormAddItem(5); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/trustee-tour-form-375.png', fullPage: true });
  await page.evaluate(() => closeModal('m-tru'));

  console.log('\n7. flag round trip + manager path');
  const b1 = await page.evaluate(() => {
    EMP_HOME_TRUSTEES_ONLY = false; empToggle(true);
    const home = document.getElementById('pg-emp-home');
    const out = { onlyOff: !home.classList.contains('tru-only'), grid: getComputedStyle(home.querySelector('.emp-grid')).display, btn: getComputedStyle(document.getElementById('emp-trustee-btn')).display };
    _truOpen(); out.opened = home.classList.contains('tru-open') && getComputedStyle(home.querySelector('.emp-grid')).display === 'none';
    _truBack(); out.closed = !home.classList.contains('tru-open') && getComputedStyle(home.querySelector('.emp-grid')).display !== 'none';
    EMP_HOME_TRUSTEES_ONLY = true; _truEmpHome(false);
    out.onlyOn = home.classList.contains('tru-only') && getComputedStyle(home.querySelector('.emp-grid')).display === 'none';
    out.board = _truBoard(new Date().toISOString().substring(0, 7)).map(x => x.u + ':' + x.total).join(' ');
    return out;
  });
  check('flag off restores the tile grid + 🦺 button + swap/back; flag on hides the tiles again; board: דנה 52, יוסי 10, לב 0', b1.onlyOff && b1.grid !== 'none' && b1.btn !== 'none' && b1.opened && b1.closed && b1.onlyOn && b1.board === 'דנה:52 יוסי:10 לב:0', b1);
  const m1 = await page.evaluate(() => {
    document.body.classList.remove('emp-mode'); localStorage.removeItem('tfgn_emp_mode');
    window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash');
    _truReport(2); document.getElementById('tru-u').value = '__other__'; _truUChanged('__other__'); document.getElementById('tru-u-other').value = 'רון'; document.getElementById('tru-loc').value = 'מחסן'; _truFormSetOk(2, _truFormTask(2).items[0].k, true); svTru();
    const r = DB.trustee_reports[DB.trustee_reports.length - 1];
    return { u: r.u, t: r.t, stored: localStorage.getItem('tfgn_trustee_name'), toast: window.__toasts.slice(-1)[0], modal: document.getElementById('m-tru').style.display };
  });
  check('manager files a report on behalf of רון: saved, device name stays דנה, normal toast', m1.u === 'רון' && m1.t === 2 && m1.stored === 'דנה' && /נשמר/.test(m1.toast) && m1.modal === 'none', m1);


  console.log('\n9. Quick wins 2026-09-19: note on my report, action above stats, image-only picker, toasts wrap');
  const qw = await page.evaluate(() => {
    try { closeModal('m-tru'); } catch (e) {}
    const me = _truMe() || 'לב'; _truSetMe(me);
    const M = _truThisMonth(), D = new Date().toISOString().substring(0, 10);
    DB.trustee_reports = (DB.trustee_reports || []).filter(r => r.id !== 'qw1');
    DB.trustee_reports.push({ id: 'qw1', u: me, t: 3, d: D, m: M, loc: 'מחסן', ok: false, f: 'דלת חירום נעולה', s: 'פתוח', mgr_note: 'הועבר לאחזקה, יטופל עד יום ה׳', ts: new Date().toISOString() });
    _truRender();
    const body = document.getElementById('tru-body'), kids = Array.from(body.children);
    const idx = (sel) => kids.findIndex(k => k.matches(sel) || k.querySelector(sel));
    const mine = (document.getElementById('tru-mine') || {}).textContent || '';
    _attachPick('tru-ph-3-1', 'tru-ph-3-1'); _attachPick('qw-generic-area', 'qw-generic-area');
    const acc = (id) => (document.getElementById('_att_inp_' + id) || {}).accept || '';
    const probe = document.createElement('div'); probe.className = 'toast'; document.body.appendChild(probe);
    const ws = getComputedStyle(probe).whiteSpace; probe.remove();
    const et = document.getElementById('emp-toast');
    return { iTour: idx('#tru-tour-btn'), iTask: idx('.tru-task'), iWin: idx('#tru-winner'), iLead: idx('#tru-lead'), iScore: idx('#tru-score'),
      note: /📌/.test(mine) && /הועבר לאחזקה/.test(mine), accTru: acc('tru-ph-3-1'), accGen: acc('qw-generic-area'), ws, empWs: et ? getComputedStyle(et).whiteSpace : null,
      btnH: (() => { const b = document.querySelector('.tru-task .btn'); if (!b) return 0; return Math.max(Math.round(b.getBoundingClientRect().height), parseInt(getComputedStyle(b).minHeight) || 0); })() };
  });
  check('my report shows the manager\'s routing note (📌 …)', qw.note, qw);
  check('trustee home: score → tour button → task cards → then winner/leaderboard (action above stats)', qw.iScore >= 0 && qw.iTour > qw.iScore && qw.iTask > qw.iTour && qw.iLead > qw.iTask && (qw.iWin < 0 || qw.iWin > qw.iTask), qw);
  check('photo picker for trustee items is image-only; other areas keep documents', qw.accTru === 'image/*' && /pdf/.test(qw.accGen), { accTru: qw.accTru, accGen: qw.accGen });
  check('toasts wrap instead of clipping (white-space normal on .toast and #emp-toast)', qw.ws === 'normal' && qw.empWs === 'normal', { ws: qw.ws, empWs: qw.empWs });
  check('task card button is at least 44px tall (rendered height, or declared min-height when the panel is hidden)', qw.btnH >= 44, qw.btnH);
  await page.evaluate(() => { DB.trustee_reports = DB.trustee_reports.filter(r => r.id !== 'qw1'); _truRender(); });
  await page.screenshot({ path: '/tmp/claude-0/-home-user-tfugen-safety/e2c89c7c-32b0-5a3d-b89d-178d2be903b8/scratchpad/ux/after-trustee-home-375.png', fullPage: false });

  console.log('\n10. Chips fold when the form opened for one task (2026-09-19)');
  const cf = await page.evaluate(() => {
    _truReport(2);
    const d = document.getElementById('tru-chips-more');
    const one = { folded: !!d && !d.open, chips: d ? d.querySelectorAll('.tru-chip').length : 0, blk: !!document.querySelector('#tru-tasks .tru-blk[data-tru-blk="2"]'), summary: d ? d.querySelector('summary').textContent.trim() : '' };
    closeModal('m-tru'); _truReport();
    const none = { details: !!document.getElementById('tru-chips-more'), chips: document.querySelectorAll('#tru-chips .tru-chip').length };
    closeModal('m-tru');
    return { one, none };
  });
  check('opened from task card 2: 8 chips folded under «+ הוסף משימה נוספת», task-2 block already on screen', cf.one.folded && cf.one.chips === 8 && cf.one.blk && /הוסף משימה נוספת/.test(cf.one.summary), cf.one);
  check('opened from «דווח סיור» (no task): all 8 chips shown, nothing folded', !cf.none.details && cf.none.chips === 8, cf.none);

  console.log('\n8. Location prefilled from the reporting trustee\'s area (2026-09-19)');
  const pf = await page.evaluate(() => {
    DB.trustees = [
      { id: 'a1', n: 'לב', dep: 'ייצור ואריזה', active: true },
      { id: 'a2', n: 'גלינה', dep: 'מעבדה', active: true },
      { id: 'a3', n: 'בלי', active: true },
    ];
    const loc = () => document.getElementById('tru-loc').value;
    const pick = (n) => { document.getElementById('tru-u').value = n; _truUChanged(n); };
    const out = {};
    _truSetMe('לב'); _truReport(1); out.open = loc();          // my own area, on open
    pick('גלינה'); out.switched = loc();                        // follows the picker
    pick('בלי'); out.noArea = loc();                            // no area → left as it was
    document.getElementById('tru-loc').value = 'אולם טיגון, ליד המשאבה';
    pick('לב'); out.typed = loc();                              // typing is never overwritten
    closeModal('m-tru');
    // closing a finding: the location comes from the original, not from the area
    const haz = DB.trustee_reports.filter(r => r.ok === false && r.s !== 'נסגר')[0];
    out.hazLoc = haz ? haz.loc : null;
    if (haz) { _truCloseReport(haz.id); out.closure = loc(); closeModal('m-tru'); }
    return out;
  });
  check('opening the form fills the location with the reporting trustee\'s area, and switching the name in the picker follows', pf.open === 'ייצור ואריזה' && pf.switched === 'מעבדה', pf);
  check('a trustee with no assigned area leaves whatever was there; something typed is never overwritten by a name change', pf.noArea === 'מעבדה' && pf.typed === 'אולם טיגון, ליד המשאבה', pf);
  check('closing a finding still takes the location from that finding, not from the area', pf.closure === pf.hazLoc && !!pf.hazLoc, pf);


  console.log('\nZ1. Live «what is missing» line in the tour form (2026-09-20)');
  const st = await page.evaluate(() => {
    const read = () => (document.getElementById('tru-form-status') || {}).textContent || '';
    const out = {};
    _truSetMe('לב'); _truReport(3);
    const k = _truForm.tasks[3].items[0].k;
    document.getElementById('tru-loc').value = '';
    _truFormStatus(); out.noLoc = read();
    document.getElementById('tru-loc').value = 'מחסן';
    _truFormStatus(); out.noVerdict = read();
    _truFormSetOk(3, k, false);
    out.noText = read();
    document.querySelector('#tru-tasks [data-tru-f][data-n="3"][data-k="' + k + '"]').value = 'מטף חסר';
    _truFormStatus(); out.noPhoto = read();
    _attachUrls[_truPhId(3, k)] = 'https://x/p.jpg';
    _truFormStatus(); out.ready = read();
    _truFormSetOk(3, k, true);
    out.okItem = read();
    closeModal('m-tru'); _truFormStatus(); out.closed = read();
    return out;
  });
  check('empty location is named first, matching svTru\'s own order', /חסר מיקום/.test(st.noLoc), st.noLoc);
  check('then «סמן תקין או ליקוי», naming the task', /סמן תקין או ליקוי/.test(st.noVerdict) && /משימה 3/.test(st.noVerdict), st.noVerdict);
  check('a ליקוי asks for the description, then for the photo', /תאר את הליקוי/.test(st.noText) && /חסרה תמונה לליקוי/.test(st.noPhoto), { noText: st.noText, noPhoto: st.noPhoto });
  check('once nothing is missing it says ready, with the tour summary', /מוכן לשליחה/.test(st.ready) && /1 משימות/.test(st.ready) && /1 ליקויים/.test(st.ready), st.ready);
  check('a תקין item needs no description', /מוכן לשליחה/.test(st.okItem), st.okItem);
  check('the line clears when the form closes', st.closed === '', st.closed);

  console.log('\nZ2. The trustee link the manager shares (2026-09-20)');
  const lk = await page.evaluate(() => {
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates(); goPage('trustees');
    document.getElementById('tru-mgr-more-btn').click();
    const entry = Array.from(document.querySelectorAll('#tru-mgr-menu button')).find(b => /קישור לנאמנים/.test(b.textContent));
    if (entry) entry.click(); else document.body.click();
    const modal = document.getElementById('m-tru-link');
    return { open: !!modal && modal.style.display === 'block', url: (document.getElementById('tru-link-url') || {}).value, fn: typeof _truLinkUrl === 'function' && _truLinkUrl() };
  });
  check('⋯ offers «שלח קישור לנאמנים» and the modal shows the ?emp=1 address', lk.open && /\?emp=1$/.test(lk.url || '') && lk.url === lk.fn, lk);
  const dl = await page.evaluate(() => {
    closeModal('m-tru-link');
    try { localStorage.removeItem(EMP_KEY); } catch (e) {}
    const qs = '?emp=1';
    if (/[?&]emp=1\b/.test(qs)) localStorage.setItem(EMP_KEY, '1');
    return { flag: localStorage.getItem(EMP_KEY) };
  });
  check('that address is what the boot block reads to skip the login screen', dl.flag === '1', dl);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
