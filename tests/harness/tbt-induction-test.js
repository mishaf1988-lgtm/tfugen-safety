// New-worker induction in the manager's screens (10/10/2026): the form's checkbox saves
// kind=induction, edit and duplicate bring it back, a new form starts without it; the list
// marks it and counts signatures without "of all workers"; the link dialog says the link is
// permanent and offers "cancel link"; who-signed shows no "did not sign" list for it.
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
    window.sbIns = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]); window.sbUpd = (t, x) => ins.push([t, JSON.parse(JSON.stringify(x))]);
    window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    window.qrcode = function () { return { addData() {}, make() {}, getModuleCount() { return 21; }, isDark() { return false; } }; };
    DB.emp = [{ id: 'e1', n: 'אחמד', dep: 'ייצור' }, { id: 'e2', n: 'דנה', dep: 'אריזה' }];
    DB.toolbox_talks = []; DB.toolbox_reads = [];
    goPage('toolbox');
    const o = {};
    const set = (id, v) => { document.getElementById(id).value = v; };
    openModal('m-tbt');
    o.box = !!document.getElementById('tbt-kind'); o.box0 = document.getElementById('tbt-kind').checked;
    set('tbt-title', 'הוראות כניסה למשמרת'); set('tbt-body', 'כללי'); set('tbt-trainer', 'מיכאל'); set('tbt-trainer-q', 'ממונה'); set('tbt-s', 'פורסמה');
    document.getElementById('tbt-kind').checked = true;
    svTbt(); const sv = ins.slice(-1)[0][1]; o.kind = sv.kind; const id = sv.id;
    openModal('m-tbt'); o.newAfter = document.getElementById('tbt-kind').checked; set('tbt-title', 'שבועית'); set('tbt-body', 'x'); set('tbt-trainer', 'מיכאל'); set('tbt-trainer-q', 'ממונה'); set('tbt-s', 'פורסמה'); svTbt(); o.weekKind = ins.slice(-1)[0][1].kind; const wid = ins.slice(-1)[0][1].id;
    _genEdit('toolbox_talks', id); o.edit = document.getElementById('tbt-kind').checked; closeModal('m-tbt');
    _genEdit('toolbox_talks', wid); o.editWk = document.getElementById('tbt-kind').checked; closeModal('m-tbt');
    tbtDup(id); o.dup = document.getElementById('tbt-kind').checked; closeModal('m-tbt');
    DB.toolbox_reads = [{ id: 'r1', talk_id: id, emp_id: 'x:123:dani', emp_name: 'דני', read_at: '2026-10-11T07:00:00Z', doc_url: 'https://od.example/f.pdf', mailed_at: '2026-10-11T07:01:00Z' }, { id: 'r2', talk_id: id, emp_id: 'x:456:rami', emp_name: 'רמי', read_at: '2026-10-11T07:02:00Z', doc_err: 'outlook 429: quota' }, { id: 'r3', talk_id: id, emp_id: 'x:789:gil', emp_name: 'גיל', read_at: '2026-10-11T07:03:00Z' }];
    rTbt();
    const row = Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes('הוראות כניסה'));
    o.tag = row.textContent.includes('קליטת עובד חדש'); o.count = row.querySelector('[onclick^="tbtWho"]').textContent.trim();
    const wrow = Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes('שבועית') && !tr.textContent.includes('הוראות'));
    o.wcount = wrow.querySelector('[onclick^="tbtWho"]').textContent.trim();
    // link: permanent wording and the cancel button
    const calls = [];
    window.fetch = (u, init) => { const b = JSON.parse(init.body); calls.push(b); return Promise.resolve(new Response(JSON.stringify(b.op === 'revoke' ? { url: 'https://tapugan-safety.pages.dev/api/talk?k=new', perm: true, link_v: 1 } : { url: 'https://tapugan-safety.pages.dev/api/talk?k=perm0', perm: true, link_v: 0 }), { status: 200 })); };
    o.link = await tbtLink(id);
    o.days = document.getElementById('tbt-link-days').textContent; o.url = document.getElementById('tbt-link-url').value;
    o.rvShown = document.getElementById('tbt-link-revoke').style.display !== 'none';
    window.confirm = () => false; o.kept = await tbtRevoke(); o.keptCalls = calls.filter((c) => c.op === 'revoke').length;
    window.confirm = () => true; o.rev = await tbtRevoke(); o.revUrl = document.getElementById('tbt-link-url').value; o.revToast = toasts.slice(-1)[0];
    o.linkV = DB.toolbox_talks.find((x) => x.id === id).link_v;
    closeModal('m-tbt-link');
    // a weekly talk's link dialog has no cancel button
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({ url: 'https://tapugan-safety.pages.dev/api/talk?k=wk', days: 14, link_at: new Date().toISOString() }), { status: 200 }));
    await tbtLink(wid); o.rvWk = document.getElementById('tbt-link-revoke').style.display === 'none'; closeModal('m-tbt-link');
    // who signed: no "did not sign" for induction, still there for weekly
    tbtWho(id); const wb = document.getElementById('tbt-who-body').textContent; o.whoInd = { miss: wb.includes('לא חתמו'), signer: wb.includes('דני') };
    o.doc = { mailed: wb.includes('נשלח למייל'), link: !!document.querySelector('#tbt-who-body a[href="https://od.example/f.pdf"]'), err: wb.includes('הטופס לא נשלח: outlook 429'), pending: wb.includes('הטופס בשליחה') }; closeModal('m-tbt-who');
    tbtWho(wid); o.whoWk = document.getElementById('tbt-who-body').textContent.includes('לא חתמו');
    return o;
  });
  check('the form has the induction checkbox, off by default', r.box && r.box0 === false);
  check('checked: saved as kind=induction', r.kind === 'induction', r.kind);
  check('the next new form starts unchecked, and saves a weekly talk', r.newAfter === false && r.weekKind === null, r);
  check('edit brings the mark back (and not on a weekly talk)', r.edit === true && r.editWk === false);
  check('duplicate keeps it', r.dup === true);
  check('the list marks the induction talk', r.tag);
  check('its count is signatures only, not "of all workers"; weekly keeps "x / all"', r.count === '3' && /\//.test(r.wcount), [r.count, r.wcount]);
  check('the link dialog says permanent and offers cancel', r.link === 'shown' && /קבוע/.test(r.days) && r.url.endsWith('perm0') && r.rvShown, r.days);
  check('cancel asks first; no answer = nothing sent', r.kept === 'kept' && r.keptCalls === 0);
  check('cancel: the new link replaces the old in the dialog, and link_v is kept', r.rev === 'shown' && r.revUrl.endsWith('k=new') && r.linkV === 1 && /בוטל/.test(r.revToast || ''), r);
  check('a weekly talk\'s link dialog has no cancel button', r.rvWk);
  check('who signed: no "did not sign" list on induction, the signer is there; weekly keeps it', !r.whoInd.miss && r.whoInd.signer && r.whoWk, r);
  check('who signed on induction: mailed and filed (with the link), the failure reason, or still sending', r.doc.mailed && r.doc.link && r.doc.err && r.doc.pending, r.doc);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
