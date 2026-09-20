// 3.3  Renewing a certificate overwrote what it replaced. _svPut does
//      `arr[k]=Object.assign({},arr[k],r)`, so Michael opens ✎ on a training
//      record, changes the date, saves — and the previous expiry is gone.
//      audit_log can show that somebody updated TR-17 on 3/9; it cannot show
//      what the validity was before, or when the previous training happened.
//      Equipment already has a renewal path that keeps history, but it runs
//      only from the PDF flow, never from svEqi and never for the rest.
//
// 6.11 _mrAINarrative builds the whole §9.3 narrative and then does one thing
//      with it: `window._mrAIRaw=content`. A JS variable, until reload. The
//      two buttons are «regenerate» and «copy». So the management review —
//      which §9.3.3 requires be RETAINED as documented information — lived in
//      the clipboard of whoever pressed copy, until they copied something else.
//
// 4.5  A trustee closes their own finding by photographing the fix, and the
//      points ride on that. That is Michael's explicit decision (DECISIONS.md
//      2026-09-18 §3) and none of it changes. What was missing is the second
//      pair of eyes: no verification field exists anywhere in the schema, so
//      «נסגר» means «a trustee photographed a fix», not «somebody checked».
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
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.__ins = []; window.sbIns = function (t, r) { window.__ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.__upd = []; window.sbUpd = function (t, r) { window.__upd.push([t, JSON.parse(JSON.stringify(r))]); };
    window.sbDel = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.rDash = function () {};
  });
  const drive = async (a) => page.evaluate((x) => {
    window.__asked = []; let pi = 0, ci = 0;
    window.prompt = function (m) { window.__asked.push(m); return x.prompts[pi++]; };
    window.confirm = function (m) { window.__asked.push(m); return x.confirms[ci++]; };
  }, a);

  console.log('\n3.3 a renewal keeps what it replaced');
  {
    await drive({ prompts: ['2026-09-01', '2027-09-01'], confirms: [] });
    const r = await page.evaluate(() => {
      DB.record_history = [];
      DB.tr = [{ id: 't1', w: 'דני', n: 'עבודה בגובה', d: '2025-09-01', e: '2026-09-01' }];
      window.__ins = []; window.__upd = [];
      _renewRecord('tr', 't1');
      const rec = DB.tr[0];
      const h = (DB.record_history || [])[0] || {};
      return {
        d: rec.d, e: rec.e,
        hOldE: h.e_old, hNewE: h.e_new, hOldD: h.d_old, by: h.changed_by, tbl: h.table_name, rid: h.record_id,
        ins: window.__ins.map((x) => x[0]), upd: window.__upd.map((x) => x[0]),
        asked: window.__asked,
      };
    });
    check('the record moves forward', r.d === '2026-09-01' && r.e === '2027-09-01', r);
    check('the expiry it replaced is kept, which is the whole point', r.hOldE === '2026-09-01', r);
    check('...along with when the previous training actually happened', r.hOldD === '2025-09-01', r);
    check('...and what it became', r.hNewE === '2027-09-01', r);
    check('the history row names the record it belongs to', r.tbl === 'tr' && r.rid === 't1', r);
    check('...and who renewed it', r.by === 'admin', r);
    check('the history is written before the record is changed', r.ins[0] === 'record_history', r);
    check('the old dates are shown in the prompts, so nothing is typed blind', /01\/09\/2025/.test(r.asked.join('|')) && /01\/09\/2026/.test(r.asked.join('|')), r.asked);

    const shown = await page.evaluate(() => {
      showView('tr', 't1');
      return { html: g('view-body').innerHTML, hist: !!g('renew-history') };
    });
    check('the record shows its renewal history', shown.hist && /01\/09\/2026/.test(shown.html), shown.html.slice(-500));
    check('...and offers to renew rather than only to edit', /_renewRecord/.test(shown.html), shown.html.slice(-700));

    await drive({ prompts: [null], confirms: [] });
    const aborted = await page.evaluate(() => {
      DB.record_history = []; window.__ins = []; window.__upd = [];
      DB.tr = [{ id: 't2', n: 'x', d: '2025-01-01', e: '2026-01-01' }];
      _renewRecord('tr', 't2');
      return { e: DB.tr[0].e, hist: (DB.record_history || []).length, ins: window.__ins.length };
    });
    check('backing out writes neither a history row nor a change', aborted.e === '2026-01-01' && aborted.hist === 0 && aborted.ins === 0, aborted);

    await drive({ prompts: ['01/09/2026', ''], confirms: [] });
    const badFmt = await page.evaluate(() => {
      DB.record_history = []; window.__ins = [];
      DB.tr = [{ id: 't3', n: 'x', d: '2025-01-01', e: '2026-01-01' }];
      _renewRecord('tr', 't3');
      return { d: DB.tr[0].d, hist: (DB.record_history || []).length };
    });
    check('a malformed date is refused before anything is written', badFmt.d === '2025-01-01' && badFmt.hist === 0, badFmt);

    const hearing = await page.evaluate(() => {
      // the audiometric register calls its date test_date, not d
      DB.record_history = [];
      DB.hearing_tests = [{ id: 'h1', emp_name: 'רונית', test_date: '2025-05-01', e: '2026-05-01' }];
      return _rhDoneField('hearing_tests');
    });
    check('each register is renewed on the date column it actually uses', hearing === 'test_date', hearing);

    await drive({ prompts: ['2026-05-01', '2027-05-01'], confirms: [] });
    const hr = await page.evaluate(() => {
      _renewRecord('hearing_tests', 'h1');
      const h = (DB.record_history || [])[0] || {};
      return { td: DB.hearing_tests[0].test_date, old: h.d_old };
    });
    check('...so a hearing test renews its test_date, not a field it has not got', hr.td === '2026-05-01' && hr.old === '2025-05-01', hr);

    // Valid answers queued, so if the «is this renewable» guard were gone the
    // renewal would go through — which is exactly what must not happen.
    await drive({ prompts: ['2026-01-01', '2027-01-01'], confirms: [] });
    const noGo = await page.evaluate(() => {
      window.__toasts = [];
      DB.record_history = [];
      // the record has to exist, or the id lookup refuses it before the
      // «is this renewable at all» guard is ever reached
      DB.ncr = [{ id: 'n-real', num: 'NCR-1', d: 'x', e: '2026-01-01' }];
      _renewRecord('ncr', 'n-real');
      return { hist: (DB.record_history || []).length, t: window.__toasts };
    });
    check('a record type with no renewal concept is refused', noGo.hist === 0, noGo);
  }

  console.log('\n6.11 the management review stops living in the clipboard');
  {
    const r = await page.evaluate(() => {
      DB.mgmt_reviews = [];
      window._mrAIRaw = 'סקירת הנהלה: 4 חלקים, מסקנות והחלטות.';
      window.__ins = [];
      _mrSaveReview('review');
      const rec = (DB.mgmt_reviews || [])[0] || {};
      return { n: DB.mgmt_reviews.length, kind: rec.kind, content: rec.content, by: rec.created_by, ins: window.__ins.map((x) => x[0]), id: rec.id };
    });
    check('the narrative is kept as a record', r.n === 1 && /4 חלקים/.test(r.content || ''), r);
    check('...marked as a periodic review', r.kind === 'review', r);
    check('...with who produced it', r.by === 'admin', r);
    check('...and it goes to the server, not only into memory', r.ins.indexOf('mgmt_reviews') >= 0, r);

    const annual = await page.evaluate(() => {
      window._annualISORaw = 'דוח שנתי לסקירת הסמכה';
      _mrSaveReview('annual');
      const rec = (DB.mgmt_reviews || []).find((x) => x.kind === 'annual') || {};
      return { kind: rec.kind, period: rec.period, content: rec.content };
    });
    check('the annual report is kept too, and told apart from the review', annual.kind === 'annual' && /דוח שנתי/.test(annual.content || ''), annual);
    check('...with the year on it', /^\d{4}$/.test(annual.period || ''), annual.period);

    const empty = await page.evaluate(() => {
      window._mrAIRaw = '';
      const before = DB.mgmt_reviews.length;
      window.__toasts = [];
      _mrSaveReview('review');
      return { before: before, after: DB.mgmt_reviews.length, t: window.__toasts };
    });
    check('with nothing generated there is nothing to save, and it says so', empty.after === empty.before && /אין מה לשמור/.test(empty.t.join('|')), empty);

    const list = await page.evaluate(() => {
      _mrReviewsRender();
      return g('mr-saved-list').innerHTML;
    });
    check('the page lists what has been kept', /סקירה תקופתית/.test(list) && /דוח שנתי/.test(list), list.slice(0, 400));
    check('...each openable and printable like any other record', /showView\(/.test(list) && /printReport\(/.test(list), list.slice(0, 400));

    const cfg = await page.evaluate(() => ({
      view: !!VIEW_CONFIG.mgmt_reviews,
      prot: !!_DEL_PROTECTED.mgmt_reviews,
      hist: !!_DEL_PROTECTED.record_history,
      backup: _BACKUP_TABLES.indexOf('mgmt_reviews') >= 0 && _BACKUP_TABLES.indexOf('record_history') >= 0,
    }));
    check('it can be opened as a record', cfg.view, cfg);
    check('deleting documented information takes the password gate', cfg.prot && cfg.hist, cfg);
    check('...and both tables are in the backup', cfg.backup, cfg);

    const emptyList = await page.evaluate(() => {
      DB.mgmt_reviews = [];
      _mrReviewsRender();
      return g('mr-saved-list').textContent;
    });
    check('with none kept it says how to keep one, rather than sitting blank', /שמור לתיק/.test(emptyList), emptyList);
  }

  console.log('\n4.5 a closed finding says whether anyone checked it');
  {
    const r = await page.evaluate(() => {
      const m = new Date().toISOString().substring(0, 7);
      DB.trustee_reports = [
        { id: 'r1', u: 'דני', m: m, t: 1, d: m + '-05', loc: 'ייצור', f: 'מגן הוסר', ok: false, s: 'נסגר' },
        { id: 'r2', u: 'רונית', m: m, t: 1, d: m + '-06', loc: 'מעבדה', f: 'שמן על הרצפה', ok: false, s: 'נסגר', verified_by: 'admin', verified_at: m + '-07T08:00:00Z' },
        { id: 'r3', u: 'יוסי', m: m, t: 1, d: m + '-07', loc: 'אחזקה', f: 'כבל חשוף', ok: false, s: 'פתוח' },
      ];
      _truMgrF = 'all';
      rTrustees();
      return { html: g('tb-trustees') ? g('tb-trustees').innerHTML : document.body.innerHTML, unver: _truUnverified(m).map((x) => x.id) };
    });
    check('a closed finding nobody checked is marked «טרם נבדק»', /טרם נבדק/.test(r.html), r.html.slice(0, 900));
    check('...and one that was checked is marked differently', /נבדק<\/span>|✔/.test(r.html), r.html.slice(0, 900));
    check('the unverified list is exactly the closed-but-unchecked ones', r.unver.join() === 'r1', r.unver);

    const filtered = await page.evaluate(() => {
      _truMgrSetFilter('unver');
      const tb = g('tb-trustees');
      const rows = tb ? Array.from(tb.querySelectorAll('tr')) : [];
      return { n: rows.length, txt: rows.map((x) => x.textContent).join('|'), sum: g('tru-mgr-summary').innerHTML };
    });
    check('there is a filter for «closed, not yet checked»', /נסגרו, טרם נבדקו/.test(filtered.sum), filtered.sum.slice(0, 600));
    check('...and it shows only those', filtered.n === 1 && /מגן הוסר/.test(filtered.txt), filtered);

    await drive({ prompts: [], confirms: [true] });
    const verified = await page.evaluate(() => {
      window.__upd = [];
      _truVerifyClose('r1');
      const rec = DB.trustee_reports.find((x) => x.id === 'r1');
      return { by: rec.verified_by, at: !!rec.verified_at, s: rec.s, upd: window.__upd.length };
    });
    check('confirming records who checked it', verified.by === 'admin' && verified.at, verified);
    check('...and does not touch the status the trustee set', verified.s === 'נסגר', verified);

    await drive({ prompts: [], confirms: [false] });
    const declined = await page.evaluate(() => {
      DB.trustee_reports.find((x) => x.id === 'r1').verified_by = null;
      window.__upd = [];
      _truVerifyClose('r1');
      const rec = DB.trustee_reports.find((x) => x.id === 'r1');
      return { by: rec.verified_by, upd: window.__upd.length };
    });
    check('saying no records nothing', !declined.by && declined.upd === 0, declined);

    await drive({ prompts: [], confirms: [true] });
    const stillOpen = await page.evaluate(() => {
      window.__toasts = []; window.__upd = [];
      _truVerifyClose('r3');                       // still open
      const rec = DB.trustee_reports.find((x) => x.id === 'r3');
      return { by: rec.verified_by, t: window.__toasts, upd: window.__upd.length };
    });
    check('a finding that is still open cannot be signed off as checked', !stillOpen.by && stillOpen.upd === 0, stillOpen);

    // Michael's decision stands: the trustee still closes their own finding,
    // and the points still ride on the close, not on the verification.
    const scoring = await page.evaluate(() => {
      const m = new Date().toISOString().substring(0, 7);
      DB.trustee_reports = [
        { id: 'a', u: 'דני', m: m, t: 1, d: m + '-05', loc: 'x', f: 'a', ok: false, s: 'נסגר' },
        { id: 'b', u: 'רונית', m: m, t: 1, d: m + '-05', loc: 'x', f: 'b', ok: false, s: 'נסגר', verified_by: 'admin' },
      ];
      const board = _truBoard(m);
      const dani = board.find((x) => x.u === 'דני') || {};
      const ron = board.find((x) => x.u === 'רונית') || {};
      return { dani: dani.total, ron: ron.total };
    });
    check('verification does not change the score — the trustee still closes their own', scoring.dani === scoring.ron, scoring);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
