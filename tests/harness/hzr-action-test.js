// Required action in the department report (06/10/2026, Michael: "filled automatically
// with my approval", and "the trustees too"): rows with no action get a suggestion on
// request; only "approve" saves it (op setAction), "skip" saves nothing; the hazard form
// gets the same suggestion into its field. _truApi stubbed with the server's shape.
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
    window.addLog = function () {}; window.sdb = function () {}; const toasts = []; window.toast = (m) => toasts.push(String(m));
    window._role = () => 'admin'; window._isAdminUser = () => true;
    const calls = []; let saveOk = true;
    DB.tour_hazards = [{ id: 'th-54', n: 54, descr: 'ליקוי סימון מדרגה', action: null }];
    const row = (id, n, descr, sev, noAction) => ({ id, n, opened: '06/10/2026', loc: 'מעבדה', descr, sev, resp: 'בטיחות', action: '', due: '20/10/2026', status: 'פתוח', noAction });
    window._truApi = function (p, b) {
      calls.push([p, JSON.parse(JSON.stringify(b))]);
      if (b.op === 'preview') return Promise.resolve({ ok: true, canSend: true, reports: [
        { dept: 'מעבדות', title: 't', to: ['m@t'], cc: [], count: 3, rows: [row('h:th-54', 54, 'ליקוי סימון מדרגה', 'בינונית', true), row('h:th-24', 24, 'מנדף', 'גבוהה', false), row('t:mud1', 'נ-1', 'פנס תאורה', 'בינונית', true)] },
        { dept: 'תוצג', title: 't', to: ['i@t'], cc: [], count: 1, rows: [row('t:mud1', 'נ-1', 'פנס תאורה', 'בינונית', true)] }] });
      if (b.op === 'suggest') return Promise.resolve({ ok: true, suggestions: b.items.map((it) => ({ id: it.id, action: it.id === 't:mud1' ? null : 'לחדש את סימון המדרגה בפס מחזיר אור' })) });
      if (b.op === 'setAction') return Promise.resolve(saveOk ? { ok: true, saved: true, action: b.action } : { ok: false, saved: false });
      return Promise.resolve({ ok: true });
    };
    const o = {};
    hzrOpen(); await new Promise((res) => setTimeout(res, 50));
    const box = () => document.getElementById('hzr-act');
    o.head = box() && box().textContent;
    o.noCallYet = calls.filter((c) => c[1].op !== 'preview').length;
    await hzrSuggest();
    o.sugCall = calls.find((c) => c[1].op === 'suggest');
    o.areas = Array.from(document.querySelectorAll('#hzr-act textarea')).map((t) => t.value);
    o.noSave = calls.filter((c) => c[1].op === 'setAction').length;
    o.missText = box().textContent;
    document.getElementById('hzr-sg-0').value = 'לחדש את סימון המדרגה בפס מחזיר אור צהוב-שחור';
    o.ok = await hzrApprove(0);
    o.setCall = calls.find((c) => c[1].op === 'setAction');
    o.local = DB.tour_hazards[0].action;
    o.savedText = box().textContent;
    o.emptyApprove = await hzrApprove(1);
    hzrSkip(1);
    o.skipText = box().textContent;
    o.saves = calls.filter((c) => c[1].op === 'setAction').length;
    saveOk = false; hzrOpen(); await new Promise((res) => setTimeout(res, 50)); await hzrSuggest();
    o.fail = await hzrApprove(0); o.failToast = toasts.slice(-1)[0];
    o.wide = document.getElementById('hzr').scrollWidth;
    // the hazard form
    hzrClose(); openModal('m-thz'); g('thz-descr').value = 'מכשיר חימום לא במקום'; g('thz-action').value = '';
    o.form = await thzSuggest(); o.formVal = g('thz-action').value;
    o.formCall = calls.slice(-1)[0];
    g('thz-descr').value = 'x'; o.formShort = await thzSuggest();
    return o;
  });
  check('a box above the departments: 2 rows without an action (the trustee row once, though in two reports)', /2 מפגעים בלי פעולה נדרשת/.test(r.head || '') && /רק מה שתאשר נשמר/.test(r.head || ''), r.head);
  check('nothing asked of the server until "הצע פעולות"', r.noCallYet === 0, r.noCallYet);
  check('suggest: the two rows, with their text and place', r.sugCall && r.sugCall[1].items.length === 2 && r.sugCall[1].items[0].id === 'h:th-54' && r.sugCall[1].items[0].f === 'ליקוי סימון מדרגה' && r.sugCall[1].items[0].loc === 'מעבדה', r.sugCall);
  check('each suggestion in an editable box; none for the trustee row says so', r.areas[0] === 'לחדש את סימון המדרגה בפס מחזיר אור' && r.areas[1] === '' && /לא התקבלה הצעה/.test(r.missText), r.areas);
  check('the date and the severity show on each card', /מס' 54, נפתח 06\/10\/2026/.test(r.missText) && /בינונית/.test(r.missText), r.missText.slice(0, 200));
  check('nothing saved before "אשר"', r.noSave === 0, r.noSave);
  check('approve: the edited text saved for that row only', r.ok === 'saved' && r.setCall[1].id === 'h:th-54' && r.setCall[1].action === 'לחדש את סימון המדרגה בפס מחזיר אור צהוב-שחור', r.setCall);
  check('...shown as approved, and in the local copy', /אושר ונשמר/.test(r.savedText) && r.local === 'לחדש את סימון המדרגה בפס מחזיר אור צהוב-שחור', [r.local]);
  check('approve with an empty box: not sent', r.emptyApprove === 'empty', r.emptyApprove);
  check('skip: nothing saved, said so', /דילגת/.test(r.skipText) && r.saves === 1, [r.saves]);
  check('the server did not save (someone wrote one meanwhile): said so, not marked approved', r.fail === 'failed' && /לא נשמר/.test(r.failToast || ''), [r.fail, r.failToast]);
  check('fits a phone', r.wide <= 375, r.wide);
  check('hazard form: "הצע פעולה" fills the empty field (saved only with the form)', r.form === 'filled' && r.formVal === 'לחדש את סימון המדרגה בפס מחזיר אור' && r.formCall[1].op === 'suggest' && r.formCall[1].items[0].f === 'מכשיר חימום לא במקום', [r.form, r.formVal]);
  check('hazard form: no description, nothing asked', r.formShort === 'empty');
  check('no page errors', errors.length === 0, errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
