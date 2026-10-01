// BACKLOG 4.13: "תיקנתי במקום" in the trustee tour form. A small finding the
// trustee fixes on the spot is reported and closed in one step: the finding
// (saved already closed) plus its task-8 closing row with the "after" photo,
// the same two rows "צלם אחרי" writes later, so the score does not change.
// The alert still goes to the manager, labelled "תוקן במקום" (Michael,
// 01/10/2026: "כן" to the recommendation).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  await page.evaluate(async () => {
    localStorage.removeItem('tfgn_outbox');
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.empToast = function () {};
    window.__ins = []; window.sbIns = function (t, r) { window.__ins.push({ t, r }); };
    window.sbGet = function () { return Promise.resolve([]); };
    try { localStorage.setItem('tfgn_emp_code', 'RIGHT'); } catch (e) {}
    doEmpLogin();
    await new Promise((r) => { const t0 = Date.now(); (function w() { if (CUR === 'emp-home' || Date.now() - t0 > 4000) return r(); setTimeout(w, 50); })(); });
    DB.trustee_reports = [];
  });
  const open = () => page.evaluate(() => {
    _truReport(3);
    document.getElementById('tru-u').value = '__other__'; _truUChanged('__other__');
    document.getElementById('tru-u-other').value = 'דנה';
    document.getElementById('tru-loc').value = 'אולם טיגון';
    const k = _truFormTask(3).items[0].k;
    _truFormSetOk(3, k, false);
    document.querySelector('#tru-tasks [data-tru-f][data-k="' + k + '"]').value = 'שלט יציאה נפל';
    _attachUrls[_truPhId(3, k)] = 'https://x/before.jpg';
    return k;
  });

  console.log('\n4.13 the checkbox is there only for a finding');
  {
    const r = await page.evaluate(() => {
      _truReport(3);
      const k = _truFormTask(3).items[0].k;
      const none = !!document.querySelector('#tru-tasks [data-tru-fx]');
      _truFormSetOk(3, k, true); const onOk = !!document.querySelector('#tru-tasks [data-tru-fx]');
      _truFormSetOk(3, k, false); const onBad = !!document.querySelector('#tru-tasks [data-tru-fx]');
      const label = (document.querySelector('#tru-tasks [data-tru-fx]') || {}).parentNode;
      return { none, onOk, onBad, label: label ? label.textContent : '', afterSlot: !!document.getElementById(_truPhAfterId(3, k)) };
    });
    check('no checkbox before a verdict or on a תקין item', !r.none && !r.onOk, r);
    check('a ליקוי shows "✅ תיקנתי במקום"', r.onBad && /תיקנתי במקום/.test(r.label), r);
    check('...and no "after" photo slot until it is ticked', !r.afterSlot, r);
  }

  console.log('\n4.13 ticked: the "after" photo is mandatory');
  {
    const r = await page.evaluate((k) => {
      _truFormSetFx(3, k, true);
      const slot = !!document.getElementById(_truPhAfterId(3, k));
      const blocker = (_truFormBlocker() || {}).msg || '';
      const n0 = DB.trustee_reports.length; svTru();
      return { slot, blocker, saved: DB.trustee_reports.length - n0, toast: window.__toasts.slice(-1)[0] || '' };
    }, await open());
    check('ticking opens an "after" photo slot', r.slot, r);
    check('the live status line asks for the "after" photo', /אחרי/.test(r.blocker), r.blocker);
    check('send without it saves nothing and says why', r.saved === 0 && /אחרי/.test(r.toast), r);
  }

  console.log('\n4.13 saved: the finding closed, plus its task-8 closing row');
  {
    const r = await page.evaluate((k) => {
      _truFormSetFx(3, k, true);
      _attachUrls[_truPhAfterId(3, k)] = 'https://x/after.jpg';
      window.__ins = []; svTru();
      const ins = window.__ins.filter((x) => x.t === 'trustee_reports').map((x) => x.r);
      const f = ins.find((x) => x.t === 3), c = ins.find((x) => x.t === TRUSTEE_TASK_CLOSE);
      const sc = _truScore('דנה', _truThisMonth());
      return { n: ins.length, f, c, sc: { closed: sc.closed, open: sc.open, task8: !!sc.tasks[8] }, modal: document.getElementById('m-tru').style.display };
    }, await open());
    check('two rows go to the server: the finding and the closing report', r.n === 2 && r.f && r.c, r);
    check('the finding is a ליקוי with its own "before" photo, saved already closed', r.f && r.f.ok === false && r.f.s === 'נסגר' && r.f.photo_url === 'https://x/before.jpg', r.f);
    check('the closing row is task 8, points at the finding, carries the "after" photo', r.c && r.c.ok === true && r.c.ref === r.f.id && r.c.photo_url === 'https://x/after.jpg' && r.c.u === r.f.u, r.c);
    check('scoring is the same as צלם אחרי: one closed, none open, task 8 done', r.sc.closed === 1 && r.sc.open === 0 && r.sc.task8, r.sc);
    check('the form closes', r.modal === 'none', r.modal);
  }

  console.log('\n4.13 unticking or switching to תקין drops it');
  {
    const r = await page.evaluate((k) => {
      _truFormSetFx(3, k, true); _attachUrls[_truPhAfterId(3, k)] = 'https://x/after.jpg';
      _truFormSetFx(3, k, false);
      const goneUntick = !_attachUrls[_truPhAfterId(3, k)];
      window.__ins = []; svTru();
      const ins = window.__ins.filter((x) => x.t === 'trustee_reports').map((x) => x.r);
      return { goneUntick, n: ins.length, s: ins[0] && ins[0].s };
    }, await open());
    check('unticked: the "after" photo is dropped', r.goneUntick, r);
    check('...and it saves as an ordinary open finding, one row', r.n === 1 && r.s === 'פתוח', r);
  }

  console.log('\n4.13 the manager alert says it was fixed');
  {
    // The Pages Function is not importable here; its norm is one expression.
    const src = require('fs').readFileSync(path.resolve(__dirname, '../../functions/api/trustee-notify.js'), 'utf8');
    const m = src.match(/norm: \(r\) => (\(r\.s === 'נסגר'[^\n]*),\n/);
    check('trustee-notify labels a finding already closed', !!m, null);
    if (m) {
      const fn = eval('(r) => ' + m[1]);
      const closed = fn({ s: 'נסגר', f: 'שלט יציאה נפל' }), open = fn({ s: 'פתוח', f: 'שלט יציאה נפל' });
      check('...as "✅ תוקן במקום" in front of the finding', closed.f === '✅ תוקן במקום: שלט יציאה נפל', closed);
      check('...and leaves an open one as it was', open.f === 'שלט יציאה נפל', open);
    }
  }

  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
