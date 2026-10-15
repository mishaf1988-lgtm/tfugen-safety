// The trainings page and the annual / quality training in the manager's screens (14/10/2026,
// Michael: "all my trainings under one category", "a barcode for the annual training ... one form
// 08.01 with everyone"). A page of its own with a tile in the modules sheet; the form's kind select
// (weekly, induction, annual, quality) with duration and a copy address for the typed kinds; the
// link dialog says "until you close" and offers "close signatures"; who-signed counts a worker as
// signed by the typed ID, and makes form 08.01 through /api/talk op form0801.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const o_t = (x) => String(x || '').trim();
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
    window.sbIns = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]); window.sbUpd = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]);
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    window.qrcode = function () { return { addData() {}, make() {}, getModuleCount() { return 21; }, isDark() { return false; } }; };
    DB.emp = [{ id: 'e1', n: 'אחמד', dep: 'ייצור', eid: '1111111' }, { id: 'e2', n: 'דנה', dep: 'אריזה', eid: '2222222' }];
    DB.toolbox_talks = []; DB.toolbox_reads = [];
    const o = {};
    o.tile = !!document.querySelector('#m-modules-sheet [onclick="_goFromSheet(\'m-modules-sheet\',\'training\')"]');
    // 14/10/2026 (Michael: "one tile, two tabs"): no separate tile for the course register; tabs on both pages.
    o.oneTile = !document.querySelector('#m-modules-sheet [onclick="_goFromSheet(\'m-modules-sheet\',\'tr\')"]');
    o.tabs = ['pg-training', 'pg-tr'].every((id) => !!document.querySelector('#' + id + ' [onclick="goPage(\'tr\')"]') && !!document.querySelector('#' + id + ' [onclick="goPage(\'training\')"]'));
    goPage('training');
    o.page = document.getElementById('pg-training').classList.contains('on') && document.getElementById('pg-training').contains(document.getElementById('tbt-card'));
    o.notOnToolbox = !document.getElementById('pg-toolbox').contains(document.getElementById('tbt-card'));
    const set = (id, v) => { document.getElementById(id).value = v; };
    openModal('m-tbt');
    const k = document.getElementById('tbt-kind');
    o.opts = Array.from(k.options).map((x) => x.value);
    o.durHidden = document.getElementById('tbt-dur-f').style.display === 'none';
    set('tbt-title', 'הדרכת בטיחות שנתית 2026'); set('tbt-body', '1. נהלים\n2. ציוד מגן'); set('tbt-trainer', 'מיכאל'); set('tbt-trainer-q', 'ממונה'); set('tbt-s', 'פורסמה');
    k.value = 'annual'; k.dispatchEvent(new Event('change'));
    o.durShown = document.getElementById('tbt-dur-f').style.display !== 'none' && document.getElementById('tbt-cc-f').style.display !== 'none';
    set('tbt-dur', 'שעתיים'); set('tbt-cc', 'quality@tapugan.co.il');
    // 14/10/2026: before publishing, the kinds of training, effectiveness yes/no and the trainer's signature
    o.typedShown = document.getElementById('tbt-typed-f').style.display !== 'none';
    o.effDefault = document.getElementById('tbt-eff-desc-f').value;
    const n0 = ins.length; svTbt(); o.refused = { saved: ins.length !== n0, msg: toasts.slice(-1)[0] };
    document.querySelector('.tbt-subj[value="כיבוי אש"]').checked = true; set('tbt-subj-o', 'הדרכת ריתוך');
    set('tbt-eff-ok-f', '1');
    const ups = []; window._fileUpload = (f, prefix, cb) => { ups.push(prefix); cb('https://x.supabase.co/storage/v1/object/public/incidents-photos/' + prefix + '.jpg'); };
    const cv = document.getElementById('tbt-trsig'); const rc = cv.getBoundingClientRect();
    const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { clientX: rc.left + x, clientY: rc.top + y, bubbles: true }));
    ev('pointerdown', 10, 10); ev('pointermove', 60, 40); ev('pointermove', 120, 30); ev('pointerup', 120, 30);
    svTbt(); await new Promise((r) => setTimeout(r, 300));
    const sv = ins.filter((x) => x[0] === 'toolbox_talks').slice(-1)[0][1]; o.saved = { kind: sv.kind, dur: sv.dur, cc: sv.mail_cc, subjects: sv.subjects, effOk: sv.eff_ok, effD: sv.eff_d, d: sv.d }; const id = sv.id;
    o.sig = { ups, row: JSON.parse(JSON.stringify(DB.toolbox_talks.find((x) => x.id === id))) };
    openModal('m-tbt'); o.fresh = { kind: document.getElementById('tbt-kind').value, dur: document.getElementById('tbt-dur').value, hidden: document.getElementById('tbt-dur-f').style.display === 'none' }; closeModal('m-tbt');
    _genEdit('toolbox_talks', id); o.edit = { kind: document.getElementById('tbt-kind').value, dur: document.getElementById('tbt-dur').value, cc: document.getElementById('tbt-cc').value }; closeModal('m-tbt');
    // link: until closed, and "close signatures"
    const calls = [];
    window.fetch = (u, init) => { const b = JSON.parse(init.body); calls.push(b);
      const j = b.op === 'form0801' ? { ok: true, pdf: true, n: 2, mailed: true, url: 'https://od.example/f.pdf' } : { url: 'https://tapugan-safety.pages.dev/api/talk?k=perm0', perm: true, link_v: 0 };
      return Promise.resolve(new Response(JSON.stringify(j), { status: 200 })); };
    o.link = await tbtLink(id);
    o.days = document.getElementById('tbt-link-days').textContent;
    o.rv = document.getElementById('tbt-link-revoke').textContent;
    let asked = ''; window.confirm = (m) => { asked = m; return false; }; await tbtRevoke(); o.asked = asked;
    closeModal('m-tbt-link');
    // who signed: one worker typed his card's ID, one temp; the other worker did not sign
    DB.toolbox_reads = [{ id: 'r1', talk_id: id, emp_id: 'x:1111111:ahmad', emp_name: 'אחמד', id_no: '1111111', dept: 'טוגנים', read_at: '2026-10-20T07:00:00Z' },
      { id: 'r2', talk_id: id, emp_id: 'x:9999999:temp', emp_name: 'זמני', id_no: '9999999', dept: 'אריזה', read_at: '2026-10-20T07:02:00Z' }];
    tbtWho(id); const wb = document.getElementById('tbt-who-body').textContent;
    o.who = { out: wb.includes('מחוץ לרשימה') || wb.includes('לא ברשימת העובדים'), decl: wb.includes('אני מאשר/ת שעברתי הדרכה בנושאים: כיבוי אש, הדרכת ריתוך'), miss: wb.includes('לא חתמו'), dana: wb.includes('דנה'), ahmadMissing: wb.includes('(1): אחמד'), danaMissing: wb.includes('אריזה (1): דנה') };
    o.btn = !!document.getElementById('tbt-0801-btn');
    o.form = await tbtForm0801(id);
    o.formCall = calls.filter((c) => c.op === 'form0801')[0];
    o.res = document.getElementById('tbt-0801-res').innerHTML;
    // the induction: each new worker signs his own form, no combined 08.01 (14/10/2026)
    DB.toolbox_talks.push({ id: 'indx', title: 'קליטה', s: 'פורסמה', kind: 'induction', d: '2026-10-10' });
    DB.toolbox_reads.push({ id: 'r9', talk_id: 'indx', emp_id: 'x:1:a', emp_name: 'חדש', read_at: '2026-10-11T07:00:00Z' });
    tbtWho('indx'); o.indBtn = !!document.getElementById('tbt-0801-btn');
    // 14/10/2026: preview of form 08.01, also on a draft with no signatures, in a window opened before the fetch
    const wins = []; window.open = () => { const d = { html: '', open() {}, close() {}, write(h) { this.html += h; } }; const wv = { document: d, closed: false, close() { this.closed = true; } }; wins.push(wv); return wv; };
    window.fetch = (u, init) => { const b = JSON.parse(init.body); calls.push(b); return Promise.resolve(new Response(JSON.stringify(b.preview ? { ok: true, preview: true, n: 0, html: '<html>תיעוד ביצוע הדרכה PREVIEW</html>' } : {}), { status: 200 })); };
    DB.toolbox_talks.push({ id: 'drf', title: 'שנתית טיוטה', s: 'טיוטה', kind: 'annual', d: '2026-10-20' });
    tbtWho('drf'); o.prevBtn = !!document.querySelector('#tbt-who-body [onclick^="tbtForm0801Preview"]'); o.formBtnNoReads = !!document.getElementById('tbt-0801-btn');
    o.prev = await tbtForm0801Preview('drf'); o.prevCall = calls.slice(-1)[0]; o.prevHtml = wins[0] && wins[0].document.html;
    o.unsaved = await _tbtPreviewFromForm();
    // 15/10/2026 (Michael): "weekly" is not the platform's name; close from the row; the print lists only who signed
    { o.modalTitle = document.querySelector('#m-tbt .modal-title').textContent; o.optWeekly = document.querySelector('#tbt-kind option[value=""]').textContent;
      DB.toolbox_talks = [{ id: 'rowc', title: 'שנתית לסגירה', s: 'פורסמה', kind: 'annual', d: '2026-10-15' }]; DB.toolbox_reads = [{ id: 'rr', talk_id: 'rowc', emp_id: 'x:א', emp_name: 'א', id_no: '1', read_at: '2026-10-15T07:00:00Z' }];
      goPage('training'); rTbt(); o.rowClose = !!document.querySelector('#tb-tbt [onclick^="tbtClose"][onclick*="close"]');
      o.rowCount = (document.querySelector('#tb-tbt [onclick^="tbtWho"]') || {}).textContent;
      const cl = []; window.confirm = (m) => { o.closeAsk = m; return true; };
      window.fetch = (u, init) => { cl.push(JSON.parse(init.body)); return Promise.resolve(new Response(JSON.stringify({ ok: true, closed_at: '2026-10-15T09:00:00Z', filed: { n: 1, mailed: true, pdf: true, form_at: '2026-10-15T09:00:01Z' } }), { status: 200 })); };
      const t0 = toasts.length; o.rowCloseRes = await tbtClose('rowc', 'close'); o.rowCloseToast = toasts.slice(t0).join('|'); o.rowFormAt = DB.toolbox_talks[0].form_at;
      DB.toolbox_talks[0].closed_at = null; tbtWho('rowc'); const wb = document.getElementById('tbt-who-body');
      o.missFolded = !!wb.querySelector('details.no-print') ; let html = ''; window.open = () => ({ document: { write(h) { html += h; }, close() {}, images: [] }, print() {} }); tbtWhoPrint(); o.printHtml = html; }
    // 15/10/2026: one list of topics per kind, from the folders: safety for annual, quality (GMP, allergens...) for quality
    { openModal('m-tbt'); const k = document.getElementById('tbt-kind'); const vals = () => [...document.querySelectorAll('#tbt-subj .tbt-subj')].map((c) => c.value);
      k.value = 'annual'; _tbtKindUi(); o.subjAnn = vals();
      k.value = 'quality'; _tbtKindUi(); o.subjQa = vals();
      _tbtTypedFill({ subjects: 'אלרגנים\nנושא חופשי' }); o.subjQaOn = [...document.querySelectorAll('#tbt-subj .tbt-subj')].filter((c) => c.checked).map((c) => c.value).join(); o.subjQaOther = document.getElementById('tbt-subj-o').value;
      o.subjQaSaved = _tbtSubjects(); closeModal('m-tbt'); }
    // 15/10/2026: annual / quality is face to face: no text, video, questions or read-aloud in the form; no text needed to publish
    { openModal('m-tbt'); const k = document.getElementById('tbt-kind'); const fld = (id) => document.getElementById(id).closest('.field').style.display;
      k.value = 'annual'; _tbtKindUi(); o.ffHidden = ['tbt-body', 'tbt-video', 'tbt-quiz', 'tbt-say-btn'].map(fld);
      k.value = ''; _tbtKindUi(); o.ffShown = ['tbt-body', 'tbt-video', 'tbt-quiz', 'tbt-say-btn'].map(fld); closeModal('m-tbt');
      const t0 = toasts.length; DB.toolbox_talks.push({ id: 'nob', title: 'בלי טקסט', s: 'טיוטה', kind: 'quality', d: '2026-10-20', trainer: 'x', trainer_qual: 'y' });
      tbtPublish('nob'); o.noBodyToast = toasts.slice(t0).join('|'); }
    // 14/10/2026: a print button in the preview window, hidden on paper
    { const ev = []; const btn = { style: {} }; const d = { body: { appendChild(x) { ev.push(['b', x]); } }, head: { appendChild(x) { ev.push(['h', x]); } }, getElementById() { return null; }, createElement(t) { return t === 'button' ? btn : { tag: t }; } };
      const wv = { document: d, focus() {}, print() { ev.push(['print']); } };
      o.pv = _tbtPvPrint(wv); btn.onclick(); o.pvBtn = /הדפס/.test(btn.textContent || ''); o.pvHide = ev.some((e) => e[0] === 'h' && /@media print\{#tbt-pv-print\{display:none/.test(e[1].textContent || '')); o.pvPrinted = ev.some((e) => e[0] === 'print'); }
    o.pvWired = /_tbtPvPrint\(w\)/.test(String(tbtForm0801Preview));
    // 14/10/2026: an annual / quality training published 7+ days ago with no form 08.01 warns on the trainings page
    DB.toolbox_talks = [
      { id: 'st1', title: 'שנתית ישנה', s: 'פורסמה', kind: 'annual', d: '2026-10-01' },
      { id: 'st2', title: 'שנתית הופק', s: 'פורסמה', kind: 'annual', d: '2026-10-01', form_at: '2026-10-05T10:00:00Z' },
      { id: 'st3', title: 'איכות חדשה', s: 'פורסמה', kind: 'quality', d: '2026-10-10' },
      { id: 'st4', title: 'שבועית ישנה', s: 'פורסמה', kind: '', d: '2026-09-01' },
      { id: 'st5', title: 'טיוטה ישנה', s: 'טיוטה', kind: 'quality', d: '2026-09-01' },
      { id: 'st6', title: 'איכות בדיוק שבוע', s: 'פורסמה', kind: 'quality', d: '2026-10-07' }];
    o.stale = _tbtStale(DB.toolbox_talks, '2026-10-14').map((x) => x.id).join();
    o.staleNone = _tbtStaleHtml([DB.toolbox_talks[1]], '2026-10-14');
    goPage('training'); rTbt(); o.staleBox = document.getElementById('tbt-stale').innerHTML;
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({ ok: true, n: 1, form_at: '2026-10-14T09:00:00Z' }), { status: 200 }));
    await tbtForm0801('st1'); o.afterForm = DB.toolbox_talks[0].form_at;
    // 14/10/2026: "close signatures" on an annual training really closes it; the row shows closed + reopen
    { const cl = []; window.confirm = () => true;
      window.fetch = (u, init) => { const b = JSON.parse(init.body); cl.push(b); return Promise.resolve(new Response(JSON.stringify({ ok: true, closed_at: b.op === 'close' ? '2026-10-14T10:00:00Z' : null }), { status: 200 })); };
      const rv = document.getElementById('tbt-link-revoke'); rv.dataset.id = 'st1';
      o.cl = await tbtRevoke(); o.clCall = cl[0]; o.clRow = DB.toolbox_talks[0].closed_at;
      rTbt(); const tr = Array.from(document.querySelectorAll('#tb-tbt tr')).find((x) => x.textContent.includes('שנתית ישנה'));
      o.clTag = !!tr && /נסגרה לחתימות/.test(tr.textContent) && !!tr.querySelector('[onclick^="tbtClose"]') && !tr.querySelector('[onclick^="tbtLink"]');
      o.ro = await tbtClose('st1', 'reopen'); o.roCall = cl[1]; o.roRow = DB.toolbox_talks[0].closed_at;
      rTbt(); const tr2 = Array.from(document.querySelectorAll('#tb-tbt tr')).find((x) => x.textContent.includes('שנתית ישנה'));
      o.roLink = !!tr2 && !!tr2.querySelector('[onclick^="tbtLink"]') && !/נסגרה לחתימות/.test(tr2.textContent);
      o.closedErr = _tbtLinkErr(409, 'closed'); }
    // 14/10/2026: who did not sign, to the department managers: a preview first, then a test or the send
    { const mc = []; let asked = 0; window.confirm = () => { asked++; return true; };
      window.fetch = (u, init) => { const b = JSON.parse(init.body); mc.push(b); return Promise.resolve(new Response(JSON.stringify(b.preview ? { ok: true, preview: true, plan: [{ dept: 'ייצור טוגנים', to: ['prod@tapugan.co.il'], cc: ['sviva@tapugan.co.il'], names: ['אחמד', 'בוריס'] }, { dept: 'חומר גלם', to: [], cc: [], names: ['זיו'] }], noDept: ['הדר (הנהלה)'] } : { ok: true, sent: [{ dept: 'ייצור טוגנים', n: 2, test: !!b.test }], skipped: b.test ? [] : [{ dept: 'חומר גלם' }], failed: [] }), { status: 200 })); };
      DB.toolbox_talks.push({ id: 'mm1', title: 'שנתית פתוחה', s: 'פורסמה', kind: 'annual', d: '2026-10-10' });
      tbtWho('mm1'); o.mmBtn = !!document.querySelector('#tbt-who-body [onclick^="tbtMissMail"]');
      DB.toolbox_talks.push({ id: 'mm2', title: 'שנתית סגורה', s: 'פורסמה', kind: 'annual', d: '2026-10-10', closed_at: '2026-10-12T08:00:00Z' });
      tbtWho('mm2'); o.mmBtnClosed = !!document.querySelector('#tbt-who-body [onclick^="tbtMissMail"]');
      tbtWho('mm1');
      o.mmPrev = await tbtMissMail('mm1'); o.mmPrevCall = mc[0]; o.mmBox = document.getElementById('tbt-miss-res').innerHTML;
      o.mmTest = await tbtMissSend('mm1', true); o.mmTestCall = mc[1]; o.mmAskedTest = asked;
      o.mmSend = await tbtMissSend('mm1', false); o.mmSendCall = mc[2]; o.mmAsked = asked; o.mmRes = document.getElementById('tbt-miss-res').innerHTML; }
    return o;
  });
  check('a "הדרכות" tile in the modules sheet', r.tile);
  check('the trainings card lives on its own page, no longer on "שיחות בטיחות"', r.page && r.notOnToolbox, r);
  check('the kind select: weekly, induction, annual, quality', r.opts.join() === ',induction,annual,quality', r.opts);
  check('duration and copy address only for annual / quality', r.durHidden && r.durShown);
  check('annual: the "before publishing" box shows, with the effectiveness text prefilled', r.typedShown && /נשאלו שאלות/.test(r.effDefault), r.effDefault);
  check('publish refused while kinds, effectiveness and the trainer signature are missing, and says what', !r.refused.saved && /לפני פרסום חסר/.test(r.refused.msg) && /סוגי ההדרכה/.test(r.refused.msg) && /חתימת המדריך/.test(r.refused.msg), r.refused);
  check('then saved: the kinds ticked plus "other", effective yes, effectiveness on the training day', r.saved.subjects === 'כיבוי אש\nהדרכת ריתוך' && r.saved.effOk === true && r.saved.effD === r.saved.d, r.saved);
  check('the trainer signature is uploaded and stamped on the talk, and signs the effectiveness check', r.sig.ups.length === 1 && /^sig-.+-trainer$/.test(r.sig.ups[0]) && /trainer\.jpg$/.test(r.sig.row.trainer_sig_url || '') && !!r.sig.row.trainer_signed_at && r.sig.row.eff_by === 'מיכאל', r.sig);
  check('saved: kind annual, duration, copy address', r.saved.kind === 'annual' && r.saved.dur === 'שעתיים' && r.saved.cc === 'quality@tapugan.co.il', r.saved);
  check('a new form starts weekly, the fields empty and hidden', r.fresh.kind === '' && r.fresh.dur === '' && r.fresh.hidden, r.fresh);
  check('edit brings kind, duration and address back', r.edit.kind === 'annual' && r.edit.dur === 'שעתיים' && r.edit.cc === 'quality@tapugan.co.il', r.edit);
  check('the link dialog: permanent until closed, the worker types his details', r.link === 'shown' && /עד שתסגור/.test(r.days) && /מקליד/.test(r.days), r.days);
  check('...the button says "close signatures", and asks before closing', /סגור חתימות/.test(r.rv) && /לסגור את החתימות/.test(r.asked), [r.rv, r.asked]);
  check('who signed: nobody "outside the list", the annual declaration; a worker counts as signed by the typed ID', !r.who.out && r.who.decl && r.who.miss && r.who.danaMissing && !r.who.ahmadMissing, r.who);
  check('form 08.01: the button calls op form0801 and shows the result with a link', r.btn && r.form === 'ok' && r.formCall && r.formCall.id && /od\.example\/f\.pdf/.test(r.res) && /2/.test(r.res), r.res);
  check('one "הדרכות" tile; "courses and certifications" is a tab, on both pages', r.oneTile && r.tabs, r);
  check('no combined 08.01 button on the induction', r.indBtn === false);
  check('preview of 08.01 on a draft with no signatures; the "file it" button only once someone signed', r.prevBtn && !r.formBtnNoReads, r);
  check('preview: op form0801 with preview, the HTML in the window opened first', r.prev === 'shown' && r.prevCall && r.prevCall.op === 'form0801' && r.prevCall.preview === true && /PREVIEW/.test(r.prevHtml || ''), r);
  check('preview from an unsaved form asks to save first', r.unsaved === 'unsaved');
  check('preview window: a print button that prints, hidden on paper, added after the form is written', r.pv === true && r.pvBtn && r.pvHide && r.pvPrinted && r.pvWired, r);
  check('stale: annual / quality, published, 7+ days ago, no form 08.01 (not filed, newer, weekly, draft)', r.stale === 'st1,st6', r.stale);
  check('stale: a banner on the trainings page with a who-signed button; nothing when all filed', /08\.01/.test(r.staleBox) && /tbtWho/.test(r.staleBox) && /שנתית ישנה/.test(r.staleBox) && r.staleNone === '', r.staleBox);
  check('filing 08.01 stamps form_at on the row, so the banner goes', r.afterForm === '2026-10-14T09:00:00Z', r.afterForm);
  check('close signatures on an annual training: op close, closed_at on the row (not a new link)', r.cl === 'closed' && r.clCall && r.clCall.op === 'close' && r.clRow === '2026-10-14T10:00:00Z', [r.cl, r.clCall, r.clRow]);
  check('a closed training: "closed" with the date and a reopen button, no link button', r.clTag);
  check('reopen: op reopen, closed_at cleared, the link button back', r.ro === 'reopened' && r.roCall && r.roCall.op === 'reopen' && r.roRow === null && r.roLink, [r.ro, r.roCall, r.roRow, r.roLink]);
  check('a link on a closed training explains how to reopen', /פתח מחדש/.test(r.closedErr || ''), r.closedErr);
  check('who did not sign: a button on an open annual training, none once closed', r.mmBtn && !r.mmBtnClosed, [r.mmBtn, r.mmBtnClosed]);
  check('...a preview first (op missMail, preview): department, recipients, copy, names, a department with no manager marked, the ones with no department', r.mmPrev === 'preview' && r.mmPrevCall.op === 'missMail' && r.mmPrevCall.preview === true && /ייצור טוגנים/.test(r.mmBox) && /prod@tapugan/.test(r.mmBox) && /עותק: sviva/.test(r.mmBox) && /אחמד, בוריס/.test(r.mmBox) && /אין נמען/.test(r.mmBox) && /הדר \(הנהלה\)/.test(r.mmBox) && /עוד לא נשלח/.test(r.mmBox), r.mmBox);
  check('...a test to Michael without asking; the real send asks first, then says what went and what was skipped', r.mmTest === 'test' && r.mmTestCall.test === true && r.mmAskedTest === 0 && r.mmSend === 'sent' && r.mmSendCall.test === false && !r.mmSendCall.preview && r.mmAsked === 1 && /נשלח: ייצור טוגנים \(2\)/.test(r.mmRes) && /לא נשלח: חומר גלם/.test(r.mmRes), [r.mmTest, r.mmSend, r.mmAsked, r.mmRes]);
  check('annual: the text, video, questions and read-aloud fields are hidden; weekly shows them', r.ffHidden.every((x) => x === 'none') && r.ffShown.every((x) => x === ''), [r.ffHidden, r.ffShown]);
  check('a quality training with no text is not refused as "nothing to publish"', !/אין תוכן לפרסם/.test(r.noBodyToast), r.noBodyToast);
  check('annual: the safety topics found in the folders (16, machine guarding, emergency, PPE...)', r.subjAnn.length === 16 && ['מיגון מכונות', 'חירום ופינוי', 'ציוד מגן אישי', 'כיבוי אש'].every((v) => r.subjAnn.includes(v)) && !r.subjAnn.includes('אלרגנים'), r.subjAnn);
  check('quality: its own list (GMP, allergens, CCP, HACCP...), no safety topics', r.subjQa.length === 8 && ['GMP והיגיינה אישית', 'אלרגנים', 'CCP', 'HACCP'].every((v) => r.subjQa.includes(v)) && !r.subjQa.includes('כיבוי אש'), r.subjQa);
  check('editing a quality training: its topic ticked, a free one under "other", saved back as both', r.subjQaOn === 'אלרגנים' && r.subjQaOther === 'נושא חופשי' && r.subjQaSaved === 'אלרגנים\nנושא חופשי', [r.subjQaOn, r.subjQaOther, r.subjQaSaved]);
  check('the form is "הדרכה", the plain kind is "read and sign (weekly, monthly or specific)"', /📖 הדרכה$/.test(o_t(r.modalTitle)) && /קריאה וחתימה \(שבועית, חודשית או נקודתית\)/.test(r.optWeekly), [r.modalTitle, r.optWeekly]);
  check('an open annual training has "close signatures" in its row; closing says the form is filed and mailed', r.rowClose && r.rowCloseRes === 'closed' && /טופס 08.01 עם כל החותמים יישמר/.test(r.closeAsk || '') && /נשמר בתיקייה ונשלח אליך במייל/.test(r.rowCloseToast) && r.rowFormAt === '2026-10-15T09:00:01Z', [r.rowClose, r.rowCloseRes, r.rowCloseToast]);
  check('annual row: the count is who signed (everyone types), not "0 / employees"', String(r.rowCount).trim() === '1', r.rowCount);
  check('annual: the not-signed list is folded and not printed; the print says "הדרכה שנתית", no buttons', r.missFolded && /<h2>הדרכה שנתית: רשימת חותמים<\/h2>/.test(r.printHtml) && !/לא חתמו \(/.test(r.printHtml) && !/tbtMissMail|tbtForm0801/.test(r.printHtml), r.printHtml.slice(r.printHtml.indexOf('<h2>'), r.printHtml.indexOf('<h2>') + 300));
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
