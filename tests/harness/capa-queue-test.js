// ISO 45001 §10.2 and ISO 14001 §10.2 both ask the same question: did the
// corrective action work? The app has recorded the ANSWER since May — three
// columns on ncr and a ✅ button — but the button lived only inside the view
// modal of one closed NCR, and only if you happened to open one that had been
// closed 30 days or more. With 375 NCRs nobody finds those by browsing, so the
// step never happened. The system documented fixes and proved none of them.
//
// This is the queue. It has to do three things and not do a fourth: count the
// right rows, put them where the manager looks, let them be verified in one
// tap — and never show a verification button on a row that has been verified,
// or one that is too young to judge.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const prompts = [];
  page.on('dialog', async (d) => { prompts.push(d.message()); await d.accept('נבדק בשטח — הכתם לא חזר, השילוט במקום').catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const seed = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window.__upd = [];
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, id: r.id, by: r.verified_by, notes: r.verification_notes }); };
    window.sbIns = function () {}; window.sdb = function () {}; window.addLog = function () {};
    // _isAdminUser() keys on username==='admin' OR role==='אדמין' — the same
    // gate the view-modal button has always used. Do not widen it here.
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _isAdmin = true;
    _applyRoleGates();
    window._ncrQuickFilter = ''; window._ncrFilter = 'all'; window._ncrLocFilter = '';
    window._ncrPrjFilter = ''; window._ncrItypeFilter = '';
    const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const day = (d) => ago(d).split('T')[0];
    DB.ncr = [
      // due: closed long ago, never verified. The oldest is first on purpose.
      { id: 'due1', num: 'NCR-101', d: 'שמן על הרצפה', s: 'סגור', cd: day(200), o: 'דני', sd: day(230), ts: ago(200) },
      { id: 'due2', num: 'NCR-102', d: 'מעקה חסר', s: 'סגור', cd: day(45), o: 'דני', sd: day(60), ts: ago(45) },
      { id: 'due3', num: 'NCR-103', d: 'ארון חשמל פתוח', s: 'סגור', cd: day(31), o: 'רוני', sd: day(50), ts: ago(31) },
      // not due: closed only yesterday — too early to judge
      { id: 'young', num: 'NCR-104', d: 'שילוט דהוי', s: 'סגור', cd: day(1), o: 'דני', sd: day(10), ts: ago(1) },
      // not due: already verified
      { id: 'done', num: 'NCR-105', d: 'דליפה', s: 'סגור', cd: day(90), verified_by: 'admin', verified_at: ago(60), verification_notes: 'נבדק', o: 'דני', sd: day(120), ts: ago(90) },
      // not due: still open — there is nothing to verify yet
      { id: 'open', num: 'NCR-106', d: 'מדף עמוס', s: 'פתוח', o: 'דני', sd: day(40), ts: ago(40) },
      // not due: closed, but with no closing date at all
      { id: 'nodate', num: 'NCR-107', d: 'ללא תאריך סגירה', s: 'סגור', cd: null, o: 'דני', sd: day(80), ts: ago(80) },
    ];
    DB.tasks = []; DB.rounds = []; DB.inc = []; DB.near_miss = [];
  });

  console.log('\n1. the queue counts exactly the right rows');
  {
    await seed();
    const r = await page.evaluate(() => ({
      ids: _capaDue().map((x) => x.id),
      ages: _capaDue().map((x) => _capaAge(x)),
      days: CAPA_VERIFY_DAYS,
    }));
    check('the three closed-and-unverified NCRs are in it', r.ids.join() === 'due1,due2,due3', r.ids);
    check('...oldest first, so the worst overdue is on top', r.ages[0] > r.ages[1] && r.ages[1] > r.ages[2], r.ages);
    check('one closed yesterday is NOT in it — too early to judge a fix', r.ids.indexOf('young') < 0, r.ids);
    check('one already verified is NOT in it', r.ids.indexOf('done') < 0, r.ids);
    check('one still open is NOT in it', r.ids.indexOf('open') < 0, r.ids);
    check('one closed with no closing date is NOT in it, rather than counted as ancient', r.ids.indexOf('nodate') < 0, r.ids);
    check('the 30-day threshold is one named constant, not a literal in three places', r.days === 30, r.days);
  }

  console.log('\n2. it appears where the manager actually looks');
  {
    const r = await page.evaluate(() => {
      goPage('dash');
      const t = (g('today-items') || {}).textContent || '';
      return { text: t, hasLine: /אימות אפקטיביות/.test(t), hasCount: /3/.test(t) };
    });
    check('the "today" checklist carries a line about it', r.hasLine, r.text.slice(0, 200));
    check('...and it says how many are waiting', r.hasCount, r.text.slice(0, 200));

    const nav = await page.evaluate(() => {
      const el = [...document.querySelectorAll('#today-items *')].find((x) => /אימות אפקטיביות/.test(x.textContent) && x.onclick);
      if (el) el.click(); else _todayClick('ncrcapa');
      return { page: CUR, filter: window._ncrQuickFilter };
    });
    check('tapping it opens the NCR page with the queue filter on', nav.page === 'ncr' && nav.filter === 'capa', nav);
  }

  console.log('\n3. the filter shows the queue and nothing else');
  {
    const r = await page.evaluate(() => {
      window._ncrQuickFilter = 'capa'; rNcr();
      const tb = g('tb-ncr');
      const txt = tb.textContent;
      return {
        rows: tb.querySelectorAll('tr').length,
        has: ['NCR-101', 'NCR-102', 'NCR-103'].filter((n) => txt.indexOf(n) >= 0),
        hasnt: ['NCR-104', 'NCR-105', 'NCR-106', 'NCR-107'].filter((n) => txt.indexOf(n) >= 0),
        chip: (g('ncr-active-chips') || {}).textContent || '',
        btn: (g('ncr-qf-capa') || {}).style.display,
        btnN: (g('ncr-qf-capa-n') || {}).textContent,
      };
    });
    check('exactly the three queued NCRs are listed', r.rows === 3 && r.has.length === 3, r);
    check('nothing else leaks in', r.hasnt.length === 0, r.hasnt);
    check('an active-filter chip says what is being shown, and can clear it', /ממתינות לאימות/.test(r.chip), r.chip);
    check('the toolbar button is visible and carries the count', r.btn !== 'none' && r.btnN === '3', r);
  }

  console.log('\n4. verifying takes one tap from the row');
  {
    const before = prompts.length;
    const r = await page.evaluate(() => {
      window._ncrQuickFilter = 'capa'; rNcr();
      const btn = [...g('tb-ncr').querySelectorAll('button[data-cid]')];
      return { count: btn.length, ids: btn.map((b) => b.dataset.cid) };
    });
    check('every queued row carries its own ✅ button', r.count === 3 && r.ids.slice().sort().join() === 'due1,due2,due3', r);
    check('...and the queue is ordered oldest-first, the way a queue is worked', r.ids.join() === 'due1,due2,due3', r.ids);

    await page.evaluate(() => { g('tb-ncr').querySelector('button[data-cid="due2"]').click(); });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      rec: (DB.ncr || []).find((x) => x.id === 'due2'),
      upd: window.__upd,
      left: _capaDue().map((x) => x.id),
      btns: [...g('tb-ncr').querySelectorAll('button[data-cid]')].map((b) => b.dataset.cid),
    }));
    check('the verifier was asked what they checked', prompts.length > before, prompts.slice(-1));
    check('the record now names who verified it, when, and what they found', !!(after.rec.verified_by === 'admin' && after.rec.verified_at && after.rec.verification_notes), after.rec);
    check('it was sent to the server', after.upd.length === 1 && after.upd[0].t === 'ncr' && after.upd[0].id === 'due2', after.upd);
    check('it drops out of the queue', after.left.join() === 'due1,due3', after.left);
    check('...and its ✅ button is gone from the list', after.btns.slice().sort().join() === 'due1,due3', after.btns);
  }

  console.log('\n5. the button never appears where it should not');
  {
    const r = await page.evaluate(() => {
      // The ordinary list hides closed NCRs; ask for all of them so every row
      // this test cares about is on screen.
      window._ncrQuickFilter = ''; window._ncrHideClosed = false; rNcr();
      const ids = [...g('tb-ncr').querySelectorAll('button[data-cid]')].map((b) => b.dataset.cid);
      return { ids: ids, rows: g('tb-ncr').querySelectorAll('tr').length };
    });
    check('with closed rows shown, all seven NCRs are listed', r.rows === 7, r.rows);
    check('but only the two still-queued rows offer verification', r.ids.slice().sort().join() === 'due1,due3', r.ids);

    const asManager = await page.evaluate(() => {
      window._currentUser = { username: 'noa', role: 'מנהל' }; _isAdmin = false;
      rNcr();
      const ids = [...g('tb-ncr').querySelectorAll('button[data-cid]')].map((b) => b.dataset.cid);
      const btn = (g('ncr-qf-capa') || {}).style.display;
      window._currentUser = { username: 'admin' }; _isAdmin = true; window._ncrHideClosed = true; rNcr();
      return { ids: ids, btn: btn };
    });
    check('a non-admin sees no verification buttons', asManager.ids.length === 0, asManager.ids);
    check('...and no queue button in the toolbar', asManager.btn === 'none', asManager.btn);
  }

  console.log('\n6. an empty queue leaves the screen alone');
  {
    const r = await page.evaluate(() => {
      DB.ncr.forEach((n) => { if (n.s === 'סגור') { n.verified_by = 'admin'; n.verified_at = new Date().toISOString(); } });
      window._ncrQuickFilter = ''; rNcr(); goPage('dash');
      return {
        queue: _capaDue().length,
        btn: (g('ncr-qf-capa') || {}).style.display,
        today: /אימות אפקטיביות/.test((g('today-items') || {}).textContent || ''),
      };
    });
    check('the queue is empty', r.queue === 0, r.queue);
    check('the toolbar button hides itself', r.btn === 'none', r.btn);
    check('and the "today" list says nothing about it', !r.today, r.today);
  }

  console.log('\n7. the view modal still works, and agrees with the queue');
  {
    const r = await page.evaluate(() => {
      const day = (d) => new Date(Date.now() - d * 864e5).toISOString().split('T')[0];
      DB.ncr = [
        { id: 'v1', num: 'NCR-201', d: 'בדיקה', s: 'סגור', cd: day(60), o: 'דני', sd: day(90), ts: new Date().toISOString() },
        { id: 'v2', num: 'NCR-202', d: 'בדיקה', s: 'סגור', cd: day(5), o: 'דני', sd: day(20), ts: new Date().toISOString() },
      ];
      showView('ncr', 'v1');
      const openDue = (g('view-body') || g('m-view')).innerHTML;
      showView('ncr', 'v2');
      const openYoung = (g('view-body') || g('m-view')).innerHTML;
      return {
        due: /_capaVerify/.test(openDue),
        young: /_capaVerify/.test(openYoung),
        youngWait: /25/.test(openYoung),      // 30 - 5 days left
        queue: _capaDue().map((x) => x.id),
      };
    });
    check('a closed-60-days NCR offers the button in its own view', r.due, r);
    check('a closed-5-days one does not', !r.young, r);
    check('...it says how many days are left instead', r.youngWait, r);
    check('and the queue holds exactly the one the modal offers', r.queue.join() === 'v1', r.queue);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
