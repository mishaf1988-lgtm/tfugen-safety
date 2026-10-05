// Group mode in the app (05/10/2026): the "in a group" button on a published talk opens
// the one-day group link in a tab opened before the fetch (Safari), a failure closes it
// and says why, and "who signed" (and its print) shows how each worker was briefed and
// whether the trainer signed the closing declaration.
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
    const toasts = []; window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    DB.toolbox_talks = [
      { id: 'p', d: '2026-10-04', title: 'פורסמה', body: 'x', s: 'פורסמה', trainer: 'מיכאל', trainer_qual: 'ממונה בטיחות', trainer_sig_url: 'https://x/storage/v1/object/public/incidents-photos/sig-p-trainer.png', trainer_signed_at: '2026-10-04T07:30:00Z' },
      { id: 'd', d: '2026-10-05', title: 'טיוטה', body: 'x', s: 'טיוטה', trainer: 'מיכאל', trainer_qual: 'ממונה בטיחות' },
      { id: 'n', d: '2026-10-03', title: 'בלי חתימת מדריך', body: 'x', s: 'פורסמה', trainer: 'דני', trainer_qual: 'מנהל עבודה' },
    ];
    DB.toolbox_reads = [
      { id: 'r1', talk_id: 'p', emp_id: 'e1', emp_name: 'אחמד', id_no: '1', read_at: '2026-10-04T07:00:00Z', device: 'phone', mode: 'group' },
      { id: 'r2', talk_id: 'p', emp_id: 'e2', emp_name: 'דנה', id_no: '2', read_at: '2026-10-04T08:00:00Z', device: 'phone', mode: 'link' },
      { id: 'r3', talk_id: 'p', emp_id: 'e3', emp_name: 'ישן', id_no: '3', read_at: '2026-10-01T08:00:00Z', device: 'phone' },
    ];
    goPage('toolbox');
    const rowOf = (t) => Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes(t));
    const o = { btnPub: !!rowOf('פורסמה').querySelector('[onclick^="tbtGroup"]'), btnDraft: !!rowOf('טיוטה').querySelector('[onclick^="tbtGroup"]') };
    // success: the tab opened first is sent to the group link
    const tab = { closed: false, location: { href: '' }, close() { this.closed = true; } };
    let opened = 0; window.open = () => { opened++; return tab; };
    const calls = [];
    window.fetch = (u, init) => { calls.push([u, JSON.parse(init.body), init.headers.Authorization]); return Promise.resolve(new Response(JSON.stringify({ url: 'https://tapugan-safety.pages.dev/api/talk?k=g.x.y&g=1', days: 1 }), { status: 200 })); };
    o.ok = await tbtGroup('p'); o.call = calls[0]; o.tab = tab.location.href; o.opened = opened;
    // failure: the tab is closed and the reason shown
    const tab2 = { closed: false, location: { href: '' }, close() { this.closed = true; } };
    window.open = () => tab2;
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    o.bad = await tbtGroup('p'); o.tab2closed = tab2.closed; o.badToast = toasts.slice(-1)[0];
    o.draft = await tbtGroup('d');
    // who signed (signed URLs need the network: keep data-sign to see which file it points at)
    window._signifyDom = undefined;
    tbtWho('p'); o.who = document.getElementById('tbt-who-body').innerHTML; o.whoText = document.getElementById('tbt-who-body').textContent;
    tbtWho('n'); o.whoN = document.getElementById('tbt-who-body').textContent;
    return o;
  });
  check('the "in a group" button only on a published talk', r.btnPub && !r.btnDraft, [r.btnPub, r.btnDraft]);
  check('it asks the server for a group link, with the session', r.call && r.call[0] === '/api/talk' && r.call[1].op === 'group' && r.call[1].id === 'p' && r.call[2] === 'Bearer tok', r.call);
  check('the tab opened before the fetch goes to the group link', r.ok === 'opened' && r.opened === 1 && /g=1/.test(r.tab), [r.ok, r.tab]);
  check('a failure closes the tab and says why', r.bad === 'failed' && r.tab2closed && /לא נפתחה/.test(r.badToast), [r.bad, r.badToast]);
  check('a draft is not opened', r.draft === 'draft');
  check('"who signed": face to face and online told apart', /פנים אל פנים/.test(r.whoText) && /מקוון/.test(r.whoText), r.whoText.slice(0, 300));
  check('"who signed": an old signature without a mode shows no mode', (r.whoText.match(/פנים אל פנים|מקוון/g) || []).length === 2, r.whoText.match(/פנים אל פנים|מקוון/g));
  check('"who signed": the trainer\'s signed declaration, with its time and signature', /הצהרת המדריך נחתמה ב-04\/10\/2026/.test(r.whoText) && /נחתמה ב-[^<]*<img data-sign="[^"]*sig-p-trainer\.png"/.test(r.who), r.who.slice(0, 900));
  check('"who signed": a talk the trainer did not close says so', /המדריך עוד לא חתם על סיום ההדרכה/.test(r.whoN), r.whoN.slice(0, 200));
  check('no page errors', errors.length === 0, errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
