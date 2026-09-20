// Six things about the compliance registers. Four of them are about evidence
// that the system asks an auditor to believe without being able to show it.
//
// 3.4  `med` was in the calendar, in the 30-day notification, in the
//      management review and in the ISO §9.1 report — and not in VIEW_CONFIG
//      and not on the expiry page. So a scanned medical check raised a yellow
//      dot and an alert, and clicking it answered «טבלה med אינה נתמכת».
//      The ISO report counted it; Michael could not open it.
//
// 3.6  recur_count / recur_unit were decoration. Nothing in the repo ever
//      advanced next_due, and the virtual task the type produces has no
//      "done". So a yearly check appeared 30 days early and stayed for ever:
//      «פג ב-1 ימים», «פג ב-77 ימים», long after it had been carried out.
//
// 3.8  svDoc wrote `id: gid()` unconditionally — alone among the save
//      functions — and `docs` was not in _EDIT_MODS, so there was no ✎ at all.
//      A typo in a document name could only be fixed by deleting and
//      retyping, which changes the id and breaks every reference. And the ISO
//      procedure itself — the signed document — could not be attached, even
//      though the form has an OCR button that reads it and throws the image away.
//
// 3.9  Same for the PPE periodic-inspection certificate and the contractor's
//      insurance / agreement / training certificate. Both registers are
//      scanned by the expiry page, so they warn on time — without the evidence.
//
// 3.10 VIEW_CONFIG.tr labelled `c` as «מדריך». `c` is the category. The PDF
//      that goes into the employee's file said «מדריך: כיבוי אש».
//
// 3.12 The expiry page aggregates six registers and every empty tab said
//      🔧 «אין בדיקות ציוד» with a button that opens a new equipment
//      inspection. Pressing «פג» to confirm nothing has expired — the good
//      case — read as a warning that the register is empty.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

