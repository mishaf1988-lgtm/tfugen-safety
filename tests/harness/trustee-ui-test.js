// The trustee screen on the floor (15/10/2026): what a review of the kiosk
// found that loses a report, loses points, or tells the trustee something
// untrue. One section per finding (D1, D5, A7, W2-W7, A1-A4).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const KEY = 'tfgn_tru_draft_v1';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  let answer = true, prompts = [];
  page.on('dialog', (d) => { prompts.push(d.message()); (answer ? d.accept() : d.dismiss()).catch(() => {}); });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // A kiosk with the outbox stubbed: sbIns queues (as on a phone with no signal)
  // unless window.__direct, then it "sends" at once (nothing left in the queue).
  const boot = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.body.classList.add('emp-mode');
    window.__empToasts = []; window.empToast = (m) => window.__empToasts.push(String(m));
    window.__toasts = []; window.toast = (m) => window.__toasts.push(String(m));
    window.__direct = false;
    window.sbIns = function (t, r) { if (!window.__direct) _obPush({ op: 'ins', tbl: t, row: r }); };
    window.sbUpd = function () {}; window.sdb = function () {};
    window.sbGet = function () { window.__pulls = (window.__pulls || 0) + 1; return Promise.resolve(null); };
    DB.trustees = [{ id: 'r1', n: 'מוסא', dep: 'חומר גלם', active: true }, { id: 'r2', n: 'לב', active: true }];
    DB.trustee_reports = [];
    ['tfgn_tru_draft_v1', 'tfgn_trustee_name', 'tfgn_tru_shared', 'tfgn_outbox', 'tfgn_outbox_lasterr'].forEach((k) => localStorage.removeItem(k));
    Object.keys(_attachUrls).forEach((k) => { if (k.indexOf('tru-ph-') === 0) delete _attachUrls[k]; });
    try { closeModal('m-tru'); } catch (e) {}
    _truFormReset();
  });
  const fill = () => page.evaluate(() => {
    _truReport();
    document.getElementById('tru-u').value = 'מוסא';
    document.getElementById('tru-loc').value = 'מחסן';
    _truFormToggle(5);
    const k = _truFormTask(5).items[0].k;
    _truFormSetOk(5, k, false);
    document.querySelector('[data-tru-f][data-n="5"]').value = 'חסרה פלומבה';
    _attachUrls[_truPhId(5, k)] = 'https://x/p.jpg';
    _truFormSync();
    return k;
  });
  const draft = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, KEY);
  const modal = () => page.evaluate(() => document.getElementById('m-tru').style.display);

  console.log('\nD1. sending an "after" photo leaves the unsent tour alone');
  {
    await boot();
    await fill();
    await page.evaluate(() => { _truDraftSave(); _truClose(); _truFormReset(); });
    check('the tour is written down', (await draft()) !== null);
    prompts = [];
    await page.evaluate(() => {
      DB.trustee_reports = [{ id: 'f1', u: 'מוסא', t: 3, d: _truToday(), m: _truThisMonth(), loc: 'מחסן', ok: false, f: 'דלת חסומה', s: 'פתוח' }];
      _truCloseReport('f1'); _attachUrls['tru-ph-8-ok'] = 'https://x/after.jpg'; svTru();
    });
    const after = await page.evaluate(() => DB.trustee_reports.filter((r) => r.t === 8).length);
    check('the closure was saved', after === 1, after);
    check('...and the tour draft is still there', (await draft()) !== null);
  }

  console.log('\nD5. the draft survives the phone, and the back button');
  {
    await boot();
    await fill();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    check('going to the background writes the draft at once (no 5s wait)', (await draft()) !== null);
    await page.evaluate((k) => { localStorage.removeItem(k); window.dispatchEvent(new Event('pagehide')); }, KEY);
    check('pagehide writes it too', (await draft()) !== null);

    // Android back: the form had no history entry of its own, so the PWA exited.
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    const st = await page.evaluate(() => ({ s: history.state, cur: CUR }));
    check('opening the form pushes a history entry (the shared form entry, _mhPush)', st.s && st.s.modal === 'm-tru', st);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(250);
    check('back closes the form', (await modal()) === 'none');
    check('...saves the tour', (await draft()) !== null);
    check('...and stays on the trustee screen', (await page.evaluate(() => CUR)) === st.cur, st.cur);

    // Cancel / X take their history entry with them.
    await page.evaluate(() => { _truReport(); });
    const before = await page.evaluate(() => history.length);
    await page.evaluate(() => _truClose());
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({ s: history.state, hist: _truHist }));
    check('closing with X leaves no form entry behind', !(after.s && after.s.truModal) && after.hist === false, { before, after });
    const markup = await page.evaluate(() => ['ov-tru'].map((id) => document.getElementById(id).getAttribute('onclick')).concat([document.querySelector('#m-tru .close-btn').getAttribute('onclick'), document.querySelector('#m-tru .modal-footer .btn-s').getAttribute('onclick')]));
    check('overlay, X and Cancel all close through _truClose', markup.every((x) => x === '_truClose()'), markup);
  }

  console.log('\nD5. the restore question');
  {
    await boot();
    await fill();
    await page.evaluate((k) => {
      const sn = _truDraftSnapshot();
      sn.form.tasks['3'] = { items: [{ k: 99, loc: '', ok: true, f: '', fx: false }] };    // switched off again: not in sel
      sn.fields['tru-d'] = '2026-10-14';
      _truClose(); _truFormReset();          // closing saves the live form; the doctored one goes in after
      localStorage.setItem(k, JSON.stringify({ snap: sn, ts: Date.now() - 3 * 86400000 }));
    }, KEY);
    answer = true; prompts = [];
    await page.evaluate(() => _truReport());
    await page.waitForTimeout(100);
    const q = prompts[0] || '';
    check('a 3-day-old tour is offered, not dropped', /3 ימים/.test(q), q);
    check('...naming the trustee and the date (DD/MM/YYYY)', /מוסא/.test(q) && /14\/10\/2026/.test(q), q);
    check('...and counting only the ticked tasks', /1 משימות/.test(q), q);
    await page.evaluate((k) => { const d0 = localStorage.getItem(k); _truClose(); _truFormReset(); const d = JSON.parse(d0); d.ts = Date.now() - 8 * 86400000; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
    prompts = [];
    await page.evaluate(() => _truReport());
    check('older than 7 days: not offered', prompts.length === 0, prompts);
    await page.evaluate(() => { _truClose(); _truFormReset(); });

    // Cancel keeps it until the new tour has something in it.
    await fill();
    await page.evaluate(() => { _truDraftSave(); _truClose(); _truFormReset(); });
    answer = false; prompts = [];
    await page.evaluate(() => _truReport());
    await page.evaluate(() => { _truDraftSave(); _truClose(); _truFormReset(); });
    const kept = await draft();
    check('Cancel, then an empty form closed: the old tour is still there', kept && /פלומבה/.test(JSON.stringify(kept.snap.form.tasks)), kept && kept.snap.form.tasks);
    await page.evaluate(() => {
      _truReport(); _truFormToggle(2); _truFormSetOk(2, _truFormTask(2).items[0].k, true); _truDraftSave(); _truClose(); _truFormReset();
    });
    const repl = await draft();
    check('...and replaced once the new tour has content', repl && repl.snap.form.sel['2'] && !repl.snap.form.sel['5'], repl && repl.snap.form.sel);
  }

  console.log('\nA7. a name typed under "other" comes back visible');
  {
    await boot();
    await page.evaluate((k) => {
      _truReport();
      document.getElementById('tru-u').value = '__other__'; _truUChanged('__other__');
      document.getElementById('tru-u-other').value = 'אורחת';
      document.getElementById('tru-loc').value = 'מחסן';
      _truFormToggle(1); _truFormSetOk(1, _truFormTask(1).items[0].k, true);
      _truDraftSave(); _truClose(); _truFormReset();
    }, KEY);
    answer = true; prompts = [];
    await page.evaluate(() => _truReport());
    const r = await page.evaluate(() => ({ sel: document.getElementById('tru-u').value, other: document.getElementById('tru-u-other').value, shown: getComputedStyle(document.getElementById('tru-u-other')).display }));
    check('the box with the typed name is shown, holding the name', r.sel === '__other__' && r.other === 'אורחת' && r.shown !== 'none', r);
    await page.evaluate(() => { _truClose(); _truFormReset(); });
  }

  console.log('\nW3. a shared phone, and closing someone\'s finding');
  {
    await boot();
    await page.evaluate(() => { _truSetMe('לב'); window.__direct = true; });
    await page.evaluate(() => {
      _truReport(1); document.getElementById('tru-u').value = 'מוסא'; document.getElementById('tru-loc').value = 'מחסן';
      _truFormSetOk(1, _truFormTask(1).items[0].k, true); svTru();
    });
    const r = await page.evaluate(() => ({ me: _truMe(), shared: _truShared() }));
    check('another trustee sending from this phone does not become its owner', r.me === 'לב' && r.shared, r);
    const pre = await page.evaluate(() => { _truReport(2); const v = document.getElementById('tru-u').value; _truClose(); _truFormReset(); return v; });
    check('...and the next tour opens on "choose", not on the last sender', pre === '', pre);
    await page.evaluate(() => { _truSetMe('לב'); });
    const pre2 = await page.evaluate(() => { _truReport(2); const v = document.getElementById('tru-u').value; _truClose(); _truFormReset(); return v; });
    check('a name picked on the screen (the trustee confirming) prefills again', pre2 === 'לב', pre2);

    await page.evaluate(() => { DB.trustee_reports.push({ id: 'h1', u: 'מוסא', t: 3, d: _truToday(), m: _truThisMonth(), loc: 'מחסן', ok: false, f: 'דלת חסומה', s: 'פתוח' }); });
    const c = await page.evaluate(() => { _truCloseReport('h1'); return { v: document.getElementById('tru-u').value, dis: document.getElementById('tru-u').disabled }; });
    check('closing a finding: the name is the finding\'s trustee, and locked', c.v === 'מוסא' && c.dis, c);
    await page.evaluate(() => { _attachUrls['tru-ph-8-ok'] = 'https://x/a.jpg'; svTru(); });
    const s1 = await page.evaluate(() => DB.trustee_reports.find((x) => x.id === 'h1').s);
    check('...sent under that name: closed on the screen too', s1 === 'נסגר', s1);
    await page.evaluate(() => { DB.trustee_reports.push({ id: 'h2', u: 'מוסא', t: 3, d: _truToday(), m: _truThisMonth(), loc: 'מחסן', ok: false, f: 'מטף חסר', s: 'פתוח' }); });
    await page.evaluate(() => {
      _truCloseReport('h2'); const u = document.getElementById('tru-u'); u.disabled = false; u.value = 'לב';
      _attachUrls['tru-ph-8-ok'] = 'https://x/b.jpg'; svTru();
    });
    const s2 = await page.evaluate(() => DB.trustee_reports.find((x) => x.id === 'h2').s);
    check('a closing row under another name is not shown as closing it (the trigger would not)', s2 === 'פתוח', s2);
    const tour = await page.evaluate(() => { _truReport(1); const d = document.getElementById('tru-u').disabled; _truClose(); _truFormReset(); return d; });
    check('the next tour has the name picker unlocked again', tour === false, tour);
  }

  console.log('\nW4. task 8 in a tour is תקין only');
  {
    await boot();
    const r = await page.evaluate(() => {
      _truReport(8);
      const blk = document.querySelector('#tru-tasks [data-tru-blk="8"]');
      const out = { ok: !!blk.querySelector('[data-tru-ok="8"]'), bad: !!blk.querySelector('[data-tru-bad="8"]') };
      document.getElementById('tru-u').value = 'מוסא'; document.getElementById('tru-loc').value = 'מחסן';
      const it = _truFormTask(8).items[0]; it.ok = false; it.f = 'x'; _attachUrls[_truPhId(8, it.k)] = 'https://x/8.jpg';
      out.block = (_truFormBlocker() || {}).msg || '';
      const n = DB.trustee_reports.length; svTru(); out.saved = DB.trustee_reports.length - n;
      _truClose(); _truFormReset();
      return out;
    });
    check('the task-8 block offers תקין and no ליקוי', r.ok && !r.bad, r);
    check('a ליקוי on task 8 (an old draft) is stopped before sending', /משימה 8|במשימה 8/.test(r.block) && r.saved === 0, r);
  }

  console.log('\nW5. the tour date: today back to 7 days');
  {
    await boot();
    const r = await page.evaluate(() => {
      _truReport(1); document.getElementById('tru-u').value = 'מוסא'; document.getElementById('tru-loc').value = 'מחסן';
      _truFormSetOk(1, _truFormTask(1).items[0].k, true);
      const day = (n) => { const p = _truToday().split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().substring(0, 10); };
      const out = {};
      [['m8', -8], ['p1', 1], ['m7', -7], ['t0', 0]].forEach(([k, n]) => { document.getElementById('tru-d').value = day(n); out[k] = (_truFormBlocker() || {}).msg || null; });
      document.getElementById('tru-d').value = day(-30);
      const n0 = DB.trustee_reports.length; svTru(); out.saved = DB.trustee_reports.length - n0;
      _truClose(); _truFormReset();
      return out;
    });
    check('8 days back and tomorrow are refused', /7 ימים/.test(r.m8 || '') && /עתיד/.test(r.p1 || ''), r);
    check('7 days back and today are fine', r.m7 === null && r.t0 === null, r);
    check('svTru refuses a month-old date as well', r.saved === 0, r);
  }

  console.log('\nW6. "sent" only once it was sent');
  {
    await boot();
    await fill();
    await page.evaluate(() => svTru());
    const first = await page.evaluate(() => window.__empToasts.slice());
    check('right after tapping send: saved on the phone, sending', /נשמר בטלפון/.test(first[0] || '') && /שולח/.test(first[0] || '') && !/לממונה/.test(first[0] || ''), first);
    await page.waitForTimeout(200);
    const last = await page.evaluate(() => window.__empToasts.slice(-1)[0]);
    check('no signal: then says it is waiting on the phone', /שמור בטלפון/.test(last || '') && /כשיהיה חיבור/.test(last || ''), last);
    await page.evaluate(() => { window.__direct = true; });
    await fill();
    await page.evaluate(() => svTru());
    await page.waitForTimeout(200);
    const sent = await page.evaluate(() => window.__empToasts.slice(-1)[0]);
    check('nothing left in the outbox: sent to the safety officer', /נשלח לממונה הבטיחות/.test(sent || ''), sent);
  }

  console.log('\nW7 + A4. the waiting line says what waits and why');
  {
    await boot();
    const r = await page.evaluate(async () => {
      _obSet([
        { op: 'ins', tbl: 'trustee_reports', row: { id: 'a' } }, { op: 'ins', tbl: 'trustee_reports', row: { id: 'b' } },
        { op: 'ins', tbl: 'audit_log', row: { id: 'c' } }, { op: 'ins', tbl: 'audit_log', row: { id: 'd' } },
      ]);
      _phN = 1;
      _obSetErr({ tbl: 'trustee_reports', op: 'ins', status: 429, body: '', ts: Date.now() });
      _obBadge();
      await new Promise((r2) => setTimeout(r2, 50));
      const out = { txt: document.getElementById('emp-sync-txt').textContent, sub: document.getElementById('emp-sync-sub').textContent, count: document.getElementById('emp-sync-count').textContent };
      _obSetErr(null); _obBadge();
      await new Promise((r2) => setTimeout(r2, 50));
      out.sub2 = document.getElementById('emp-sync-sub').textContent;
      _phN = 0; _obSet([]); _obBadge();
      return out;
    });
    check('2 reports (the audit rows are not reports) and the photo on its own', /2 דיווחים/.test(r.txt) && /תמונה אחת/.test(r.txt) && !/4/.test(r.txt), r);
    check('a 429 says the daily limit, not "automatically"', /מכסת הדיווחים היומית/.test(r.sub), r.sub);
    check('no error: will be sent when there is a connection', /כשיהיה חיבור/.test(r.sub2), r.sub2);
    check('the core counter is still kept (hidden) for the badge', r.count === '5', r.count);
  }

  console.log('\nA1. a photo waiting on the phone stays a photo after a re-render');
  {
    await boot();
    const r = await page.evaluate(async () => {
      await new Promise((res) => _phPut({ pid: 'phT1', blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), name: 'a.png', prefix: 'x', ts: Date.now() }, res));
      _truReport(5); const k = _truFormTask(5).items[0].k; _truFormSetOk(5, k, false);
      const id = _truPhId(5, k); _attachUrls[id] = 'pending:phT1';
      _truFormRender();
      await new Promise((r2) => setTimeout(r2, 150));
      const html = document.getElementById(id).innerHTML;
      _truClose(); _truFormReset();
      await new Promise((res) => _phDel('phT1', res));
      return { img: /<img[^>]+src="blob:/.test(html), kept: /נשמרה במכשיר/.test(html), file: /&#128196;|📄/.test(html) };
    });
    check('drawn from the queued blob with the "kept on the phone" note, not a file link', r.img && r.kept && !r.file, r);
  }

  console.log('\nA2. removing an item');
  {
    await boot();
    const r = await page.evaluate(() => {
      _truReport(5); _truFormAddItem(5); _truFormAddItem(5);
      const its = _truFormTask(5).items;
      document.querySelector('[data-tru-loc][data-k="' + its[0].k + '"]').value = 'מטף מזרחי';
      const btn = document.querySelector('#tru-tasks [onclick^="_truFormRmItem("]');
      const h = btn.getBoundingClientRect().height;
      return { h, k0: its[0].k, k2: its[2].k };
    });
    check('the remove button is a 44px target', r.h >= 44, r.h);
    answer = false; prompts = [];
    await page.evaluate((k) => _truFormRmItem(5, k), r.k0);
    const n1 = await page.evaluate(() => _truFormTask(5).items.length);
    check('an item with text asks first; No keeps it', prompts.length === 1 && n1 === 3, { prompts, n1 });
    answer = true; prompts = [];
    await page.evaluate((k) => _truFormRmItem(5, k), r.k2);
    const n2 = await page.evaluate(() => _truFormTask(5).items.length);
    check('an empty item goes without a question', prompts.length === 0 && n2 === 2, { prompts, n2 });
    await page.evaluate(() => { _truClose(); _truFormReset(); });
  }

  console.log('\nA3. coming back to the app pulls at most once a minute');
  {
    await boot();
    const n = await page.evaluate(() => {
      EMP_HOME_TRUSTEES_ONLY = true; _truEmpHome(false);
      window.__pulls = 0; _truPullAt = 0;
      for (let i = 0; i < 4; i++) window.dispatchEvent(new Event('focus'));
      const a = window.__pulls;
      _truPullAt = Date.now() - 61000; window.dispatchEvent(new Event('focus'));
      return { a, b: window.__pulls };
    });
    // _truPull asks four tables per pull; count pulls by trustee_reports-sized groups.
    check('four focus events in a row: one pull', n.a === 4, n);
    check('a minute later: another', n.b === 8, n);
  }

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await page.close();

  console.log('\nW2. Israel calendar, not UTC');
  {
    const p = await ctx.newPage();
    await p.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await p.clock.setFixedTime(new Date('2026-10-31T22:30:00Z'));   // 00:30 on 01/11 in Israel
    await p.goto(HTML, { waitUntil: 'load' });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      document.body.classList.add('emp-mode'); window.sbIns = function () {}; window.sdb = function () {};
      _truReport(1);
      const out = { today: _truToday(), month: _truThisMonth(), d: document.getElementById('tru-d').value, left: _truDaysLeft() };
      document.getElementById('tru-d').value = '';
      document.getElementById('tru-u').value = '__other__'; _truUChanged('__other__'); document.getElementById('tru-u-other').value = 'רון';
      document.getElementById('tru-loc').value = 'מחסן'; _truFormSetOk(1, _truFormTask(1).items[0].k, true); svTru();
      const row = DB.trustee_reports[DB.trustee_reports.length - 1];
      out.rowD = row.d; out.rowM = row.m;
      return out;
    });
    check('00:30 on the 1st is the 1st: date, month, form default', r.today === '2026-11-01' && r.month === '2026-11' && r.d === '2026-11-01', r);
    check('an empty date falls back to the Israeli day and month', r.rowD === '2026-11-01' && r.rowM === '2026-11', r);
    check('days left in the month follow the same calendar', r.left === 29, r.left);
    await p.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
