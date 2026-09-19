// A trustee's tour used to live only in memory. _truForm held every station,
// every finding and every photo key, and one tap outside the sheet — or an
// incoming call, or the tab being backgrounded — ran _truFormReset() and
// deleted all of it, orphaning the photo blobs already queued in IndexedDB.
// The app had exactly three draft keys and none of them was this form, which
// is the one filled in while walking around a factory.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  let answer = true, prompts = [];
  page.on('dialog', (d) => { prompts.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const boot = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
    DB.trustees = [{ id: 'r1', n: 'מוסא', dep: 'חומר גלם', active: true }];
    DB.trustee_reports = [];
    try { localStorage.removeItem('tfgn_tru_draft_v1'); } catch (e) {}
    Object.keys(_attachUrls).forEach((k) => { if (k.indexOf('tru-ph-') === 0) delete _attachUrls[k]; });
    document.body.classList.add('emp-mode');
    _truFormReset();
  });
  // Fill a two-station tour the way the form does, then snapshot it.
  // Drive it the way the trustee does: tap the chip, tap תקין/ליקוי, then type
  // into the rendered inputs. Setting _truForm directly gets overwritten by
  // _truFormSync, which reads the DOM back into the state — correctly.
  const fillTour = () => page.evaluate(() => {
    _truReport();                               // open a fresh tour
    document.getElementById('tru-loc').value = 'מחסן מרכזי';
    _truFormToggle(5);                          // עמדות כיבוי אש
    _truFormToggle(3);                          // דרכי מילוט
    const k5 = _truFormTask(5).items[0].k, k3 = _truFormTask(3).items[0].k;
    _truFormSetOk(5, k5, false);                // ליקוי — renders the finding box
    _truFormSetOk(3, k3, true);                 // תקין
    const put = (sel, v) => { const el = document.querySelector(sel); if (el) el.value = v; };
    put('[data-tru-loc][data-n="5"][data-k="' + k5 + '"]', 'מטף מזרחי');
    put('[data-tru-f][data-n="5"][data-k="' + k5 + '"]', 'חסרה פלומבה');
    put('[data-tru-loc][data-n="3"][data-k="' + k3 + '"]', 'דלת צפונית');
    _attachUrls[_truPhId(5, k5)] = 'pending:blob-abc';
    _truFormSync();
    return { tasks: Object.keys(_truForm.tasks).length, photo: _attachUrls[_truPhId(5, k5)] };
  });
  const state = () => page.evaluate(() => {
    const t = _truForm.tasks || {};
    return {
      tasks: Object.keys(t).sort(),
      finding: t[5] && t[5].items[0] ? t[5].items[0].f : null,
      station: t[5] && t[5].items[0] ? t[5].items[0].loc : null,
      ok3: t[3] && t[3].items[0] ? t[3].items[0].ok : null,
      loc: document.getElementById('tru-loc').value,
      photos: Object.keys(_attachUrls).filter((k) => k.indexOf('tru-ph-') === 0 && _attachUrls[k]).length,
      photoVal: _attachUrls['tru-ph-5-1'] || null,
    };
  });
  const savedDraft = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('tfgn_tru_draft_v1') || 'null'); } catch (e) { return null; } });

  console.log('\n1. a tour in progress is written down');
  {
    await boot();
    const f = await fillTour();
    check('two stations and a queued photo are in the form', f.tasks === 2 && f.photo === 'pending:blob-abc', f);
    const d = await page.evaluate(() => { const sn = _truDraftSnapshot(); localStorage.setItem('tfgn_tru_draft_v1', JSON.stringify({ snap: sn, ts: Date.now() })); return sn; });
    check('the snapshot carries both tasks', Object.keys(d.form.tasks).sort().join() === '3,5', Object.keys(d.form.tasks));
    check('...the finding text', d.form.tasks['5'].items[0].f === 'חסרה פלומבה', d.form.tasks['5'].items[0]);
    check('...the location typed at the top', d.fields['tru-loc'] === 'מחסן מרכזי', d.fields);
    check('...and the queued photo key, so the IndexedDB blob is not orphaned', Object.keys(d.photos).length === 1 && d.photos[Object.keys(d.photos)[0]] === 'pending:blob-abc', d.photos);
  }

  console.log('\n2. it survives the mis-tap that used to destroy it');
  {
    // closeModal is what an overlay tap calls; the next _truReport resets state
    await page.evaluate(() => { closeModal('m-tru'); _truFormReset(); });
    const wiped = await state();
    check('after the accidental close the in-memory tour really is gone', wiped.tasks.length === 0 && wiped.photos === 0, wiped);
    answer = true; prompts = [];
    await page.evaluate(() => _truReport());
    await page.waitForTimeout(150);
    check('reopening offers to restore it, naming what is in there', /סיור שלא נשלח/.test(prompts[0] || '') && /2 משימות/.test(prompts[0] || '') && /1 תמונות/.test(prompts[0] || ''), prompts[0]);
    const back = await state();
    check('both stations come back', back.tasks.join() === '3,5', back);
    check('the finding text comes back word for word', back.finding === 'חסרה פלומבה' && back.station === 'מטף מזרחי', back);
    check('the תקין mark on the other station comes back', back.ok3 === true, back);
    check('the location comes back', back.loc === 'מחסן מרכזי', back);
    check('and the one real photo is still attached (the empty slots are not photos)', back.photos === 1 && back.photoVal === 'pending:blob-abc', back);
  }

  console.log('\n3. declining throws it away for good');
  {
    await boot();
    await fillTour();
    await page.evaluate(() => { const sn = _truDraftSnapshot(); localStorage.setItem('tfgn_tru_draft_v1', JSON.stringify({ snap: sn, ts: Date.now() })); closeModal('m-tru'); _truFormReset(); });
    answer = false; prompts = [];
    await page.evaluate(() => _truReport());
    await page.waitForTimeout(150);
    const after = await state();
    check('saying no starts a clean tour', after.tasks.length === 0, after);
    check('and the draft is deleted, so it is not offered again', (await savedDraft()) === null);
  }

  console.log('\n4. a draft is never offered for the wrong thing');
  {
    await boot();
    await fillTour();
    await page.evaluate(() => { const sn = _truDraftSnapshot(); localStorage.setItem('tfgn_tru_draft_v1', JSON.stringify({ snap: sn, ts: Date.now() })); closeModal('m-tru'); _truFormReset(); });
    prompts = [];
    await page.evaluate(() => { DB.trustee_reports = [{ id: 'f1', u: 'מוסא', t: 5, d: '2026-09-01', loc: 'מחסן', ok: false, f: 'ממצא', s: 'פתוח' }]; _truCloseReport('f1'); });
    await page.waitForTimeout(150);
    check('closing a finding never offers a tour draft', prompts.length === 0, prompts);
    check('it opens locked on the closure task, as before', await page.evaluate(() => _truForm.lock === true && !!_truForm.tasks[8]), null);
    check('the saved tour is left untouched for later', (await savedDraft()) !== null);
    await page.evaluate(() => { closeModal('m-tru'); _truFormReset(); });
  }

  console.log('\n5. an empty form is not a draft, and a sent tour stops being one');
  {
    await boot();
    prompts = [];
    await page.evaluate(() => { _truReport(); });
    await page.waitForTimeout(100);
    check('opening a fresh form with nothing saved asks nothing', prompts.length === 0, prompts);
    const empty = await page.evaluate(() => _truDraftHasContent(_truDraftSnapshot()));
    check('a form with only the prefilled name and date does not count as a draft', empty === false, empty);
    await fillTour();
    await page.evaluate(() => { localStorage.setItem('tfgn_tru_draft_v1', JSON.stringify({ snap: _truDraftSnapshot(), ts: Date.now() })); });
    check('but a filled station does', (await savedDraft()) !== null);
    await page.evaluate(() => { _truDraftClear(); });
    check('and sending the tour clears it', (await savedDraft()) === null);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
