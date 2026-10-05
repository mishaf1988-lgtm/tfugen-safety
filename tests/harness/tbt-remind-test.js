// Reminder from "who signed" (05/10/2026): the button shows only on a published talk with
// someone missing, asks the server for a fresh link, writes a message with the talk, the
// missing names by department and the link, and shares it from a second tap (Safari) or
// copies it. Left employees and a manager in view-only mode get nothing.
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
    window.sdb = function () {}; window.addLog = function () {}; window._signifyDom = undefined;
    const toasts = []; window.toast = (m) => toasts.push(String(m));
    _currentUser = { username: 'admin' }; window._sbToken = 'tok';
    DB.emp = [
      { id: 'e1', n: 'אחמד', dep: 'אריזה' }, { id: 'e2', n: 'דנה', dep: 'אריזה' },
      { id: 'e3', n: 'יוסי', dep: 'אחזקה' }, { id: 'e4', n: 'רות', dep: 'אריזה' },
      { id: 'e5', n: 'עזב', dep: 'אחזקה', left_d: '2026-01-01' },
    ];
    DB.toolbox_talks = [
      { id: 'p', d: '2026-10-04', title: 'עבודה בגובה', body: 'x', s: 'פורסמה', trainer: 'מיכאל', trainer_qual: 'ממונה בטיחות' },
      { id: 'd', d: '2026-10-05', title: 'טיוטה', body: 'x', s: 'טיוטה' },
      { id: 'all', d: '2026-10-03', title: 'כולם חתמו', body: 'x', s: 'פורסמה' },
    ];
    DB.toolbox_reads = [{ id: 'r1', talk_id: 'p', emp_id: 'e2', emp_name: 'דנה', read_at: '2026-10-04T07:00:00Z' }]
      .concat(['e1', 'e2', 'e3', 'e4'].map((e, i) => ({ id: 'a' + i, talk_id: 'all', emp_id: e, read_at: '2026-10-03T07:00:00Z' })));
    goPage('toolbox');
    const o = {};
    const btn = () => document.getElementById('tbt-rem-btn');
    tbtWho('d'); o.draftBtn = !!btn();
    tbtWho('all'); o.allBtn = !!btn();
    tbtWho('p'); o.btn = btn() && btn().textContent; o.boxHidden = document.getElementById('tbt-rem-box').style.display === 'none';
    o.noPrint = !!btn().closest('.no-print');
    const calls = [];
    window.fetch = (u, init) => { calls.push([u, JSON.parse(init.body), init.headers.Authorization]); return Promise.resolve(new Response(JSON.stringify({ url: 'https://tapugan-safety.pages.dev/api/talk?k=abc', days: 14, link_at: '2026-10-05T10:00:00Z' }), { status: 200 })); };
    let shared = null; navigator.share = (d) => { shared = d; return Promise.resolve(); };
    o.ok = await tbtRemind('p'); o.call = calls[0];
    o.txt = document.getElementById('tbt-rem-txt').value;
    o.boxShown = document.getElementById('tbt-rem-box').style.display !== 'none';
    o.linkAt = DB.toolbox_talks[0].link_at;
    o.sharedBefore = shared;
    document.querySelector('#tbt-rem-box .btn-p').click(); await new Promise((res) => setTimeout(res, 50));
    o.shared = shared && shared.text;
    // no share sheet: copied to the clipboard
    navigator.share = undefined; let copied = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { copied = t; return Promise.resolve(); } } });
    o.copy = await _tbtLinkShare(document.getElementById('tbt-rem-txt').value, 'tbt-rem-txt'); o.copied = copied;
    // the link dialog still shares its own text
    _tbtLinkTxt = 'LINK'; await _tbtLinkCopy(); o.linkCopy = copied;
    // a server error says why, in Hebrew
    window.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    o.bad = await tbtRemind('p'); o.badToast = toasts.slice(-1)[0];
    // view only: no button
    window._viewOnly = () => true; tbtWho('p'); o.viewBtn = !!btn();
    return o;
  });
  check('no reminder on a draft or when everyone signed', !r.draftBtn && !r.allBtn, [r.draftBtn, r.allBtn]);
  check('the button counts who did not sign (3, not the one who left or signed)', /תזכורת ל-3 שלא חתמו/.test(r.btn || ''), r.btn);
  check('the button and its box are not printed, the box starts hidden', r.noPrint && r.boxHidden, [r.noPrint, r.boxHidden]);
  check('it asks the server for a fresh link, with the session', r.call && r.call[0] === '/api/talk' && r.call[1].op === 'link' && r.call[1].id === 'p' && r.call[2] === 'Bearer tok', r.call);
  check('the message: talk, date, names by department, link and its end', r.ok === 'ready' && /תזכורת: הדרכה שבועית "עבודה בגובה" \(04\/10\/2026\)/.test(r.txt) && /אחזקה: יוסי\nאריזה: אחמד, רות/.test(r.txt) && /בתוקף עד 19\/10\/2026\):\nhttps:\/\/tapugan-safety\.pages\.dev\/api\/talk\?k=abc$/.test(r.txt), r.txt);
  check('signed and left employees are not in the message', !/דנה|עזב/.test(r.txt), r.txt);
  check('the new link date is kept on the talk', r.linkAt === '2026-10-05T10:00:00Z', r.linkAt);
  check('the share waits for a tap, then shares the message', r.boxShown && r.sharedBefore === null && r.shared === r.txt, [r.sharedBefore, r.shared]);
  check('without a share sheet the message is copied', r.copy === 'copied' && r.copied === r.txt, [r.copy, r.copied]);
  check('the link dialog still copies its own link', r.linkCopy === 'LINK', r.linkCopy);
  check('a server error says why', r.bad === 'failed' && /התזכורת לא הוכנה: רק מנהל/.test(r.badToast), r.badToast);
  check('no button in view-only mode', !r.viewBtn);
  check('no page errors', errors.length === 0, errors);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
