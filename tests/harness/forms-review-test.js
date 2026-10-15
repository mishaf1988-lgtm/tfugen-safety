// The form review of 15/10/2026: a "+ new" form opened with the previous record's values, a
// half-filled form was lost to X / a tap outside / Escape / the phone's back button, an upload
// that ended late attached its file to the NEXT record, and a list of smaller holes (the PTW
// print, numbers, Israel dates, drafts during an edit, the desktop "N" key, Smart Capture ids,
// empty dates becoming today on edit, the view page after an edit). One section per item.
// Israel's time zone, as on Michael's phone. The network is blocked.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  page.on('filechooser', () => {});
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // Dialogs: answered by __dlg ('accept' | 'dismiss'), counted in __dlgN.
  let dlgAnswer = 'accept', dlgN = 0;
  page.on('dialog', (d) => { dlgN++; (dlgAnswer === 'accept' ? d.accept() : d.dismiss()).catch(() => {}); });
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.__out = []; window.sbIns = (t, r) => __out.push({ op: 'ins', t, r: JSON.parse(JSON.stringify(r)) }); window.sbUpd = (t, r) => __out.push({ op: 'upd', t, r: JSON.parse(JSON.stringify(r)) });
    window.sdb = () => {}; window.toast = () => {}; window.addLog = () => {}; window._role = () => 'admin'; window._isAdminUser = () => true; _isAdmin = true; window._currentUser = { username: 'admin' };
    ['ncr', 'inc', 'leg', 'env_aspects', 'tasks', 'ptw', 'near_miss', 'docs', 'tr', 'equip_inspections', 'rounds', 'tour_hazards', 'auds', 'drl', 'wst', 'ppe', 'toolbox_talks'].forEach((k) => { DB[k] = []; });
    goPage('dash');
  });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const last = (t) => ev((t) => { const o = __out.filter((x) => x.t === t); return o[o.length - 1] || null; }, t);
  const isOpen = (m) => ev((m) => { const e = document.getElementById(m); return !!e && (e.style.display === 'block' || e.style.display === 'flex'); }, m);

  console.log('\n1. "+ add aspect" is a new aspect, not the last one edited');
  {
    await ev(() => { DB.env_aspects = [{ id: 'ea1', aspect: 'פסולת', status: 'מבוצע', file_url: 'https://x/ea1.pdf' }]; __out = []; editEasp('ea1'); closeModal('m-easp'); });
    const r = await ev(() => { const b = [...document.querySelectorAll('button')].find((x) => /_easpOpenNew\(\)/.test(x.getAttribute('onclick') || '')); if (b) b.click(); return { btn: !!b, id: g('ea-id').value, asp: g('ea-aspect').value, att: _attachUrls['ea-attach-area'] || null }; });
    check('the page button opens _easpOpenNew, and the form is empty (no id, no aspect, no file)', r.btn && r.id === '' && r.asp === '' && !r.att, r);
    await ev(() => { g('ea-aspect').value = 'רעש'; svEasp(); });
    const w = await last('env_aspects');
    const kept = await ev(() => DB.env_aspects.find((x) => x.id === 'ea1'));
    check('saving it inserts a second aspect; the edited one keeps its file', w && w.op === 'ins' && w.r.id !== 'ea1' && kept.file_url === 'https://x/ea1.pdf' && DB_len_ok(await ev(() => DB.env_aspects.length)), { w, kept });
    await ev(() => { __out = []; editEasp('ea1'); svEasp(); });
    check('after an edit is saved, ea-id is cleared', (await ev(() => g('ea-id').value)) === '');
  }
  function DB_len_ok(n) { return n === 2; }

  console.log('\n2. _EDIT_MODS: what a saver reads, the editor fills (static check is in edit-roundtrip-test)');
  {
    const r = await ev(() => { DB.leg = [{ id: 'lg1', s: 'חוק א', d: '2026-01-05', c: 'מציית', c_date: '2026-02-01', c_by: 'm', u: null }]; __out = []; editLeg('lg1'); svLeg(); const o = __out.pop() || { r: { d: 'nothing saved' } }; return { hasD: 'd' in o.r, local: DB.leg[0].d }; });
    check('svLeg no longer writes d (there is no leg-d field), and the stored d stays', !r.hasD && r.local === '2026-01-05', r);
  }

  console.log('\n3. a "+ new" form starts clean');
  {
    const r = await ev(() => {
      const o = {};
      // A training edited with an expiry, then "+ new"
      DB.tr = [{ id: 't1', w: 'דנה', n: 'גובה', d: '2026-01-01', e: '2027-01-01', file_url: 'https://x/t1.pdf' }];
      _genEdit('tr', 't1'); closeModal('m-tr'); openModal('m-tr');
      o.te = g('t-e').value; o.tw = g('t-w').value; o.tatt = _attachUrls['tr-attach-area'] || null;
      closeModal('m-tr');
      g('d-e').value = '2027-05-05'; _attachUrls['doc-attach-area'] = 'https://x/old.pdf'; openModal('m-doc'); o.de = g('d-e').value; o.datt = _attachUrls['doc-attach-area'] || null; closeModal('m-doc');
      g('nm-s').value = 'סגור'; openModal('m-nm'); o.nms = g('nm-s').value; closeModal('m-nm');
      g('ptw-num').value = 'PTW-0007'; g('ptw-hot').checked = true; openModal('m-ptw'); o.ptwnum = g('ptw-num').value; o.hot = g('ptw-hot').checked; closeModal('m-ptw');
      g('tbt-s').value = 'פורסמה'; openModal('m-tbt'); o.tbts = g('tbt-s').value; closeModal('m-tbt');
      DB.leg = [{ id: 'lg2', s: 'חוק ב', c: 'מציית', c_date: '2026-02-01', c_by: 'm', c_evidence_url: 'https://x/ev.pdf' }];
      editLeg('lg2'); closeModal('m-leg'); openNewLegModal();
      o.legc = g('leg-c').value; o.legcd = g('leg-c-date').value; o.legcb = g('leg-c-by').value; o.legev = _attachUrls['leg-evidence-area'] || null; closeModal('m-leg');
      g('round-d').value = '2025-01-01'; _roundOpenNew();
      return o;
    });
    await page.waitForTimeout(80);
    const rd = await ev(() => { const v = g('round-d').value; closeModal('m-round'); return v; });
    const today = await ev(() => _ilToday());
    check('training: no expiry, worker or file carried from the record edited before', r.te === '' && r.tw === '' && !r.tatt, r);
    check('document: no expiry and no file carried over', r.de === '' && !r.datt, r);
    check('near miss starts open, not closed', r.nms === 'פתוח', r.nms);
    check('permit: no number and no work type carried over', r.ptwnum === '' && r.hot === false, r);
    check('weekly talk starts as a draft, not published', r.tbts === 'טיוטה', r.tbts);
    check('legal: starts "not yet evaluated", with no date, author or evidence', r.legc === 'טרם הוערך' && r.legcd === '' && r.legcb === '' && !r.legev, r);
    check('a new round starts today, not on an old date', rd === today, { rd, today });
    // The custom new-openers still set up their forms
    const n = await ev(() => {
      const o = {};
      DB.ncr = [{ id: 'n1', num: 'NCR-0004', d: 'תיאור', s: 'סגור', p: 'קריטי', sd: '2026-01-01' }];
      editNcr('n1'); closeModal('m-ncr');
      openNewNcrModal(); o.ncr = { id: g('ncr-id').value, d: g('ncr-d').value, s: g('ncr-s').value, p: g('ncr-p').value, u: g('ncr-u').value, sd: g('ncr-sd').value }; closeModal('m-ncr');
      openNewIncModal(); o.inc = { id: g('i-id').value, dt: g('i-dt').value, st: g('i-st').selectedIndex }; closeModal('m-inc');
      thzNew(); o.thz = { s: g('thz-s').value, d: g('thz-d').value }; closeModal('m-thz');
      _eqiOpenNew(); o.eqi = { id: g('eqi-id').value, s: g('eqi-s').value }; closeModal('m-eqi');
      openTskModal('ncr', 'n1'); o.tsk = { src: g('tsk-src-tbl').value, sid: g('tsk-src-id').value, title: g('tsk-title').value, st: g('tsk-status').value }; closeModal('m-tsk');
      return o;
    });
    check('openNewNcrModal: empty id and text, open, default priority, a target date by priority', n.ncr.id === '' && n.ncr.d === '' && n.ncr.s === 'פתוח' && n.ncr.p === 'בינונית' && /^\d{4}-\d{2}-\d{2}$/.test(n.ncr.u) && n.ncr.sd === today, n.ncr);
    check('openNewIncModal: no id, the time is filled, status is the first option', n.inc.id === '' && /T\d\d:\d\d$/.test(n.inc.dt) && n.inc.st === 0, n.inc);
    check('thzNew: open, dated', n.thz.s === 'פתוח' && !!n.thz.d, n.thz);
    check('_eqiOpenNew: no id, status תקין', n.eqi.id === '' && n.eqi.s === 'תקין', n.eqi);
    check('openTskModal(source): the source and the prefilled title survive the reset', n.tsk.src === 'ncr' && n.tsk.sid === 'n1' && /NCR-0004/.test(n.tsk.title) && !!n.tsk.st, n.tsk);
    // Every edit opener still shows its record
    const e = await ev(async () => {
      const o = {};
      DB.inc = [{ id: 'i1', d: 'נפילה', dt: '2026-05-01T07:00:00+00:00', ty: 'תאונה', s: 'בחקירה', file_url: 'https://x/i1.jpg' }];
      DB.tasks = [{ id: 'k1', title: 'לתקן', status: 'פתוח', due: '2026-11-01' }];
      DB.equip_inspections = [{ id: 'q1', code: 'F-1', n: 'מלגזה', s: 'לתקן', d: '2026-01-01', e: '2027-01-01' }];
      DB.rounds = [{ id: 'r1', d: '2026-03-03', inspector: 'מיכאל', theme: 'morning', items: [] }];
      editNcr('n1'); o.ncr = [g('ncr-d').value, g('ncr-s').value, g('ncr-p').value]; closeModal('m-ncr');
      editInc('i1'); o.inc = [g('i-d').value, g('i-st').value, _attachUrls['inc-attach-area']]; closeModal('m-inc');
      editLeg('lg2'); o.leg = [g('leg-s').value, g('leg-c').value, _attachUrls['leg-evidence-area']]; closeModal('m-leg');
      editTsk('k1'); o.tsk = [g('tsk-title').value, g('tsk-due').value]; closeModal('m-tsk');
      editEasp('ea1'); o.easp = [g('ea-aspect').value, _attachUrls['ea-attach-area']]; closeModal('m-easp');
      eqiEdit('q1'); await new Promise((r) => setTimeout(r, 120)); o.eqi = [g('eqi-code').value, g('eqi-e').value]; closeModal('m-eqi');
      _roundEdit('r1'); await new Promise((r) => setTimeout(r, 120)); o.round = [g('round-d').value, g('round-inspector').value]; closeModal('m-round');
      return o;
    });
    check('editNcr shows the record', e.ncr.join('|') === 'תיאור|סגור|קריטי', e.ncr);
    check('editInc shows the record and its file', e.inc[0] === 'נפילה' && e.inc[1] === 'בחקירה' && e.inc[2] === 'https://x/i1.jpg', e.inc);
    check('editLeg shows the record and its evidence', e.leg[0] === 'חוק ב' && e.leg[1] === 'מציית' && e.leg[2] === 'https://x/ev.pdf', e.leg);
    check('editTsk shows the record', e.tsk.join('|') === 'לתקן|2026-11-01', e.tsk);
    check('editEasp shows the record and its file', e.easp[0] === 'פסולת' && e.easp[1] === 'https://x/ea1.pdf', e.easp);
    check('eqiEdit shows the record', e.eqi.join('|') === 'F-1|2027-01-01', e.eqi);
    check('_roundEdit shows the record', e.round.join('|') === '2026-03-03|מיכאל', e.round);
  }

  console.log('\n4. closing a half-filled form asks first; back closes the form, not the page');
  {
    await ev(() => goPage('docs'));
    await ev(() => openModal('m-doc'));
    dlgN = 0;
    await page.click('#m-doc .close-btn');
    check('an untouched form closes on X with no question', dlgN === 0 && !(await isOpen('m-doc')), dlgN);
    await ev(() => openModal('m-doc'));
    await page.fill('#d-n', 'נוהל חדש');
    dlgAnswer = 'dismiss'; dlgN = 0;
    await page.click('#m-doc .close-btn');
    check('a typed form: X asks, and "cancel" keeps it open with the text', dlgN === 1 && (await isOpen('m-doc')) && (await ev(() => g('d-n').value)) === 'נוהל חדש', dlgN);
    dlgN = 0;
    await page.keyboard.press('Escape');
    check('Escape asks once (not twice)', dlgN === 1 && (await isOpen('m-doc')), dlgN);
    dlgN = 0;
    const url0 = page.url();
    await page.goBack(); await page.waitForTimeout(150);
    check('back asks, and on "cancel" the form stays and the page stays', dlgN === 1 && (await isOpen('m-doc')) && page.url() === url0 && (await ev(() => CUR)) === 'docs', { dlgN, url: page.url() });
    dlgAnswer = 'accept'; dlgN = 0;
    await page.goBack(); await page.waitForTimeout(150);
    check('back again, "OK": the form closes, still on the same page', dlgN === 1 && !(await isOpen('m-doc')) && (await ev(() => CUR)) === 'docs', { dlgN, cur: await ev(() => CUR) });
    await ev(() => openModal('m-doc'));
    await page.fill('#d-n', 'נוהל שנשמר');
    dlgN = 0;
    await ev(() => svDoc()); await page.waitForTimeout(100);
    check('a save closes with no question', dlgN === 0 && !(await isOpen('m-doc')), dlgN);
    // The save drops the form's history entry with a history.back() that lands asynchronously; on a busy
    // runner it landed after the next openModal and the stack came out one entry short (CI, 15/10/2026).
    await page.waitForFunction(() => !(history.state && history.state.modal) && _mhSkip === 0, null, { timeout: 5000 }); await page.waitForTimeout(100);
    // An untouched form and back: closes quietly, no page change
    await ev(() => openModal('m-doc')); dlgN = 0;
    await page.goBack(); await page.waitForTimeout(150);
    check('back on an untouched form: closes quietly, still on the page', dlgN === 0 && !(await isOpen('m-doc')) && (await ev(() => CUR)) === 'docs', dlgN);
    // Page navigation by back still works once no form is open. Wait first until the history.back()
    // queued by the earlier closes has landed (on a busy CI runner it arrived after goPage and popped it).
    await page.waitForFunction(() => !(history.state && history.state.modal) && _mhSkip === 0 && CUR === 'docs', null, { timeout: 5000 }); await page.waitForTimeout(300);
    await ev(() => goPage('ncr')); await page.waitForTimeout(50);
    await ev(() => { openModal('m-doc'); closeModal('m-doc'); });
    await page.waitForFunction(() => !(history.state && history.state.modal) && _mhSkip === 0, null, { timeout: 3000 }); await page.waitForTimeout(100);
    await page.goBack(); await page.waitForTimeout(150);
    check('a form opened and closed leaves no extra back step: back goes to the previous page', (await ev(() => CUR)) === 'docs', await ev(() => CUR));
    check('the X buttons and the overlays of the forms go through closeAsk', await ev(() => { const x = document.querySelector('#m-doc .close-btn').getAttribute('onclick'); const ov = document.getElementById('ov-doc').getAttribute('onclick'); return /^closeAsk\(/.test(x) && /^closeAsk\(/.test(ov); }));
  }

  console.log('\n5. saving while a file uploads, and a file that arrives after the form closed');
  {
    const r = await ev(() => {
      const o = {}; __out = [];
      // Every required field filled, so only the upload can stop the save.
      [['m-doc', 'd-n'], ['m-ppe', null], ['m-ctr', 'ctr-n'], ['m-wst', 'wst-d'], ['m-hzm', 'hzm-n'], ['m-leg', 'leg-s'], ['m-easp', 'ea-aspect']].forEach(([m, f]) => { openModal(m); if (f) g(f).value = f === 'wst-d' ? '2026-10-01' : 'x'; });
      ['svDoc', 'svPpe', 'svCtr', 'svWst', 'svHzm', 'svLeg', 'svEasp'].forEach((f) => { _attachPending['x-busy'] = true; try { window[f](); } catch (e) { o[f] = String(e); } });
      ['m-doc', 'm-ppe', 'm-ctr', 'm-wst', 'm-hzm', 'm-leg', 'm-easp'].forEach((m) => closeModal(m));
      _attachPending['x-busy'] = false;
      o.saved = __out.length;
      return o;
    });
    check('svDoc, svPpe, svCtr, svWst, svHzm, svLeg, svEasp wait for the upload (nothing saved)', r.saved === 0 && Object.keys(r).length === 1, r);
    const late = await ev(() => {
      let held = null; const real = _fileUpload;
      _fileUpload = function (f, p, cb) { held = cb; };
      openModal('m-doc');
      _attachPick('doc-attach-area', 'doc-attach-area');
      const inp = document.getElementById('_att_inp_doc-attach-area');
      const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' })); inp.files = dt.files; inp.onchange();
      const busy = _attachBusy();
      closeModal('m-doc');
      const busyAfter = _attachBusy();
      held('https://x/late.pdf');
      const now = _attachUrls['doc-attach-area'] || null;
      _fileUpload = real;
      openModal('m-doc'); const v = _attachUrls['doc-attach-area'] || null; closeModal('m-doc');
      return { busy, busyAfter, now, v };
    });
    check('closing the form lets go of its upload, and the late file reaches no form', late.busy && !late.busyAfter && !late.now && !late.v, late);
  }

  console.log('\n5b. a queued (offline) photo survives the save that points at it');
  {
    await ev(() => { _obSet([]); openModal('m-nm'); g('nm-desc').value = 'שמן על הרצפה'; _attachPending['nm-photo-area'] = true; _attachPick('nm-photo-area', 'nm'); });
    await page.setInputFiles('#_att_inp_nm-photo-area', { name: 'p.jpg', mimeType: 'image/jpeg', buffer: JPEG });
    await page.waitForFunction(() => _attachPending['nm-photo-area'] === false, null, { timeout: 8000 });
    const before = await ev(() => _attachUrls['nm-photo-area']);
    await ev(() => svNm());
    await page.waitForTimeout(300);
    const after = await ev(() => new Promise((res) => _phAll((l) => res({ n: l.length, pids: l.map((x) => x.pid), row: (DB.near_miss[DB.near_miss.length - 1] || {}).photo_url }))));
    check('the photo is queued (pending:) before the save', /^pending:/.test(before || ''), before);
    check('after svNm the blob is still in the photo queue, and the row points at it', after.n >= 1 && after.row === before && after.pids.some((p) => before.endsWith(p)), { before, after });
    const rm = await ev(() => new Promise((res) => { const a = 'doc-attach-area'; _attachUrls[a] = _PH_PREFIX + 'nobody'; let called = null; const real = _phDel; _phDel = (pid) => { called = pid; }; _attachClear(a); _phDel = real; res(called); }));
    check('"remove" on a photo nothing points at still deletes it from the device', rm === 'nobody', rm);
  }

  console.log('\n6. printing a permit opened through ✎ prints that permit');
  {
    const r = await ev(() => {
      DB.ptw = [{ id: 'p1', num: 'PTW-0001', con: 'א', s: 'פעיל' }, { id: 'p2', num: 'PTW-0002', con: 'ב', s: 'פעיל' }];
      let html = ''; const real = window.open; window.open = () => ({ document: { write: (h) => { html += h; }, close: () => {} }, focus: () => {}, print: () => {} });
      _genEdit('ptw', 'p1'); ptwPrint(); window.open = real;
      return { p1: /PTW-0001/.test(html), p2: /PTW-0002/.test(html) };
    });
    check('the print is PTW-0001, not the last row', r.p1 && !r.p2, r);
  }

  console.log('\n7. dates and times are Israel time, not UTC');
  {
    await page.clock.setFixedTime(new Date('2026-10-14T22:30:00Z'));   // 01:30 on 15/10 in Israel
    const r = await ev(() => {
      const o = {};
      openNewIncModal(); o.dt = g('i-dt').value; o.iso = _incIsoDt(g('i-dt').value); closeModal('m-inc');
      openModal('m-doc'); o.du = g('d-u').value; closeModal('m-doc');
      openModal('m-nm'); g('nm-d').value = ''; g('nm-desc').value = 'x'; __out = []; svNm(); o.nm = (__out[__out.length - 1] || {}).r.d;
      o.il = _ilToday();
      return o;
    });
    check('a new incident starts at the Israel time now (01:30), and saves as that moment', r.dt === '2026-10-15T01:30' && r.iso === '2026-10-14T22:30:00.000Z', r);
    check('a date field starts as Israel\'s today (15/10), not UTC\'s yesterday', r.du === '2026-10-15' && r.il === '2026-10-15', r);
    check('a near miss saved with no date gets Israel\'s today', r.nm === '2026-10-15', r.nm);
    await page.clock.resume();
  }

  console.log('\n8. a new permit number is above the highest in use');
  {
    const r = await ev(() => { DB.ptw = [{ id: 'a', num: 'PTW-0001' }, { id: 'b', num: 'PTW-0003' }]; openModal('m-ptw'); g('ptw-con').value = 'קבלן'; __out = []; svPtw(); return __out[0].r.num; });
    check('two permits, one deleted (0002): the next is PTW-0004, not PTW-0003', r === 'PTW-0004', r);
  }

  console.log('\n9. no near-miss draft while editing a stored report');
  {
    const r = await ev(() => { DB.near_miss = [{ id: 'nm1', descr: 'שפך', s: 'בטיפול', d: '2026-05-01' }]; try { localStorage.removeItem(_NM_DRAFT_KEY); } catch (e) {} _nmDraftStop(); _genEdit('near_miss', 'nm1'); const t = _NM_DRAFT_TIMER; closeModal('m-nm'); openModal('m-nm'); const t2 = _NM_DRAFT_TIMER; closeModal('m-nm'); _nmDraftStop(); return { edit: !!t, fresh: !!t2 }; });
    check('editing: no draft timer; a new report: the draft timer runs', !r.edit && r.fresh, r);
  }

  console.log('\n10. the desktop "N" key opens the module\'s own new-record opener');
  {
    const r = await ev(() => {
      const c = {}; ['openNewNcrModal', 'openNewIncModal', 'openNewLegModal', '_eqiOpenNew', '_roundOpenNew', '_easpOpenNew', 'thzNew', 'openTskModal'].forEach((n) => { const real = window[n]; window[n] = function () { c[n] = (c[n] || 0) + 1; }; window['__r' + n] = real; });
      const o = {};
      [['ncr', 'openNewNcrModal'], ['inc', 'openNewIncModal'], ['leg', 'openNewLegModal'], ['eqi', '_eqiOpenNew'], ['round', '_roundOpenNew'], ['easp', '_easpOpenNew'], ['thz', 'thzNew'], ['tasks', 'openTskModal']].forEach(([p, n]) => {
        CUR = p; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true })); o[p] = c[n] || 0;
      });
      ['openNewNcrModal', 'openNewIncModal', 'openNewLegModal', '_eqiOpenNew', '_roundOpenNew', '_easpOpenNew', 'thzNew', 'openTskModal'].forEach((n) => { window[n] = window['__r' + n]; });
      CUR = 'tr'; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true })); o.docs = document.getElementById('m-tr').style.display === 'block'; closeModal('m-tr');
      CUR = 'dash';
      return o;
    });
    check('N on ncr, inc, leg, eqi, round, easp, thz, tasks calls their opener', ['ncr', 'inc', 'leg', 'eqi', 'round', 'easp', 'thz', 'tasks'].every((p) => r[p] === 1), r);
    check('N on a plain module still opens its form', r.docs === true, r);
  }

  console.log('\n11. Smart Capture fills the real fields');
  {
    const r = await ev(() => {
      const o = {};
      capDispatch({ type: 'tr', description: 'עבודה בגובה', reporter: 'יוסי', date: '2026-10-01' }); o.tr = [g('t-n').value, g('t-w').value, g('t-d').value]; closeModal('m-tr');
      capDispatch({ type: 'ppe', description: 'נעלי בטיחות', reporter: 'רון' }); o.ppe = [g('ppe-w').value, g('ppe-m').value]; closeModal('m-ppe');
      DB.equip_inspections = [{ id: 'q1', code: 'F-1', n: 'מלגזה' }]; eqiEdit('q1');
      return o;
    });
    await page.waitForTimeout(100);
    const q = await ev(() => { closeModal('m-eqi'); _capPhotoUrl = 'https://x/cap.jpg'; capDispatch({ type: 'eqi', description: 'מדחס', area: 'מחסן' }); const o = { id: g('eqi-id').value, n: g('eqi-n').value, files: _eqiFiles.map((f) => f.url) }; __out = []; svEqi(); o.saved = (__out.find((x) => x.t === 'equip_inspections') || {}).r || null; _capPhotoUrl = null; closeModal('m-eqi'); return o; });
    check('training: t-n, t-w, t-d are filled', r.tr.join('|') === 'עבודה בגובה|יוסי|2026-10-01', r.tr);
    check('PPE: the worker and the description are filled', r.ppe.join('|') === 'רון|נעלי בטיחות', r.ppe);
    check('equipment: a new record (no id kept), the photo in _eqiFiles and saved', q.id === '' && q.n === 'מדחס' && q.files.join() === 'https://x/cap.jpg' && q.saved && q.saved.photo_url === 'https://x/cap.jpg' && q.saved.id !== 'q1', q);
  }

  console.log('\n12. an empty stored date stays empty when the record is edited');
  {
    const r = await ev(() => {
      DB.ncr = [{ id: 'n2', d: 'x', s: 'פתוח', sd: null }]; DB.leg = [{ id: 'lg3', s: 'חוק', u: null }]; DB.inc = [{ id: 'i2', d: 'x', dt: null, s: 'בחקירה' }];
      editNcr('n2'); const a = g('ncr-sd').value; closeModal('m-ncr');
      editLeg('lg3'); const b = g('leg-u').value; closeModal('m-leg');
      editInc('i2'); const c = g('i-dt').value; closeModal('m-inc');
      return [a, b, c];
    });
    check('editNcr ncr-sd, editLeg leg-u, editInc i-dt stay empty', r.join('') === '', r);
  }

  console.log('\n13. small ones');
  {
    const r = await ev(() => {
      const o = {};
      __out = []; openModal('m-tr'); g('t-w').value = 'w'; g('t-n').value = 'n'; g('t-sc').value = ''; svTr(); o.trsc = __out.pop().r.sc;
      openModal('m-aud'); g('a-n').value = 'נושא'; g('a-sc').value = ''; svAud(); o.audsc = __out.filter((x) => x.t === 'auds').pop().r.sc;
      openModal('m-drl'); g('drl-ty').selectedIndex = 1; ['drl-p', 'drl-dur', 'drl-sc'].forEach((i) => { g(i).value = ''; }); svDrl(); const d = __out.filter((x) => x.t === 'drl').pop().r; o.drl = [d.p, d.dur, d.sc];
      openModal('m-wst'); g('wst-q').value = ''; svWst(); o.wstq = __out.filter((x) => x.t === 'wst').pop().r.q;
      // editLeg with no evidence after one with evidence
      DB.leg = [{ id: 'la', s: 'א', c_evidence_url: 'https://x/ev-a.pdf' }, { id: 'lb', s: 'ב', c_evidence_url: null }];
      editLeg('la'); closeModal('m-leg'); editLeg('lb'); o.legev = [_attachUrls['leg-evidence-area'] || null, /ev-a/.test(g('leg-evidence-area').innerHTML)]; closeModal('m-leg');
      // tour hazard: remove the photo while editing
      DB.tour_hazards = [{ id: 'th1', n: 1, dept: 'מעצבים', descr: 'כבל', s: 'פתוח', photo_url: 'https://x/th1.jpg' }];
      _genEdit('tour_hazards', 'th1'); o.thzShown = _attachUrls['thz-attach-area']; _attachClear('thz-attach-area'); __out = []; svThz(); o.thz = __out.pop().r.photo_url;
      // local copy keeps columns the form does not carry
      DB.ncr = [{ id: 'n3', num: 'NCR-0009', d: 'x', s: 'פתוח', verified_by: 'מיכאל' }]; editNcr('n3'); svNcr(); o.ncrv = DB.ncr[0].verified_by;
      DB.tasks = [{ id: 'k2', title: 't', status: 'פתוח', ext_src: 'od' }]; editTsk('k2'); svTsk(); o.tskx = DB.tasks[0].ext_src;
      return o;
    });
    check('empty score/number fields save null, not 0 (svTr sc, svAud sc, svDrl p/dur/sc, svWst q)', r.trsc === null && r.audsc === null && r.drl.every((x) => x === null) && r.wstq === null, r);
    check('editLeg of a law with no evidence shows no evidence (not the previous law\'s)', r.legev[0] === null && r.legev[1] === false, r.legev);
    check('tour hazard: ✎ shows the stored photo, and removing it removes it', r.thzShown === 'https://x/th1.jpg' && r.thz === null, r);
    check('svNcr / svTsk edit: the local row keeps the columns the form does not carry', r.ncrv === 'מיכאל' && r.tskx === 'od', r);
    await ev(() => { DB.docs = [{ id: 'dv1', n: 'ישן', s: 'בתוקף' }]; showView('docs', 'dv1'); });
    await page.waitForTimeout(100);
    await ev(() => { _genEdit('docs', 'dv1'); g('d-n').value = 'חדש'; svDoc(); });
    await page.waitForTimeout(150);
    const vw = await ev(() => ({ cur: CUR, txt: (document.getElementById('pg-view') || document.body).textContent }));
    check('✎+save on the view page shows the new value there', vw.cur === 'view' && /חדש/.test(vw.txt) && !/ישן/.test(vw.txt), { cur: vw.cur });
  }

  check('no page errors', !errs.length, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
