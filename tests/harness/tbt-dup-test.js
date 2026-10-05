// "Duplicate" and "save and send" on the weekly talk (05/10/2026): duplicate opens the
// form as a NEW record with the old talk's text, translations, trainer, file link, today's
// date and draft status; "save and send" saves as published, waits for the outbox, asks
// /api/talk for the link and opens the link dialog, with the same checks as "save".
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], toasts = [];
    window.sbIns = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]); window.sbUpd = () => {};
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    window.qrcode = function () { return { addData() {}, make() {}, getModuleCount() { return 21; }, isDark() { return false; } }; };
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    DB.toolbox_talks = [
      { id: 'p', d: '2026-09-28', title: 'מלגזות', body: 'מהירות, הולכי רגל', body_ar: 'ar-text', body_ru: 'ru-text', s: 'פורסמה', trainer: 'מיכאל', trainer_qual: 'ממונה בטיחות', file_url: 'https://x/storage/v1/object/public/incidents-photos/talk-p.pdf', link_at: '2026-09-28T07:00:00Z', ts: '2026-09-28T07:00:00Z' },
      { id: 'n', d: '2026-09-21', title: 'ישנה בלי מדריך', body: 'x', s: 'טיוטה', ts: '2026-09-21T07:00:00Z' },
    ];
    DB.toolbox_reads = [];
    goPage('toolbox');
    const rowOf = (t) => Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes(t));
    const o = { btnPub: !!rowOf('מלגזות').querySelector('[onclick^="tbtDup"]'), btnDraft: !!rowOf('ישנה').querySelector('[onclick^="tbtDup"]') };
    // duplicate: a new record, every field from the old talk, today, draft
    o.dup = tbtDup('p');
    o.open = document.getElementById('m-tbt').style.display !== 'none';
    o.editId = _svEditId('toolbox_talks');
    o.form = { t: gv('tbt-title'), b: gv('tbt-body'), ar: gv('tbt-ar'), ru: gv('tbt-ru'), am: gv('tbt-am'), s: gv('tbt-s'), d: gv('tbt-d'), tr: gv('tbt-trainer'), q: gv('tbt-trainer-q') };
    o.today = today; o.file = _attachUrls['tbt-attach-area']; o.trSrc = _tbtTrSrc;
    o.fileShown = document.getElementById('tbt-attach-area').innerHTML.includes('talk-p.pdf');
    svTbt(); o.saved = ins.slice(-1)[0]; o.n = DB.toolbox_talks.length;
    // a duplicate of a talk without a trainer gets the last trainer (as a new talk does)
    tbtDup('n'); o.trFill = { tr: gv('tbt-trainer'), q: gv('tbt-trainer-q'), file: _attachUrls['tbt-attach-area'] }; closeModal('m-tbt');
    o.missing = tbtDup('zz'); o.missingToast = toasts.slice(-1)[0];
    // save and send: the trainer check first, nothing saved
    openModal('m-tbt');
    document.getElementById('tbt-title').value = 'חדשה לשליחה'; document.getElementById('tbt-body').value = 'תוכן לקריאה';
    document.getElementById('tbt-trainer').value = ''; document.getElementById('tbt-trainer-q').value = '';
    const before = ins.length;
    o.noTrainer = svTbt(1); o.noTrainerIns = ins.length - before; o.noTrainerToast = toasts.slice(-1)[0];
    o.stillOpen = document.getElementById('m-tbt').style.display !== 'none';
    // then: saved as published, the link asked only after the outbox drained, dialog open
    document.getElementById('tbt-trainer').value = 'דני'; document.getElementById('tbt-trainer-q').value = 'מנהל עבודה';
    const order = []; const calls = [];
    window._obLast = new Promise((res) => setTimeout(() => { order.push('drained'); res(); }, 40));
    window.fetch = (u, init) => { order.push('fetch'); calls.push([u, JSON.parse(init.body), init.headers.Authorization]); return Promise.resolve(new Response(JSON.stringify({ url: 'https://tapugan-safety.pages.dev/api/talk?k=new.x.y', days: 14, link_at: new Date().toISOString() }), { status: 200 })); };
    o.send = await svTbt(1);
    o.sent = ins.slice(-1)[0]; o.order = order; o.call = calls[0];
    o.linkOpen = document.getElementById('m-tbt-link').style.display !== 'none';
    o.formClosed = document.getElementById('m-tbt').style.display === 'none';
    o.footer = Array.from(document.querySelectorAll('#m-tbt .modal-footer button')).map((b) => [b.getAttribute('onclick'), b.textContent.trim()]);
    return o;
  });
  check('the duplicate button on a published and on a draft talk', r.btnPub && r.btnDraft, [r.btnPub, r.btnDraft]);
  check('duplicate opens the form as a new record', r.dup === true && r.open && r.editId === null, [r.dup, r.open, r.editId]);
  check('text, translations, trainer and qualification copied', r.form.t === 'מלגזות' && r.form.b === 'מהירות, הולכי רגל' && r.form.ar === 'ar-text' && r.form.ru === 'ru-text' && r.form.am === '' && r.form.tr === 'מיכאל' && r.form.q === 'ממונה בטיחות', r.form);
  check('today and draft, whatever the old talk had', r.form.d === r.today && r.form.s === 'טיוטה', [r.form.d, r.today, r.form.s]);
  check('the file is a link to the old Storage object, shown in the form', r.file === 'https://x/storage/v1/object/public/incidents-photos/talk-p.pdf' && r.fileShown, [r.file, r.fileShown]);
  check('the translation guard knows the text the translations came from', r.trSrc === 'מלגזות\nמהירות, הולכי רגל', r.trSrc);
  check('saving inserts a new row (new id, draft, no link date), the old one stays', r.saved && r.saved[0] === 'toolbox_talks' && r.saved[1].id !== 'p' && r.saved[1].s === 'טיוטה' && r.saved[1].link_at === undefined && r.saved[1].body_ar === 'ar-text' && r.saved[1].file_url === r.file && r.saved[1].d === r.today && r.n === 3, [r.saved, r.n]);
  check('a talk without a trainer gets the last trainer, and no file', r.trFill.tr === 'מיכאל' && r.trFill.q === 'ממונה בטיחות' && r.trFill.file === null, r.trFill);
  check('an unknown id says so', r.missing === false && /לא נמצאה/.test(r.missingToast), [r.missing, r.missingToast]);
  check('"save and send" without a trainer: not saved, form stays open', r.noTrainer === undefined && r.noTrainerIns === 0 && /המדריך/.test(r.noTrainerToast) && r.stillOpen, [r.noTrainerIns, r.noTrainerToast, r.stillOpen]);
  check('"save and send" saves as published', r.sent && r.sent[1].s === 'פורסמה' && r.sent[1].title === 'חדשה לשליחה', r.sent);
  check('the link is asked only after the outbox drained, for the new row, with the session', r.order.join(',') === 'drained,fetch' && r.call && r.call[0] === '/api/talk' && r.call[1].op === 'link' && r.call[1].id === r.sent[1].id && r.call[2] === 'Bearer tok', [r.order, r.call]);
  check('the link dialog opens and the form closes', r.send === 'shown' && r.linkOpen && r.formClosed, [r.send, r.linkOpen, r.formClosed]);
  check('the footer has "save" and "save and send"', r.footer.some((b) => b[0] === 'svTbt()') && r.footer.some((b) => b[0] === 'svTbt(1)' && /שמור ושלח/.test(b[1])), r.footer);
  check('no page errors', errors.length === 0, errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
