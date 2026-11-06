// The weekly works link on the permits page (05/11/2026, works.js): works from the link come first, with their
// pending status and red flags; the text was typed outside the app, so it is escaped; "reject with a reason"
// writes s and the reason line; the button copies this week's link from /api/works.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'michael' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.__upd = []; window.sbUpd = function (t, row) { window.__upd.push([t, row]); };
    // 06/11/2026: approve / return go through the server (works.js op decide); the mock answers like it
    window.__api = []; window.__ptwApiReal = window._ptwApi; window._ptwApi = function (b) { window.__api.push(b); const row = DB.ptw.find((x) => x.id === b.id);
      const s = b.act === 'reject' ? 'נדחה' : 'פתוח', safety = b.act === 'reject' ? '[נדחה] ' + b.why + '\n' + row.safety : row.safety;
      return Promise.resolve({ ok: true, j: { ok: true, s, safety, mailed: { to: ['maint@tapugan.co.il'] }, permit: b.act === 'approve' ? 'later' : '' } }); };
    const tick = () => new Promise((res) => setTimeout(res, 20));
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__copied = null; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) {}
    DB.ptw = [
      { id: 'p1', num: 'PTW-0001', con: 'קבלן ישן', types: 'עבודה בגובה', ds: '2026-10-01', s: 'סגור' },
      { id: 'wk-2026-11-06-1', num: 'WK-0611-1', con: '<img src=x onerror=window.__xss=1>', types: 'חלל מוקף', ds: '2026-11-06', ts: '07:00', te: '13:00', s: 'ממתין לאישור',
        safety: 'חלל מוקף: מונה אחראי\n[לבדיקה] הקבלן נגב אקולוגיה: ההסכם פג ב-01/10/2026', desc: 'ניקוי מיכל' },
    ];
    goPage('ptw'); rPtw();
    const out = {};
    const rows = document.querySelectorAll('#tb-ptw tr');
    out.first = rows[0] && rows[0].textContent;
    out.xss = !!window.__xss || !!document.querySelector('#tb-ptw img');
    out.flag = rows[0] && /ההסכם פג ב-01\/10\/2026/.test(rows[0].textContent);
    out.badge = rows[0] && rows[0].querySelector('.b.bY') && rows[0].querySelector('.b.bY').textContent;
    out.summary = document.getElementById('ptw-summary').textContent;
    out.rejBtnOld = !!(rows[1] && rows[1].querySelector('[data-rid]'));
    window.prompt = () => 'חסר מספר נייד של האחראי';
    rows[0].querySelector('[data-rid]').click(); await tick();
    const w = DB.ptw.find((x) => x.id === 'wk-2026-11-06-1');
    out.rej = { s: w.s, safety: w.safety, api: window.__api.slice(-1)[0], upd: window.__upd.length };
    out.rejShown = /נדחה: חסר מספר נייד/.test(document.getElementById('tb-ptw').textContent);
    out.noRejBtnAfter = !document.querySelector('#tb-ptw [data-rid]');
    // approve: blocked while works.js wrote what is missing; allowed without it
    DB.ptw.push({ id: 'wk-2026-11-06-2', num: 'WK-0611-2', con: 'x', types: 'חלל מוקף', ds: '2026-11-06', s: 'ממתין לאישור', safety: 'חלל מוקף: מונה אחראי\n[חסר לאישור] חלל מוקף: חסרה בדיקת גזים מלאה (חמצן O2 (%))', desc: 'ניקוי בור' });
    DB.ptw.push({ id: 'wk-2026-11-06-3', num: 'WK-0611-3', con: 'y', types: 'עבודה בגובה', ds: '2026-11-06', s: 'ממתין לאישור', safety: 'עבודה בגובה: קסדה\n[הערה] לא צורפו אישורים (תעודות, תסקירים)', desc: 'החלפת נורה בגובה' });
    rPtw();
    out.gateShown = /חסרה בדיקת גזים/.test(document.getElementById('tb-ptw').textContent) && /לא צורפו אישורים/.test(document.getElementById('tb-ptw').textContent);
    window.confirm = () => true; window.__upd = []; window.__api = [];
    document.querySelector('#tb-ptw [data-aid="wk-2026-11-06-2"]').click();
    out.gateBlocked = DB.ptw.find((x) => x.id === 'wk-2026-11-06-2').s === 'ממתין לאישור' && !window.__api.length && /אי אפשר לאשר עדיין/.test(window.__toasts.slice(-1)[0]);
    document.querySelector('#tb-ptw [data-aid="wk-2026-11-06-3"]').click(); await tick();
    out.approved = DB.ptw.find((x) => x.id === 'wk-2026-11-06-3').s === 'פתוח' && window.__api.length === 1 && window.__api[0].op === 'decide' && window.__api[0].act === 'approve' && !window.__upd.length && /maint@tapugan/.test(window.__toasts.slice(-1)[0]);
    // the signed permit works.js filed (stage B, 05/11/2026): its file name on the list, the closed one first
    DB.ptw.push({ id: 'wk-2026-11-06-4', num: 'WK-0611-4', con: 'z', types: 'עבודות חמות', ds: '2026-11-06', s: 'סגור', safety: 'עבודות חמות: מטף\n[הרשאה] 18_x/02_y/2026-11/2026-11-06 - הרשאה WK-0611-4 - a.pdf\n[הרשאה סגורה] 18_x/02_y/2026-11/2026-11-06 - הרשאה WK-0611-4 - a - סגורה.pdf', desc: 'ריתוך' });
    rPtw();
    out.permitShown = /2026-11-06 - הרשאה WK-0611-4 - a - סגורה\.pdf/.test(document.getElementById('tb-ptw').textContent) && !/18_x/.test(document.getElementById('tb-ptw').textContent);
    rPtwView('wk-2026-11-06-1');
    out.filesBtn = !!document.querySelector('#ptw-view-card [data-fid="wk-2026-11-06-1"]');
    out.viewXss = !!document.querySelector('#ptw-view-card img');
    window.__linkReq = null;
    window._ptwApi = window.__ptwApiReal;
    window.fetch = (u, init) => { window.__linkReq = { u: String(u), body: init.body, auth: init.headers.Authorization || '' }; return Promise.resolve(new Response(JSON.stringify({ url: 'https://x.example/api/works?k=abc', friday: '2026-11-06', days: 8 }), { status: 200 })); };
    document.getElementById('ptw-wk-link').click();
    await new Promise((res) => setTimeout(res, 300));
    out.copied = window.__copied; out.linkReq = window.__linkReq;
    return out;
  });
  check('a work from the link is listed first, before older permits', /WK-0611-1/.test(r.first), r.first);
  check('typed text is escaped on the list (no tag runs)', r.xss === false);
  check('its red flag shows under the contractor', r.flag);
  check('pending badge in yellow', r.badge === 'ממתין לאישור', r.badge);
  check('the summary counts works waiting for approval', /ממתין לאישור: 1/.test(r.summary), r.summary);
  check('no reject button on an ordinary permit', r.rejBtnOld === false);
  check('reject: through the server (op decide, the reason sent), status and the reason line first from its answer, no direct update', r.rej.s === 'נדחה' && /^\[נדחה\] חסר מספר נייד של האחראי\nחלל מוקף: מונה אחראי/.test(r.rej.safety) && r.rej.api.op === 'decide' && r.rej.api.act === 'reject' && r.rej.api.why === 'חסר מספר נייד של האחראי' && r.rej.upd === 0, r.rej);
  check('the reason shows on the list, the button is gone', r.rejShown && r.noRejBtnAfter);
  check('the permit view escapes too', r.viewXss === false);
  check('what is missing for approval (red) and the notes (yellow) show on the list', r.gateShown);
  check('approve is refused while the gas test is missing (no update, a toast that says why)', r.gateBlocked);
  check('approve without anything missing: through the server (op decide), status "open", the toast names where the mail went', r.approved);
  check('the permit view of a work from the link has the attachments button', r.filesBtn);
  check('the signed permit: its file name on the list (the closed version when there is one), not the folders', r.permitShown);
  check('"link to maintenance" asks /api/works for op link with the session, and copies the link with the Friday', r.linkReq && r.linkReq.u === '/api/works' && JSON.parse(r.linkReq.body).op === 'link' && /^Bearer /.test(r.linkReq.auth) && /06\/11\/2026/.test(r.copied || '') && /api\/works\?k=abc/.test(r.copied || ''), [r.linkReq, r.copied]);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