let ACCEPT = true, DIALOGS = [];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', async (d) => { DIALOGS.push(d.message()); await (ACCEPT ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t: t, r: JSON.parse(JSON.stringify(r)) }); };
    window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    // signing answers, so _attachRender's preview resolves like it does live
    window._sbAuth = function () { return Promise.resolve(); }; window._sbToken = 'tok';
    window.fetch = function (u) {
      const m = String(u).match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
      const body = m ? { signedURL: '/object/sign/' + m[1] + '/' + m[2] + '?token=S' } : {};
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
    };
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    window.__blankReg = function () {
      ['docs', 'tr', 'ppe', 'ctr', 'equip_inspections', 'med', 'inspection_types', 'tasks'].forEach((t) => { DB[t] = []; });
    };
  });

  const CERT = 'https://znhjtpcltrxxyfjczgvw.supabase.co/storage/v1/object/public/incidents-photos/doc-1758-iso.pdf';

  console.log('\n3.4 a medical check the system alerts on can now be opened');
  {
    const r = await page.evaluate(() => {
      __blankReg();
      DB.med = [
        { id: 'm1', n: 'מוסא עלי', t: 'בדיקה רפואית', d: __iso(-300), e: __iso(12), file_url: null },
        { id: 'm2', n: 'דנה לוי', t: 'בדיקת ראייה', d: __iso(-100), e: null },
      ];
      window._expFilter = 'all';
      goPage('exp');
      const html = (g('tb-exp') || {}).innerHTML || '';
      return {
        collected: _expCollect().filter((x) => x.mod === 'med').map((x) => x.id),
        noDate: _expNoDate().filter((x) => x.mod === 'med').map((x) => x.id),
        named: /מוסא עלי/.test(html),
        labelled: /בדיקה רפואית/.test(html),
        undated: /דנה לוי/.test(html),
      };
    });
    check('a dated medical check is on the expiry page', r.collected.join() === 'm1', r.collected);
    check('an undated one is in the «ללא תאריך» set, not silently dropped', r.noDate.join() === 'm2', r.noDate);
    check('the row names the person', r.named, r);
    check('and says it is a medical check', r.labelled, r);

    const view = await page.evaluate(() => {
      window.__toasts = [];
      showView('med', 'm1');
      return {
        supported: !!VIEW_CONFIG.med,
        text: (g('view-body') || {}).textContent || '',
        toasts: window.__toasts,
        photoKey: VIEW_CONFIG.med && VIEW_CONFIG.med.photo,
      };
    });
    check('showView(\'med\') is supported at all — it used to refuse', view.supported, view.supported);
    check('...and does not toast «אינה נתמכת»', !view.toasts.join('|').match(/נתמכת/), view.toasts);
    check('the sheet shows who and what', /מוסא עלי/.test(view.text) && /בדיקה רפואית/.test(view.text), view.text.slice(0, 200));
    check('...and the expiry date', /תוקף עד/.test(view.text), view.text.slice(0, 200));
    check('the scanned certificate is wired through, since Smart Capture saves one', view.photoKey === 'file_url', view.photoKey);

    // Was a regex over the source for the literal table list, which broke the
    // moment 3.5 added hearing_tests to it (#681). What it meant to assert is
    // that a med row reaches the calendar, so assert that instead.
    const cal = await page.evaluate(() => {
      const d = new Date(Date.now() + 5 * 864e5);
      const iso = d.toISOString().split('T')[0];
      DB.med = [{ id: 'm-cal', t: 'מוסא עלי', e: iso }];
      const got = _calCollect(d.getFullYear(), d.getMonth());
      return Object.keys(got).some((k) => (got[k] || []).some((i) => i.tbl === 'med' && i.id === 'm-cal'));
    });
    check('the calendar still collects med — this is the click that used to dead-end', cal, cal);
  }

  console.log('\n3.6 a recurring inspection type moves on when it is done');
  {
    const r = await page.evaluate(() => ({
      year: _itpNextDue('2026-09-01', 1, 'year'),
      twoYear: _itpNextDue('2026-09-01', 2, 'year'),
      month: _itpNextDue('2026-09-30', 1, 'month'),
      endOfMonth: _itpNextDue('2026-01-31', 1, 'month'),     // not 3 March
      leap: _itpNextDue('2027-01-31', 1, 'month'),           // 2028 is the leap year
      week: _itpNextDue('2026-09-01', 2, 'week'),
      day: _itpNextDue('2026-09-01', 10, 'day'),
      bad: _itpNextDue('', 1, 'year'),
      zero: _itpNextDue('2026-09-01', 0, 'year'),
    }));
    check('a yearly cycle moves a year', r.year === '2027-09-01', r);
    check('«every 2 years» moves two', r.twoYear === '2028-09-01', r);
    check('a monthly cycle moves a month', r.month === '2026-10-30', r);
    check('31 January plus a month is the end of February, not 3 March', r.endOfMonth === '2026-02-28', r);
    check('...and in a non-leap year too', /^2027-02-2[89]$/.test(r.leap), r.leap);
    check('weeks and days work as well', r.week === '2026-09-15' && r.day === '2026-09-11', r);
    check('an unreadable date returns null rather than NaN', r.bad === null, r.bad);
    check('a count of 0 does not freeze the date in place', r.zero === '2027-09-01', r.zero);

    DIALOGS = []; ACCEPT = true;
    const done = await page.evaluate(() => {
      __blankReg();
      DB.inspection_types = [
        { id: 'i1', name: 'בדיקת מערכת גילוי אש', recur_count: 1, recur_unit: 'year', next_due: __iso(-20), active: true },
      ];
      window.__upd = [];
      goPage('itp');
      const before = (g('itp-list') || {}).innerHTML || '';
      _itpDone('i1');
      return { before: before, due: DB.inspection_types[0].next_due, upd: window.__upd.length, today: __iso(0), planned: _itpNextDue(__iso(-20), 1, 'year') };
    });
    await page.waitForTimeout(120);
    check('the list has a «בוצע» control — the only way to move the date was ✎ and retype', /_itpDone\(/.test(done.before), done.before.slice(0, 400));
    check('the manager is told what the new date will be before agreeing', /\d{2}\/\d{2}\/\d{4}/.test(DIALOGS[0] || ''), DIALOGS[0]);
    check('the next date moves into the future', done.due > done.today, done);
    check('...one cycle on from the date that was planned — 20 days late is still inside the year', done.due === done.planned, done);
    check('and it is sent to the server', done.upd === 1, done.upd);

    // Missed by more than a whole cycle: counting from the planned date would
    // produce another date in the past, and the row would stay red for ever.
    const longGone = await page.evaluate(() => {
      DB.inspection_types = [{ id: 'i9', name: 'כיול', recur_count: 1, recur_unit: 'month', next_due: __iso(-400), active: true }];
      _itpDone('i9');
      return { due: DB.inspection_types[0].next_due, today: __iso(0), naive: _itpNextDue(__iso(-400), 1, 'month') };
    });
    await page.waitForTimeout(80);
    check('a check missed by 400 days lands in the FUTURE, not one month after the missed date', longGone.due > longGone.today, longGone);
    check('...which the naive calculation would not have done', longGone.naive < longGone.today, longGone);

    const onTime = await page.evaluate(() => {
      DB.inspection_types = [{ id: 'i2', name: 'כיול גלאים', recur_count: 3, recur_unit: 'month', next_due: __iso(5), active: true }];
      _itpDone('i2');
      return { due: DB.inspection_types[0].next_due, from: __iso(5) };
    });
    await page.waitForTimeout(80);
    check('done early: the cycle counts from the planned date, not from today', onTime.due === (function () { const d = new Date(onTime.from); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 3); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return d.toISOString().substring(0, 10); })(), onTime);

    DIALOGS = []; ACCEPT = false;
    const declined = await page.evaluate(() => {
      DB.inspection_types = [{ id: 'i3', name: 'x', recur_count: 1, recur_unit: 'year', next_due: __iso(-3), active: true }];
      _itpDone('i3');
      return DB.inspection_types[0].next_due;
    });
    await page.waitForTimeout(80);
    check('saying no leaves the date alone', declined === await page.evaluate(() => __iso(-3)), declined);

    const gone = await page.evaluate(() => {
      DB.inspection_types = [{ id: 'i4', name: 'גלאים', recur_count: 1, recur_unit: 'year', next_due: __iso(-3), active: true }];
      DB.tasks = [];
      const before = _collectVirtualTasks().filter((t) => t.source_id === 'i4').length;
      DB.inspection_types[0].next_due = _itpNextDue(__iso(0), 1, 'year');
      const after = _collectVirtualTasks().filter((t) => t.source_id === 'i4').length;
      return { before: before, after: after };
    });
    check('and the overdue virtual task disappears from the task list once it has', gone.before === 1 && gone.after === 0, gone);
  }

  console.log('\n3.8 a document can be corrected, and can carry the document');
  {
    const r = await page.evaluate((cert) => {
      __blankReg();
      DB.docs = [{ id: 'd1', n: 'נוהל עבודה בגובה', c: 'נהלים', v: '1.0', o: 'מיכאל', u: '2026-01-01', e: '2027-01-01', s: 'בתוקף', i: 'ISO 45001:2018', nt: '', file_url: cert }];
      window.__ins = []; window.__upd = [];
      return { editable: _editableTbl('docs'), attachKey: _EDIT_MODS.docs && _EDIT_MODS.docs.attach, hasArea: !!g('doc-attach-area') };
    }, CERT);
    check('the documents register is editable at all', r.editable, r);
    check('the form has an attachment area', r.hasArea, r);
    check('...and _EDIT_MODS knows about it, so ✎ restores the file', r.attachKey === 'doc-attach-area', r);

    const edited = await page.evaluate(() => {
      _genEdit('docs', 'd1');
      const restored = _attachUrls['doc-attach-area'];
      const areaHtml = (g('doc-attach-area') || {}).innerHTML || '';
      g('d-e').value = '2028-01-01';                 // the ordinary edit: a new expiry
      svDoc();
      return {
        restored: restored, areaHtml: areaHtml,
        rows: DB.docs.length, id: DB.docs[0].id, e: DB.docs[0].e,
        file_url: DB.docs[0].file_url, n: DB.docs[0].n,
        ins: window.__ins.length, upd: window.__upd.length,
      };
    });
    check('✎ restores the attached file', edited.restored === CERT, edited.restored);
    check('the open form offers to remove it', /_attachClear/.test(edited.areaHtml), edited.areaHtml.slice(0, 160));
    check('saving is an UPDATE — it used to create a second row every time', edited.rows === 1 && edited.id === 'd1', edited);
    check('...an update, not an insert', edited.upd === 1 && edited.ins === 0, edited);
    check('the new expiry is saved', edited.e === '2028-01-01', edited.e);
    check('and the signed procedure survives the edit', edited.file_url === CERT, edited.file_url);

    const fresh = await page.evaluate(() => {
      DB.docs = []; window.__ins = [];
      _svEditing.docs = null;
      g('d-n').value = 'תעודת ISO 14001';
      _attachUrls['doc-attach-area'] = 'https://x/iso14001.pdf';
      svDoc();
      return { rows: DB.docs.length, file_url: DB.docs[0].file_url, ins: window.__ins.length, left: _attachUrls['doc-attach-area'] };
    });
    check('a brand-new document is still an insert', fresh.rows === 1 && fresh.ins === 1, fresh);
    check('...and carries its file', fresh.file_url === 'https://x/iso14001.pdf', fresh);
    check('the area is cleared afterwards, so the next document does not inherit it', !fresh.left, fresh.left);
    check('the view sheet and the PDF know where the file is', await page.evaluate(() => VIEW_CONFIG.docs.photo) === 'file_url');
  }

  console.log('\n3.9 PPE and contractors can carry the certificate they are judged on');
  {
    const r = await page.evaluate(() => ({
      ppeArea: !!g('ppe-attach-area'), ctrArea: !!g('ctr-attach-area'),
      ppeCfg: _EDIT_MODS.ppe && _EDIT_MODS.ppe.attach, ctrCfg: _EDIT_MODS.ctr && _EDIT_MODS.ctr.attach,
      ppePhoto: VIEW_CONFIG.ppe.photo, ctrPhoto: VIEW_CONFIG.ctr.photo,
    }));
    check('the PPE form has an attachment area', r.ppeArea && r.ppeCfg === 'ppe-attach-area', r);
    check('so does the contractor form', r.ctrArea && r.ctrCfg === 'ctr-attach-area', r);
    check('and both view sheets show the file', r.ppePhoto === 'file_url' && r.ctrPhoto === 'file_url', r);

    const saved = await page.evaluate(() => {
      __blankReg();
      _svEditing.ppe = null; _svEditing.ctr = null;
      window.__ins = [];
      g('ppe-ty').value = 'אחר';   // ppe-ty is a <select>; a value with no option stays ''
      g('ppe-w').value = 'דני'; g('ppe-e').value = '2027-06-01';
      _attachUrls['ppe-attach-area'] = 'https://x/harness-cert.pdf';
      svPpe();
      g('ctr-n').value = 'אלקטרו-מור'; g('ctr-e').value = '2027-03-01';
      _attachUrls['ctr-attach-area'] = 'https://x/insurance.pdf';
      svCtr();
      return { ppe: DB.ppe[0], ctr: DB.ctr[0] };
    });
    check('the harness certificate is saved with the PPE record', saved.ppe.file_url === 'https://x/harness-cert.pdf', saved.ppe);
    check('the insurance certificate is saved with the contractor', saved.ctr.file_url === 'https://x/insurance.pdf', saved.ctr);

    // ty is «רתמה» — free text, the way Smart Capture writes it from a file
    // name. It is not one of the <select>'s options, which used to make ✎
    // unusable: the select refused the value, read as empty, and svPpe bailed
    // on «יש לבחור» about a field that looked filled in.
    const kept = await page.evaluate(() => {
      DB.ppe = [{ id: 'p1', ty: 'רתמה', w: 'דני', e: '2027-01-01', c: 'תקין', file_url: 'https://x/keep.pdf' }];
      window.__toasts = [];
      _genEdit('ppe', 'p1');
      const shown = g('ppe-ty').value;
      const restored = _attachUrls['ppe-attach-area'];
      g('ppe-e').value = '2028-01-01';
      svPpe();
      return { shown: shown, restored: restored, file_url: DB.ppe[0].file_url, e: DB.ppe[0].e, ty: DB.ppe[0].ty, rows: DB.ppe.length };
    });
    check('a stored value the <select> has no option for is carried in, not dropped', kept.shown === 'רתמה', kept);
    check('...so the record can be saved at all — the save used to bail on «יש לבחור»', kept.e === '2028-01-01', kept);
    check('...and keeps its own type rather than being reassigned', kept.ty === 'רתמה', kept);
    check('renewing a PPE expiry keeps the certificate — the 3.1 trap, closed here too', kept.file_url === 'https://x/keep.pdf' && kept.rows === 1, kept);

    const removed = await page.evaluate(() => {
      DB.ctr = [{ id: 'c1', n: 'x', e: '2027-01-01', file_url: 'https://x/old.pdf' }];
      _genEdit('ctr', 'c1');
      _attachClear('ctr-attach-area');
      svCtr();
      return DB.ctr[0].file_url;
    });
    check('removing one on purpose still works', removed === null, removed);
  }

  console.log('\n3.9b the migration exists, and a dropped column is no longer silent');
  {
    const sql = fs.readFileSync(path.join(ROOT, 'migrations/2026-09-20_register_attachments.sql'), 'utf8');
    check('the migration adds file_url to all three tables', ['docs', 'ppe', 'ctr'].every((t) => new RegExp('ALTER TABLE public\\.' + t + '\\s+ADD COLUMN IF NOT EXISTS file_url').test(sql)), sql.slice(0, 200));
    check('...and reloads PostgREST, or it keeps answering PGRST204', /NOTIFY pgrst/.test(sql));
    check('...and it is repeatable', (sql.match(/IF NOT EXISTS/g) || []).length === 3);

    // Drive the real outbox against a server that does not have the column,
    // which is exactly the state production is in until the migration runs.
    const warned = await page.evaluate(() => {
      const seen = [];
      window.__toasts = [];
      _obDropped = {};
      window._sbAuth = function () { return Promise.resolve(); };
      window.fetch = function (u, o) {
        const body = JSON.parse((o && o.body) || '{}');
        seen.push(Object.keys(body));
        if (Object.prototype.hasOwnProperty.call(body, 'file_url')) {
          return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve(JSON.stringify({ code: 'PGRST204', message: "Could not find the 'file_url' column of 'ppe' in the schema cache" })) });
        }
        return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve('[]') });
      };
      return _obSend({ op: 'ins', tbl: 'ppe', row: { id: 'z1', ty: 'אחר', e: '2027-01-01', file_url: 'https://x/c.pdf' } })
        .then(function () {
          const first = window.__toasts.slice();
          window.__toasts = [];
          return _obSend({ op: 'ins', tbl: 'ppe', row: { id: 'z2', ty: 'אחר', file_url: 'https://x/d.pdf' } })
            .then(function () { return { seen: seen, first: first, second: window.__toasts, attempts: seen.length }; });
        });
    });
    check('the record itself is still saved — the column is dropped and the row retried', warned.attempts === 4 && warned.seen[1].indexOf('file_url') < 0, warned);
    check('...and it says which column and which table, instead of silence', /file_url/.test(warned.first.join('|')) && /ppe/.test(warned.first.join('|')), warned.first);
    check('...and names what to do about it', /\u05de\u05d9\u05d2\u05e8\u05e6\u05d9\u05d4/.test(warned.first.join('|')), warned.first);
    check('once per column, not once per queued row', warned.second.length === 0, warned.second);
  }

  console.log('\n3.10 the training PDF names the field it prints');
  {
    const r = await page.evaluate(() => {
      __blankReg();
      DB.tr = [{ id: 't1', w: 'מוסא עלי', n: 'עבודה בגובה', c: 'כיבוי אש', d: '2026-03-01', e: '2027-03-01', s: 'בתוקף' }];
      showView('tr', 't1');
      return {
        pairs: VIEW_CONFIG.tr.fields.map((f) => f[0] + '=' + f[1]),
        text: (g('view-body') || {}).textContent || '',
      };
    });
    check('«מדריך» no longer points at the category', r.pairs.indexOf('מדריך=c') < 0, r.pairs);
    check('the field is labelled קטגוריה, which is what the form calls it', r.pairs.indexOf('קטגוריה=c') >= 0, r.pairs);
    check('so the sheet no longer says «מדריך: כיבוי אש»', !/מדריך/.test(r.text), r.text.slice(0, 200));
    check('the value is still shown, under its own label', /כיבוי אש/.test(r.text), r.text.slice(0, 200));
  }

  console.log('\n3.12 an empty tab says what is actually true');
  {
    const r = await page.evaluate(() => {
      __blankReg();
      DB.equip_inspections = [{ id: 'e1', n: 'מלגזה 4', code: 'MLG-4', e: __iso(200) }];
      DB.tr = [{ id: 't1', n: 'עבודה בגובה', w: 'דני', e: __iso(300) }];
      const out = {};
      ['exp', '7', '30', '90', 'none', 'all'].forEach((f) => {
        window._expFilter = f;
        rExp();
        out[f] = (g('tb-exp') || {}).textContent || '';
      });
      return out;
    });
    check('«פג» with nothing expired reads as good news', /הכל בתוקף/.test(r.exp) && !/אין בדיקות ציוד/.test(r.exp), r.exp.trim().slice(0, 120));
    check('...with no button inviting a new equipment inspection', !/בדיקה ראשונה/.test(r.exp), r.exp.trim().slice(0, 120));
    check('«7 ימים» says so in its own words', /בשבוע הקרוב/.test(r['7']), r['7'].trim().slice(0, 120));
    check('«30» and «90» name their own window', /30 הימים/.test(r['30']) && /90 הימים/.test(r['90']), [r['30'].trim().slice(0, 80), r['90'].trim().slice(0, 80)]);
    check('«ללא תאריך» when everything is dated is also good news', /לכל הרשומות יש תאריך תוקף/.test(r.none), r.none.trim().slice(0, 120));
    check('an empty tab on a page that is NOT empty says how many are tracked', /2 רשומות במעקב/.test(r.exp), r.exp.trim().slice(0, 160));

    const truly = await page.evaluate(() => {
      __blankReg();
      window._expFilter = 'all';
      rExp();
      return (g('tb-exp') || {}).textContent || '';
    });
    check('a genuinely empty page says the registers are empty', /אין רשומות עם תאריך תוקף/.test(truly), truly.trim().slice(0, 140));
    check('...and only there does it invite adding something', /בדיקות ציוד/.test(truly) && /הדרכות/.test(truly) && /מסמכים/.test(truly), truly.trim().slice(0, 200));
    check('the invitation is not one register out of six any more', !/בדיקה ראשונה/.test(truly), truly.trim().slice(0, 140));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
