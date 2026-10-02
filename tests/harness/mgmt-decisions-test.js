// BACKLOG 9.25 (02/10/2026): a management review was saved as AI text only,
//     with no attendees, no decisions and no follow-up. Saving now asks for
//     attendees (required) and decisions; each decision becomes a task linked
//     to the review, the review keeps the decisions as text, and the next
//     review shows what became of each task (and hands it to the AI).
// BACKLOG 9.7: drills had no expiry, so none ever reached the expiry page.
//     The next drill of a type is due 12 months after the last one; a type
//     never drilled is on the «no date» tab with a button to record one.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'michael' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.__ins = []; window.sbIns = function (t, r) { window.__ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__alerts = []; window.alert = function (m) { window.__alerts.push(String(m)); };
    window.__in = (n) => new Date(Date.now() + n * 864e5).toISOString().split('T')[0];
    DB.mgmt_reviews = []; DB.tasks = [];
  });

  console.log('\n9.25 saving a review asks for attendees and decisions');
  {
    const r = await page.evaluate(() => {
      goPage('mr');
      window._mrAIRaw = 'נרטיב לבדיקה';
      _mrSaveReview('review');
      const open = getComputedStyle(g('m-mrsave')).display !== 'none';
      const rows0 = document.querySelectorAll('#mrs-dec .mrs-row').length;
      _mrSaveConfirm();                       // attendees empty
      const blocked = DB.mgmt_reviews.length === 0 && window.__alerts.length === 1;
      g('mrs-att').value = 'מיכאל, מנכ"ל';
      _mrDecRow(); _mrDecRow();
      const rows = document.querySelectorAll('#mrs-dec .mrs-row');
      rows[0].querySelector('.mrs-t').value = 'להחליף מטפים במחסן';
      rows[0].querySelector('.mrs-a').value = 'יוסי';
      rows[0].querySelector('.mrs-u').value = __in(-3);
      rows[1].querySelector('.mrs-t').value = 'תרגיל פינוי עד סוף השנה';
      rows[2].querySelector('.mrs-t').value = '   ';  // empty row is skipped
      _mrSaveConfirm();
      const rev = DB.mgmt_reviews[0] || {};
      const tasks = DB.tasks.filter((t) => t.source_table === 'mgmt_reviews' && t.source_id === rev.id);
      return {
        open, rows0, blocked, closed: getComputedStyle(g('m-mrsave')).display === 'none',
        n: DB.mgmt_reviews.length, att: rev.attendees, dec: rev.decisions, content: rev.content,
        tasks: tasks.map((t) => [t.title, t.assignee, t.due === __in(-3) ? 'D' : t.due, t.status]),
        insTbls: window.__ins.map((x) => x[0]),
        toast: window.__toasts.slice(-1)[0],
      };
    });
    check('the save window opens with one empty decision row', r.open && r.rows0 === 1, r);
    check('no attendees = not saved, asked to fill', r.blocked, r);
    check('saved once, window closed', r.n === 1 && r.closed, r);
    check('attendees and content kept on the review', r.att === 'מיכאל, מנכ"ל' && r.content === 'נרטיב לבדיקה', r);
    check('decisions kept as numbered text with owner and DD/MM/YYYY due', /^1\. להחליף מטפים במחסן - אחראי: יוסי - יעד: \d\d\/\d\d\/\d{4}\n2\. תרגיל פינוי עד סוף השנה$/.test(r.dec || ''), r.dec);
    check('two tasks opened (empty row skipped), linked to the review', r.tasks.length === 2 && r.tasks[0][0] === 'להחליף מטפים במחסן' && r.tasks[0][1] === 'יוסי' && r.tasks[0][2] === 'D' && r.tasks[1][1] === null && r.tasks[1][2] === null && r.tasks.every((t) => t[3] === "\u05e4\u05ea\u05d5\u05d7"), r.tasks);
    check('review and tasks sent to the server', r.insTbls.join(',') === 'mgmt_reviews,tasks,tasks', r.insTbls);
    check('toast counts the tasks', /2/.test(r.toast || ''), r.toast);
  }

  console.log('\n9.25 the next review shows what became of the decisions');
  {
    const r = await page.evaluate(() => {
      const t = DB.tasks.find((x) => x.title === 'תרגיל פינוי עד סוף השנה'); t.status = _TSK_DONE;
      rMr();
      const card = g('mr-prev-dec-card');
      const txt = g('mr-prev-dec').textContent;
      const ai = _mrPrevDecText();
      const lbl = _tskSrcLabel('mgmt_reviews');
      const vf = VIEW_CONFIG.mgmt_reviews.fields.map((f) => f[1]);
      return { shown: card.style.display !== 'none', txt, ai, lbl, vf };
    });
    check('card shown with 1 of 2 done', r.shown && /1 מתוך 2 הושלמו/.test(r.txt), r.txt);
    check('overdue decision marked late, done marked done', /באיחור/.test(r.txt) && /הושלם/.test(r.txt), r.txt);
    check('AI context lists the previous decisions with status', /החלטות מהסקירה הקודמת/.test(r.ai) && /להחליף מטפים במחסן \(אחראי: יוסי\): באיחור/.test(r.ai) && /תרגיל פינוי עד סוף השנה: הושלם/.test(r.ai), r.ai);
    check('task source reads «סקירת הנהלה»', r.lbl === 'סקירת הנהלה', r.lbl);
    check('view and PDF show attendees and decisions', r.vf.indexOf('attendees') >= 0 && r.vf.indexOf('decisions') >= 0, r.vf);
  }
  {
    const r = await page.evaluate(() => { DB.mgmt_reviews = []; _mrReviewsRender(); return g('mr-prev-dec-card').style.display; });
    check('no saved review = no card', r === 'none', r);
  }

  console.log('\n9.7 drills reach the expiry page');
  {
    const r = await page.evaluate(() => {
      ['docs', 'tr', 'ppe', 'ctr', 'equip_inspections', 'med', 'hearing_tests', 'drl'].forEach((t) => { DB[t] = []; });
      const types = Array.from(g('drl-ty').options).map((o) => o.value || o.text);
      const none0 = _expNoDate().filter((x) => x.mod === 'drl').map((x) => x.name);
      const coll0 = _expCollect().filter((x) => x.mod === 'drl').length;
      DB.drl = [
        { id: 'd1', ty: types[0], d: '2025-03-31' },
        { id: 'd2', ty: types[0], d: '2024-01-10' },
        { id: 'd3', ty: types[1], d: '2024-02-29' },
        { id: 'd4', ty: types[2], d: null },
      ];
      const coll = _expCollect().filter((x) => x.mod === 'drl').map((x) => [x.name, x.e, x.id]);
      const none = _expNoDate().filter((x) => x.mod === 'drl').map((x) => x.name);
      return { types, none0, coll0, coll, none };
    });
    check('empty register (drills still in the folders): no drill rows at all', r.coll0 === 0 && r.none0.length === 0 && r.types.length >= 5, r);
    check('next = 12 months after the LAST drill of the type', JSON.stringify(r.coll[0]) === JSON.stringify([r.types[0], '2026-03-31', 'd1']), r.coll);
    check('29/02 + 12 months = 28/02', r.coll[1] && r.coll[1][1] === '2025-02-28', r.coll);
    check('a drill with no date does not count as done', r.none.indexOf(r.types[2]) >= 0 && r.coll.length === 2, r);
  }
  {
    const r = await page.evaluate(() => {
      goPage('exp'); expFilter('none');
      const rows = Array.from(document.querySelectorAll('#tb-exp tr')).filter((tr) => /\+ תרגיל/.test(tr.textContent));
      const btn = rows[0] && rows[0].querySelector('[data-dty]');
      const ty = btn && btn.dataset.dty;
      g('drl-n').value = 'ישן'; g('drl-d').value = '2020-01-01';
      if (btn) btn.click();
      const v = { ty: g('drl-ty').value, n: g('drl-n').value, d: g('drl-d').value, open: getComputedStyle(g('m-drl')).display !== 'none' };
      closeModal('m-drl');
      expFilter('exp');
      const late = Array.from(document.querySelectorAll('#tb-exp tr')).filter((tr) => /\+ תרגיל/.test(tr.textContent));
      const eye = late[0] && late[0].querySelector('[data-vt="drl"]');
      return { n: rows.length, ty, v, late: late.length, eye: eye && eye.dataset.vi };
    });
    check('undated drill rows carry «+ תרגיל» and no view button', r.n >= 3, r);
    check('«+ תרגיל» opens a clean drill form with the type set', r.v.open && r.v.ty === r.ty && r.v.n === '' && r.v.d === '', r);
    check('an overdue drill is on «expired» with a view of the last drill', r.late === 2 && (r.eye === 'd1' || r.eye === 'd3'), r);
  }

  console.log('\n9.7 internal audits reach the expiry page');
  {
    const r = await page.evaluate(() => {
      DB.drl = []; DB.auds = [];
      const areas = Array.from(g('a-r').options).map((o) => o.value || o.text);
      const coll0 = _expCollect().filter((x) => x.mod === 'aud').length + _expNoDate().filter((x) => x.mod === 'aud').length;
      DB.auds = [
        { id: 'a1', r: areas[0], d: '2025-03-31', s: 'הושלם' },
        { id: 'a2', r: areas[0], d: '2024-01-10', s: 'הושלם' },
        { id: 'a3', r: areas[0], d: '2027-01-01', s: 'מתוכנן' },
        { id: 'a4', r: areas[1], d: '2024-02-29', s: 'ממצאים פתוחים' },
        { id: 'a5', r: areas[2], d: '2025-05-01', s: 'מתוכנן' },
      ];
      const coll = _expCollect().filter((x) => x.mod === 'aud').map((x) => [x.name, x.e, x.id, x.owner]);
      const none = _expNoDate().filter((x) => x.mod === 'aud').map((x) => x.name);
      return { areas, coll0, coll, none };
    });
    check('empty register: no audit rows at all', r.coll0 === 0 && r.areas.length === 5, r);
    check('next = 12 months after the LAST performed audit of the area', JSON.stringify(r.coll[0]) === JSON.stringify([r.areas[0], '2026-03-31', 'a1', 'אחרונה: 31/03/2025']), r.coll);
    check('29/02 + 12 months = 28/02', r.coll[1] && r.coll[1][1] === '2025-02-28', r.coll);
    check('a planned audit is not a performed one: its area has no date', r.none.indexOf(r.areas[2]) >= 0 && r.coll.length === 2 && r.none.length === 3, r);
  }
  {
    const r = await page.evaluate(() => {
      goPage('exp'); expFilter('none');
      const rows = Array.from(document.querySelectorAll('#tb-exp tr')).filter((tr) => /\+ ביקורת/.test(tr.textContent));
      const btn = rows[0] && rows[0].querySelector('[data-dar]');
      const ar = btn && btn.dataset.dar;
      g('a-n').value = 'ישן'; g('a-d').value = '2020-01-01'; g('a-st').selectedIndex = 2;
      if (btn) btn.click();
      const v = { r: g('a-r').value, n: g('a-n').value, d: g('a-d').value, st: g('a-st').selectedIndex, open: getComputedStyle(g('m-aud')).display !== 'none' };
      closeModal('m-aud');
      expFilter('exp');
      const late = Array.from(document.querySelectorAll('#tb-exp tr')).filter((tr) => /\+ ביקורת/.test(tr.textContent));
      const eye = late[0] && late[0].querySelector('[data-vt="auds"]');
      return { n: rows.length, ar, v, late: late.length, eye: eye && eye.dataset.vi };
    });
    check('undated area rows carry «+ ביקורת»', r.n === 3, r);
    check('«+ ביקורת» opens a clean audit form with the area set', r.v.open && r.v.r === r.ar && r.v.n === '' && r.v.d === '' && r.v.st === 0, r);
    check('an overdue area is on «expired» with a view of the last audit', r.late === 2 && (r.eye === 'a1' || r.eye === 'a4'), r);
  }
  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
