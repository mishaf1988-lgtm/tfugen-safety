// Weekly talk, stages 3 and 4 (03/10/2026), the manager's side: translate the
// talk for the workers (Arabic, Russian, Amharic through /api/claude, model
// gemini), keep it honest when the Hebrew changes after translating, and see
// who signed and who did not, by department, with the signatures; print it.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const COLS = require('./db-columns.json');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const out = await page.evaluate(async () => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], upd = [], toasts = [], confirms = [];
    window.sbIns = function (t, r) { ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.sbUpd = function (t, r) { upd.push([t, JSON.parse(JSON.stringify(r))]); };
    window.toast = function (m) { toasts.push(String(m)); };
    let confirmAnswer = true;
    window.confirm = function (m) { confirms.push(String(m)); return confirmAnswer; };
    window._sign = function (u, cb) { cb('data:image/png;base64,AAAA'); };
    _currentUser = { username: 'admin' };
    window._sbToken = 'tok';
    DB.emp = [{ id: 'e1', n: 'אחמד', dep: 'ייצור' }, { id: 'e2', n: 'דנה', dep: 'אחזקה' }, { id: 'e3', n: 'יוסי', dep: 'ייצור' }, { id: 'e4', n: 'רמי', dep: null }];
    DB.toolbox_talks = [{ id: 'tt-1', d: '2026-10-04', title: 'עבודה בגובה', body: 'רתמה', s: 'פורסמה', body_ar: 'العمل\nحزام' }];
    DB.toolbox_reads = [
      { id: 'r1', talk_id: 'tt-1', emp_id: 'e2', emp_name: 'דנה', dept: 'אחזקה', lang: 'ar', device: 'tablet', read_at: '2026-10-04T05:30:00Z', sig_url: 'https://znhjtpcltrxxyfjczgvw.supabase.co/storage/v1/object/public/incidents-photos/sig-tt-1-e2-x.png' },
    ];
    const res = {};
    const calls = [];
    let mode = 'ok';
    window.fetch = function (u, init) {
      const b = JSON.parse(init.body); calls.push(b);
      const lang = /to (\w+)\./.exec(b.messages[0].content)[1];
      if (mode === 'failRu' && lang === 'Russian') return Promise.resolve(new Response('x', { status: 500 }));
      if (mode === 'cutAm' && lang === 'Amharic') return Promise.resolve(new Response(JSON.stringify({ content: [{ text: 'ስራ' }], stop_reason: 'max_tokens' }), { status: 200 }));
      if (mode === 'slow') return new Promise((ok) => setTimeout(() => ok(new Response(JSON.stringify({ content: [{ text: 'LATE ' + lang }] }), { status: 200 })), 50));
      const text = { Arabic: 'العمل على ارتفاع — مهم\nنص', Russian: '«Работа» на высоте\nтекст…', Amharic: 'ስራ\nጽሑፍ' }[lang];
      return Promise.resolve(new Response(JSON.stringify(Object.assign({ content: [{ text: text }] }, mode === 'fallback' ? { fallback_from: 'gemini' } : {})), { status: 200 }));
    };

    // stage 4 first: the table and the who-signed window
    goPage('toolbox');
    const row = Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes('עבודה בגובה'));
    res.langTag = row.children[1].textContent;
    res.countBtn = row.children[3].querySelector('button') ? row.children[3].querySelector('button').textContent : null;
    tbtWho('tt-1');
    const body = document.getElementById('tbt-who-body');
    res.whoOpen = document.getElementById('m-tbt-who').style.display !== 'none';
    res.whoText = body.textContent;
    res.sigSrc = (body.querySelector('img') || {}).src || '';
    res.missLines = Array.from(body.querySelectorAll('div')).map((d) => d.textContent).filter((t) => /\(\d+\):/.test(t));
    let written = '';
    window.open = function () { return { document: { write: (h) => { written += h; }, close: () => {} }, print: () => {} }; };
    tbtWhoPrint();
    res.printed = written;
    closeModal('m-tbt-who');
    // Michael, 03/10/2026: "the documentation must be in Hebrew, whatever language the workers filled in".
    // Workers who read in Russian and Amharic too: the who-signed window, its print and the view page stay Hebrew.
    DB.toolbox_reads.push({ id: 'r2', talk_id: 'tt-1', emp_id: 'e1', emp_name: 'אחמד', dept: 'ייצור', lang: 'ru', device: 'phone', read_at: '2026-10-04T06:00:00Z' },
      { id: 'r3', talk_id: 'tt-1', emp_id: 'e3', emp_name: 'יוסי', dept: 'ייצור', lang: 'am', device: 'phone', read_at: '2026-10-04T06:10:00Z' },
      // a worker not on the list typed his name in Russian: emp_id keeps it, emp_name is Hebrew (talk.js)
      { id: 'r4', talk_id: 'tt-1', emp_id: 'x:123456782:иван петров', emp_name: 'איוון פטרוב', dept: 'אקמי', lang: 'ru', device: 'phone', read_at: '2026-10-04T06:20:00Z' });
    DB.toolbox_talks[0].body_ru = 'Работа\nпояс'; DB.toolbox_talks[0].body_am = 'ስራ\nጽሑፍ';
    tbtWho('tt-1'); res.whoAll = body.textContent;
    written = ''; tbtWhoPrint(); res.printAll = written.replace(/<script[\s\S]*?<\/script>/g, '');
    closeModal('m-tbt-who');
    showView('toolbox_talks', 'tt-1'); res.viewAll = document.getElementById('pg-view').textContent;
    DB.toolbox_reads.splice(1); delete DB.toolbox_talks[0].body_ru; delete DB.toolbox_talks[0].body_am;
    goPage('toolbox');

    // stage 3: translate
    openModal('m-tbt');
    res.noText = await tbtTranslate(); res.noTextCalls = calls.length;
    document.getElementById('tbt-title').value = 'מלגזות';
    document.getElementById('tbt-body').value = 'מהירות\nהולכי רגל';
    res.tr = await tbtTranslate();
    res.calls = calls.map((c) => ({ model: c.model, lang: /to (\w+)\./.exec(c.messages[0].content)[1], hasSrc: c.messages[0].content.includes('מלגזות\nמהירות\nהולכי רגל') }));
    res.fields = { ar: gv('tbt-ar'), ru: gv('tbt-ru'), am: gv('tbt-am') };
    res.trToast = toasts.slice(-1)[0];
    res.boxOpen = document.getElementById('tbt-tr-box').open;
    svTbt();
    res.saved = ins.slice(-1)[0];
    res.confirmsAfterSave = confirms.length;

    // Hebrew changed after translating: asked; "cancel" keeps the form open, nothing saved
    openModal('m-tbt');
    document.getElementById('tbt-title').value = 'חומרים';
    document.getElementById('tbt-body').value = 'א';
    calls.length = 0; mode = 'failRu';
    res.partial = await tbtTranslate();
    res.partialToast = toasts.slice(-1)[0];
    res.partialRu = gv('tbt-ru');
    document.getElementById('tbt-body').value = 'א ב';
    confirmAnswer = false; const before = ins.length;
    svTbt();
    res.staleAsked = confirms.length === 1 && /השתנה/.test(confirms[0]);
    res.staleSaved = ins.length - before;
    confirmAnswer = true; svTbt();
    res.staleSavedAfterOk = ins.length - before;

    // editing an old talk: changing its Hebrew without translating asks too
    _genEdit('toolbox_talks', 'tt-1');
    res.editAr = gv('tbt-ar');
    document.getElementById('tbt-body').value = 'רתמה חדשה';
    confirms.length = 0; confirmAnswer = false;
    svTbt();
    res.editAsked = confirms.length;
    confirmAnswer = true;

    // checker 03/10/2026, 1: a failed language must not keep the old translation next to new Hebrew
    DB.toolbox_talks.push({ id: 'tt-5', d: '2026-10-04', title: 'ישן', body: 'טקסט ישן', s: 'טיוטה', body_ru: 'старый\nтекст' });
    _genEdit('toolbox_talks', 'tt-5');
    document.getElementById('tbt-body').value = 'טקסט חדש';
    mode = 'failRu';
    await tbtTranslate();
    res.oldRuAfterFail = gv('tbt-ru');
    // 5: a text cut at the length limit is a failure
    mode = 'cutAm';
    await tbtTranslate();
    res.cutAm = gv('tbt-am'); res.cutToast = toasts.slice(-1)[0];
    closeModal('m-tbt');
    // 2: a translation still running when the form is closed and another talk opened does not land there
    mode = 'slow';
    _genEdit('toolbox_talks', 'tt-5');
    document.getElementById('tbt-body').value = 'טקסט חדש';
    const run = tbtTranslate();
    closeModal('m-tbt');
    _genEdit('toolbox_talks', 'tt-1');
    const arBefore = gv('tbt-ar');
    res.staleRun = await run;
    res.arUntouched = gv('tbt-ar') === arBefore;
    res.btnBack = !document.getElementById('tbt-tr-btn').disabled;
    // ...and changing only the status asks nothing
    confirms.length = 0;
    document.getElementById('tbt-s').value = 'פורסמה';
    const n0 = upd.length; svTbt();
    res.statusOnlyAsked = confirms.length; res.statusOnlySaved = upd.length - n0;
    // 4: tt-1 has a signature: changing its text asks first
    _genEdit('toolbox_talks', 'tt-1');
    document.getElementById('tbt-body').value = 'רתמה ועוד';
    confirms.length = 0; const n1 = upd.length;
    const realConfirm = window.confirm;
    window.confirm = function (m) { confirms.push(String(m)); return !/כבר חתמו/.test(m); };
    svTbt();
    window.confirm = realConfirm;
    res.signedAsked = confirms.some((m) => /כבר חתמו/.test(m)); res.signedSaved = upd.length - n1;
    // review 03/10/2026: a talk can be a file only; replacing the file of a signed talk asks too
    _genEdit('toolbox_talks', 'tt-1');
    _attachUrls['tbt-attach-area'] = 'https://x/storage/v1/object/public/incidents-photos/new.pdf';
    confirms.length = 0; const n2 = upd.length;
    window.confirm = function (m) { confirms.push(String(m)); return !/כבר חתמו/.test(m); };
    svTbt();
    window.confirm = realConfirm;
    res.fileAsked = confirms.some((m) => /כבר חתמו/.test(m)); res.fileSaved = upd.length - n2;
    confirmAnswer = true;
    closeModal('m-tbt');
    mode = 'ok';

    // fallback model: said so
    openModal('m-tbt');
    document.getElementById('tbt-title').value = 'x'; document.getElementById('tbt-body').value = 'y';
    mode = 'fallback';
    res.fb = await tbtTranslate(); res.fbToast = toasts.slice(-1)[0];
    return res;
  });

  check('table: the languages a talk has', /ערבית/.test(out.langTag), out.langTag);
  check('table: signed / employees as a button', out.countBtn === '1 / 4', out.countBtn);
  check('who-signed window opens with counts', out.whoOpen && /חתמו: 1/.test(out.whoText) && /לא חתמו: 3/.test(out.whoText), out.whoText);
  check('signed row: name, department, Israel time, device, language', /דנה/.test(out.whoText) && /04\/10\/2026 08:30/.test(out.whoText) && /טאבלט/.test(out.whoText) && /ערבית/.test(out.whoText), out.whoText);
  check('the signature image is signed (private bucket)', out.sigSrc.startsWith('data:image/png'), out.sigSrc);
  check('not signed, by department, no-department under "אחר"', out.missLines.some((t) => /ייצור \(2\): אחמד, יוסי/.test(t)) && out.missLines.some((t) => /אחר \(1\): רמי/.test(t)), out.missLines);
  check('print: a page with the list and the signatures', /רשימת חותמים/.test(out.printed) && /דנה/.test(out.printed) && /<img[^>]+src="data:image\/png/.test(out.printed));
  check('translate with no text: refused, no AI call', out.noText === 'empty' && out.noTextCalls === 0);
  check('translate: three calls, gemini, Arabic Russian Amharic, title + body', out.tr === 'ok' && out.calls.length === 3 && out.calls.every((c) => c.model === 'gemini' && c.hasSrc) && out.calls.map((c) => c.lang).join() === 'Arabic,Russian,Amharic', out.calls);
  check('translations fill the three fields', out.fields.ar.startsWith('العمل') && out.fields.ru.includes('на высоте') && out.fields.am.startsWith('ስራ'), out.fields);
  check('keyboard characters only: AI dash, guillemets and ellipsis replaced', out.fields.ar.includes('ارتفاع - مهم') && out.fields.ru.startsWith('"Работа"') && out.fields.ru.endsWith('текст...'), out.fields);
  check('translations box opens, toast says to save', out.boxOpen && /לשמור/.test(out.trToast), out.trToast);
  const sv = out.saved && out.saved[1];
  check('saved with body_ar / body_ru / body_am, no question', sv && sv.body_ar && sv.body_ru && sv.body_am && out.confirmsAfterSave === 0, sv);
  check('every field written has a column', sv && Object.keys(sv).every((k) => COLS.toolbox_talks.includes(k)), sv && Object.keys(sv));
  check('one language failed: said which, the others kept', out.partial === 'partial' && /רוסית/.test(out.partialToast) && out.partialRu === '', out.partialToast);
  check('Hebrew changed after translating: asked, "cancel" saves nothing', out.staleAsked && out.staleSaved === 0);
  check('...and "OK" saves', out.staleSavedAfterOk === 1);
  check('editing: translations come back into the form', out.editAr === 'العمل\nحزام', out.editAr);
  check('editing: Hebrew changed with old translations: asked', out.editAsked === 1, out.editAsked);
  check('fallback model: the manager is told the quality is lower', out.fb === 'fallback' && /גיבוי/.test(out.fbToast), out.fbToast);
  check('checker 1: a failed language clears its old translation', out.oldRuAfterFail === '', out.oldRuAfterFail);
  check('checker 5: a text cut at the limit is not kept, and said', out.cutAm === '' && /אמהרית/.test(out.cutToast), [out.cutAm, out.cutToast]);
  check('checker 2: a late translation does not land in another talk, button usable', out.staleRun === 'stale' && out.arUntouched && out.btnBack, out);
  check('checker 2: changing only the status asks nothing and saves', out.statusOnlyAsked === 0 && out.statusOnlySaved === 1, [out.statusOnlyAsked, out.statusOnlySaved]);
  check('checker 4: editing the text of a signed talk asks first; "cancel" saves nothing', out.signedAsked && out.signedSaved === 0, [out.signedAsked, out.signedSaved]);
  check('review: replacing the file of a signed talk asks first; "cancel" saves nothing', out.fileAsked && out.fileSaved === 0, [out.fileAsked, out.fileSaved]);
  const FOREIGN = /[\u0600-\u06ff\u0400-\u04ff\u1200-\u137f]/;
  check('documentation in Hebrew only: who-signed with ar/ru/am readers', !FOREIGN.test(out.whoAll) && /רוסית/.test(out.whoAll) && /אמהרית/.test(out.whoAll), out.whoAll);
  check('outside the list: counted apart, marked, not as "left the list"', /חתמו: 3/.test(out.whoAll) && /מחוץ לרשימה: 1/.test(out.whoAll) && /איוון פטרוב/.test(out.whoAll) && /חתם מחוץ לרשימה, ת.ז \/ דרכון: 123456782/.test(out.whoAll) && !/לא ברשימת העובדים/.test(out.whoAll), out.whoAll);
  check('documentation in Hebrew only: the printed list', !FOREIGN.test(out.printAll) && /אחמד/.test(out.printAll), (out.printAll.match(FOREIGN) || [])[0]);
  check('documentation in Hebrew only: the view page shows the Hebrew text, not a translation', !FOREIGN.test(out.viewAll) && /רתמה/.test(out.viewAll), out.viewAll.slice(0, 200));
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
