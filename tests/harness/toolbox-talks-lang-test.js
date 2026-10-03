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
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
