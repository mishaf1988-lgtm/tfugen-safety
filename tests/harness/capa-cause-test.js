// 1.7  _capaVerify wrote verified_by / verified_at / verification_notes and
//      nothing else, and the gate was `if(rec.verified_by){toast('כבר אומת')}`
//      — the mere existence of a signature meant «passed». So when the
//      corrective action did NOT work there was nowhere to say so. Two moves
//      remained: don't press the button, and the NCR sits in «ממתינות לאימות»
//      for ever looking like neglect; or press it and type «לא עבד» into the
//      free text, after which every screen — including the audit-readiness
//      report an ISO auditor reads — shows it green.
//
//      And with no success criterion recorded when the NCR was closed, the
//      check 30 days later is a memory test, not a measurement. §10.2.1e.
//
// 1.11 «What is your most common root cause?» is a question an ISO audit opens
//      with. ncr.rc is a free-text input and no migration has ever added a
//      category, so with 375 records the answer means reading all of them.
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
    window._currentUser = { username: 'michael' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.sbIns = function () {}; window.sbDel = function () {};
    window.__upd = []; window.sbUpd = function (t, r) { window.__upd.push([t, JSON.parse(JSON.stringify(r))]); };
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.rDash = function () {};
    window.__ago = (n) => new Date(Date.now() - n * 864e5).toISOString().split('T')[0];
  });

  // prompt/confirm are driven per case
  const drive = async (answers) => page.evaluate((a) => {
    window.__asked = [];
    let pi = 0, ci = 0;
    window.prompt = function (m) { window.__asked.push(m); return a.prompts[pi++]; };
    window.confirm = function (m) { window.__asked.push(m); return a.confirms[ci++]; };
  }, answers);

  console.log('\n1.7 «it did not work» can be recorded');
  {
    await drive({ prompts: ['בדקתי 3 סבבים, אין חזרות'], confirms: [true] });
    const ok = await page.evaluate(() => {
      DB.ncr = [{ id: 'n1', num: 'NCR-1', d: 'x', s: 'סגור', cd: __ago(60), success_criteria: 'אפס חזרות ב-3 סבבים' }];
      window.__upd = [];
      _capaVerify('n1');
      const r = DB.ncr[0];
      return { res: r.verification_result, by: r.verified_by, notes: r.verification_notes, asked: window.__asked, toasts: window.__toasts.slice(-1) };
    });
    check('an effective action is recorded as effective', ok.res === 'אפקטיבי', ok);
    check('...still signed and still dated', ok.by === 'michael', ok);
    check('the criterion set at closing time is put in front of the person judging', /אפס חזרות ב-3 סבבים/.test(ok.asked.join('|')), ok.asked);

    await drive({ prompts: ['הבעיה חזרה פעמיים בספטמבר'], confirms: [false, false] });
    const bad = await page.evaluate(() => {
      DB.ncr = [{ id: 'n2', num: 'NCR-2', d: 'x', s: 'סגור', cd: __ago(60) }];
      window.__toasts = [];
      _capaVerify('n2');
      const r = DB.ncr[0];
      return { res: r.verification_result, by: r.verified_by, notes: r.verification_notes, s: r.s, toasts: window.__toasts, asked: window.__asked };
    });
    check('an action that did NOT work is recorded as not effective', bad.res === 'לא אפקטיבי', bad);
    check('...and it is still a completed verification, not a blank', !!bad.by && !!bad.notes, bad);
    check('...and the toast says which of the two happened', /לא הייתה אפקטיבית/.test(bad.toasts.join('|')), bad.toasts);
    check('with no criterion recorded, the prompt says so rather than pretending', /לא נקבע קריטריון/.test(bad.asked.join('|')), bad.asked);
    check('declining to reopen leaves the NCR closed', bad.s === 'סגור', bad);

    await drive({ prompts: ['חזר'], confirms: [false, true] });
    const reopened = await page.evaluate(() => {
      DB.ncr = [{ id: 'n3', num: 'NCR-3', d: 'x', s: 'סגור', cd: __ago(60), notes: '' }];
      _capaVerify('n3');
      const r = DB.ncr[0];
      return { s: r.s, res: r.verification_result, notes: r.notes };
    });
    check('choosing to reopen goes through the reopen path that already exists', reopened.s !== 'סגור', reopened);
    check('...and the ineffective result is kept on the record', reopened.res === 'לא אפקטיבי', reopened);

    // aborting must change nothing at all
    await drive({ prompts: [null], confirms: [] });
    const aborted = await page.evaluate(() => {
      DB.ncr = [{ id: 'n4', num: 'NCR-4', d: 'x', s: 'סגור', cd: __ago(60) }];
      window.__upd = [];
      _capaVerify('n4');
      return { r: DB.ncr[0], sent: window.__upd.length };
    });
    check('backing out of the prompt writes nothing', !aborted.r.verified_by && !aborted.r.verification_result && aborted.sent === 0, aborted);

    // an empty description is still refused
    await drive({ prompts: ['   '], confirms: [true] });
    const blank = await page.evaluate(() => {
      DB.ncr = [{ id: 'n5', num: 'NCR-5', d: 'x', s: 'סגור', cd: __ago(60) }];
      window.__upd = [];
      _capaVerify('n5');
      return { r: DB.ncr[0], sent: window.__upd.length };
    });
    check('a blank description is still refused, as before', !blank.r.verified_by && blank.sent === 0, blank);
  }

  console.log('\n1.7 the record does not show a failure as a success');
  {
    const r = await page.evaluate(() => {
      DB.ncr = [
        { id: 'g1', num: 'NCR-G', d: 'x', s: 'סגור', cd: __ago(60), verified_by: 'michael', verified_at: __ago(1), verification_notes: 'עבד', verification_result: 'אפקטיבי' },
        { id: 'b1', num: 'NCR-B', d: 'x', s: 'סגור', cd: __ago(60), verified_by: 'michael', verified_at: __ago(1), verification_notes: 'חזר', verification_result: 'לא אפקטיבי' },
        { id: 'o1', num: 'NCR-O', d: 'x', s: 'סגור', cd: __ago(60), verified_by: 'michael', verified_at: __ago(1), verification_notes: 'ישן' },
      ];
      showView('ncr', 'g1'); const good = g('view-body').innerHTML;
      showView('ncr', 'b1'); const bad = g('view-body').innerHTML;
      showView('ncr', 'o1'); const old = g('view-body').innerHTML;
      return { good: good, bad: bad, old: old };
    });
    check('an effective one is still green with a tick', /#dcfce7/.test(r.good) && /✅/.test(r.good), r.good.slice(-400));
    check('an ineffective one is NOT green', !/#dcfce7/.test(r.bad), r.bad.slice(-400));
    check('...it is red, and says the action did not work', /#fee2e2/.test(r.bad) && /לא הייתה אפקטיבית/.test(r.bad), r.bad.slice(-400));
    check('a verification recorded before this existed is not called a failure', !/#fee2e2/.test(r.old) && /#dcfce7/.test(r.old), r.old.slice(-400));
  }

  console.log('\n1.7 the criterion is written down and survives');
  {
    const r = await page.evaluate(() => {
      const el = g('ncr-success-criteria');
      if (!el) return { field: false };
      DB.ncr = []; NCRI = 90;
      openNewNcrModal();
      g('ncr-d').value = 'דלת אש חסומה';
      g('ncr-rc').value = 'המלגזן משאיר משטחים במעבר';
      g('ncr-rc-cat').value = 'אדם';
      g('ncr-success-criteria').value = 'אפס חסימות ב-3 סבבים רצופים';
      g('ncr-c').value = 'סימון רצפה + תדריך';
      g('ncr-o').value = 'יוסי';
      svNcr();
      const rec = DB.ncr[0] || {};
      return { field: true, sc: rec.success_criteria, cat: rec.rc_cat, id: rec.id };
    });
    check('the form asks how we will know the action worked', r.field, r);
    check('...and the answer is saved on the record', r.sc === 'אפס חסימות ב-3 סבבים רצופים', r);
    check('...and so is the cause category', r.cat === 'אדם', r);

    const back = await page.evaluate((id) => {
      // svNcr does not blank the form, so without this the fields still hold
      // what was typed and «loads them back» passes without loading anything.
      g('ncr-success-criteria').value = ''; g('ncr-rc-cat').value = '';
      editNcr(id);
      return { sc: g('ncr-success-criteria').value, cat: g('ncr-rc-cat').value };
    }, r.id);
    check('editing the record loads them back rather than blanking them', back.sc === 'אפס חסימות ב-3 סבבים רצופים' && back.cat === 'אדם', back);

    const draft = await page.evaluate(() => ({
      sc: _NCR_DRAFT_FIELDS.indexOf('ncr-success-criteria') >= 0,
      cat: _NCR_DRAFT_FIELDS.indexOf('ncr-rc-cat') >= 0,
    }));
    check('an abandoned draft keeps them too', draft.sc && draft.cat, draft);

    const view = await page.evaluate(() => {
      const f = VIEW_CONFIG.ncr.fields.map((x) => x[1]);
      return { sc: f.indexOf('success_criteria') >= 0, res: f.indexOf('verification_result') >= 0, cat: f.indexOf('rc_cat') >= 0 };
    });
    check('all three appear on the record, the print and the PDF', view.sc && view.res && view.cat, view);
  }

  console.log('\n1.11 «what is our most common cause» is answerable from the screen');
  {
    const r = await page.evaluate(() => {
      DB.ncr = [
        { id: 'a', num: 'NCR-1', d: 'x', s: 'פתוח', sd: __ago(5), rc_cat: 'נוהל' },
        { id: 'b', num: 'NCR-2', d: 'x', s: 'פתוח', sd: __ago(6), rc_cat: 'נוהל' },
        { id: 'c', num: 'NCR-3', d: 'x', s: 'פתוח', sd: __ago(7), rc_cat: 'נוהל' },
        { id: 'd', num: 'NCR-4', d: 'x', s: 'פתוח', sd: __ago(8), rc_cat: 'אדם' },
        { id: 'e', num: 'NCR-5', d: 'x', s: 'פתוח', sd: __ago(9) },
      ];
      window._ncrCauseFilter = ''; window._ncrQuickFilter = ''; window._ncrLocFilter = '';
      if (typeof ncrTab === 'function') ncrTab('all');
      rNcr();
      const sum = g('ncr-summary').innerHTML;
      const counts = _ncrCauseCounts(DB.ncr);
      return { sum: sum, top: counts.list[0], n: counts.map['נוהל'], none: DB.ncr.length - counts.n };
    });
    check('the breakdown is on the page, not in a report nobody runs', /נוהל/.test(r.sum) && /אדם/.test(r.sum), r.sum.slice(0, 500));
    check('the most common cause comes first', r.top === 'נוהל' && r.n === 3, r);
    check('records nobody has classified are shown, not quietly dropped', /ללא סיווג/.test(r.sum) && r.none === 1, r);

    const filtered = await page.evaluate(() => {
      ncrCauseFilter('נוהל');
      const rows = Array.from(g('tb-ncr').querySelectorAll('tr'));
      return { n: rows.length, sum: g('ncr-summary').innerHTML, chips: (g('ncr-chips') || {}).innerHTML || document.body.innerHTML.indexOf('ncrCauseFilter') > 0 };
    });
    check('pressing a cause filters the list to it', filtered.n === 3, filtered.n);
    check('...and the other causes stay visible, so there is a way back', /אדם/.test(filtered.sum), filtered.sum.slice(0, 500));

    const cleared = await page.evaluate(() => {
      ncrCauseFilter('נוהל');                       // pressing the same one again
      const a = g('tb-ncr').querySelectorAll('tr').length;
      ncrCauseFilter('אדם');
      const b = g('tb-ncr').querySelectorAll('tr').length;
      ncrClearAll();
      return { off: a, other: b, after: window._ncrCauseFilter };
    });
    check('pressing it again turns the filter off', cleared.off === 5, cleared);
    check('another cause filters to that one', cleared.other === 1, cleared);
    check('«clear all» clears this filter too', !cleared.after, cleared);
  }

  console.log('\nthe priority spelled the way the form spells it');
  {
    const r = await page.evaluate(() => {
      const opts = Array.from(g('ncr-p').options).map((o) => o.textContent);
      DB.ncr = [
        { id: 'h', num: 'NCR-H', d: 'x', s: 'פתוח', sd: __ago(5), p: opts[2] },
        { id: 'l', num: 'NCR-L', d: 'x', s: 'פתוח', sd: __ago(4), p: opts[0] },
      ];
      window._ncrCauseFilter = ''; window._ncrQuickFilter = '';
      if (typeof ncrTab === 'function') ncrTab('all');
      rNcr();
      const rows = Array.from(g('tb-ncr').querySelectorAll('tr')).map((tr) => tr.textContent);
      return { opts: opts, sum: g('ncr-summary').innerHTML, first: rows[0] };
    });
    check('the high-priority pill counts the option the form actually offers', /גבוה פתוח: <strong>1/.test(r.sum), { opt: r.opts[2], sum: r.sum.slice(0, 600) });
    check('...and a high-priority NCR sorts above a low one instead of level with it', /NCR-H/.test(r.first || ''), r.first);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
