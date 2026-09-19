// Trustees T1: the new table is wired into cache / sync / realtime / backup,
// the 8-task catalogue is complete, and the scoring matches the document.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  console.log('\n1. wiring');
  const w = await page.evaluate(() => {
    // cache round-trip: a row stored under tfgn2 comes back through ldb()
    localStorage.setItem('tfgn2', JSON.stringify({ trustee_reports: [{ id: 'c1', u: 'x', t: 1, d: '2026-09-01', ok: true, s: 'תקין' }] }));
    DB.trustee_reports = undefined; ldb();
    const cached = Array.isArray(DB.trustee_reports) && DB.trustee_reports.length === 1;
    localStorage.removeItem('tfgn2'); DB.trustee_reports = undefined; ldb();
    const dflt = Array.isArray(DB.trustee_reports) && DB.trustee_reports.length === 0;
    // pull list: sbSync asks the server for the table
    const asked = []; const og = window.sbGet; window.sbGet = function (t) { asked.push(t); return Promise.resolve(null); };
    sbSync(true); window.sbGet = og;
    // realtime list: fake SDK records which tables the channel subscribes to
    const rt = []; window.supabase = { createClient: function () { return { auth: { onAuthStateChange() {}, getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }) }, channel: () => ({ on: (ev, o) => { rt.push(o.table); }, subscribe() {} }) }; } };
    _sbClient = null; _sbAuthPromise = null; _sbRT = null;
    return new Promise((res) => { _rtStart(); setTimeout(() => res({ cached, dflt, asked: asked.includes('trustee_reports'), rt: rt.includes('trustee_reports'), ts: _sbTsCol.trustee_reports, backup: _BACKUP_TABLES.includes('trustee_reports'), label: _tskSrcLabel('trustee_reports'), primary: _PAGE_PRIMARY.trustees }), 100); });
  });
  check('ldb: cached rows load, missing table defaults to []', w.cached && w.dflt, w);
  check('sbSync pulls trustee_reports; realtime subscribes to it', w.asked && w.rt, w);
  check('ts column, backup list, task-source label, page→table map', w.ts === 'ts' && w.backup && w.label === 'נאמן בטיחות' && w.primary === 'trustee_reports', w);

  console.log('\n2. catalogue');
  const cat = await page.evaluate(() => ({ n: TRUSTEE_TASKS.length, nums: TRUSTEE_TASKS.map(t => t.n).join(','), full: TRUSTEE_TASKS.every(t => t.t && t.how && t.icon), t8: _truTask(8).t, t9: _truTask(9), names: TRUSTEE_TASKS.map(t => t.t) }));
  check('8 tasks numbered 1..8, each with a title, "what to do" text and icon', cat.n === 8 && cat.nums === '1,2,3,4,5,6,7,8' && cat.full, cat);
  check('titles match the document (1 סיור מפגעים … 8 מעקב סגירה)', /סיור מפגעים/.test(cat.names[0]) && /מקלחות חירום/.test(cat.names[1]) && /דרכי מילוט/.test(cat.names[2]) && /סולמות/.test(cat.names[3]) && /כיבוי אש/.test(cat.names[4]) && /מגיני מכונות/.test(cat.names[5]) && /עזרה ראשונה/.test(cat.names[6]) && cat.t8 === 'מעקב סגירה' && cat.t9 === null, cat.names);

  console.log('\n3. scoring (document rules)');
  const sc = await page.evaluate(() => {
    const m = '2026-09';
    const r = (u, t, ok, s, d) => ({ id: u + t + s + Math.random(), u, t, ok, s, d: d || '2026-09-10', m: (d || '2026-09-10').substring(0, 7) });
    DB.trustee_reports = [
      // דנה: tasks 1 (twice), 2, 3 → 3 tasks; 2 hazards closed, 1 open
      r('דנה', 1, false, 'נסגר'), r('דנה', 1, false, 'נסגר'), r('דנה', 2, true, 'תקין'), r('דנה', 3, false, 'פתוח'),
      // יוסי: all 8 tasks, 12 hazards closed → 80 + min(24,20) = 100
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(t => r('יוסי', t, true, 'תקין')),
      ...Array.from({ length: 12 }, (_, i) => r('יוסי', (i % 7) + 1, false, 'נסגר')),
      // רון: 5 tasks, 3 closed, also a task-8 "after" row (t=8 counts as a task, never as a hazard)
      ...[1, 2, 3, 4].map(t => r('רון', t, true, 'תקין')), r('רון', 8, true, 'תקין'), ...[1, 2, 3].map(t => r('רון', t, false, 'נסגר')),
      // last month — must not leak into September
      r('דנה', 5, true, 'תקין', '2026-08-20'), r('דנה', 6, false, 'נסגר', '2026-08-21'),
      // a row without m (older client) still lands in its month via d
      { id: 'nom', u: 'רון', t: 5, ok: true, s: 'תקין', d: '2026-09-12' },
    ];
    const dana = _truScore('דנה', m), yosi = _truScore('יוסי', m), ron = _truScore('רון', m), aug = _truScore('דנה', '2026-08');
    const board = _truBoard(m).map(x => x.u + ':' + x.total);
    return { dana, yosi, ron, aug, board };
  });
  check('דנה: 3 distinct tasks → 30, 2 closed → 4, total 34, 1 open, not eligible', sc.dana.nTasks === 3 && sc.dana.ptsTasks === 30 && sc.dana.closed === 2 && sc.dana.ptsClosed === 4 && sc.dana.total === 34 && sc.dana.open === 1 && !sc.dana.eligible, sc.dana);
  check('יוסי: 8 tasks → 80 (cap), 12 closed → 20 (cap), total 100, eligible', sc.yosi.ptsTasks === 80 && sc.yosi.ptsClosed === 20 && sc.yosi.total === 100 && sc.yosi.eligible, sc.yosi);
  check('רון: 6 tasks incl. task 8 and a row without m → 60 + 6 = 66, eligible', sc.ron.nTasks === 6 && sc.ron.total === 66 && sc.ron.eligible && sc.ron.closed === 3, sc.ron);
  check('August rows score in August only (דנה: 2 tasks, 1 closed → 22)', sc.aug.nTasks === 2 && sc.aug.closed === 1 && sc.aug.total === 22, sc.aug);
  check('leaderboard: יוסי 100, רון 66, דנה 34', sc.board.join(' ') === 'יוסי:100 רון:66 דנה:34', sc.board);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
