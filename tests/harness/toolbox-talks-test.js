// Weekly talk read and signed by each worker, stage 1 (03/10/2026): the
// manager side. Drives the real rTbt / svTbt / tbtPublish / _genEdit against
// seeded rows: the card on the toolbox page, the signature count, no delete
// button on a talk with signatures (evidence), a talk with nothing to read is
// refused, publish / back to draft, new vs edit, and the table in every list
// that sync, backup and the local cache read.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const COLS = require('./db-columns.json');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  // static: every list a table must be in to sync, back up and survive a reload
  const lists = {
    ldb: /function ldb\(\)\{[\s\S]*?\]\.forEach/,
    syncTbls: /var syncTbls=\[[^\]]*\]/,
    tsCol: /var _sbTsCol=\{[^}]*\}/,
  };
  for (const [k, re] of Object.entries(lists)) {
    const m = (SRC.match(re) || [''])[0];
    check(k + ' has toolbox_talks and toolbox_reads', m.includes('toolbox_talks') && m.includes('toolbox_reads'), m.slice(0, 60));
  }
  check('the two sbSync lists have both tables', (SRC.match(/var tbls=\[[^\]]*'toolbox_talks','toolbox_reads'[^\]]*\]/g) || []).length === 2);
  // Not in the nightly backup yet: the worker has 50 subrequests (Free plan) and 45
  // tables + 3 already; two more pushed mgmt_reviews out (backup-cron-budget-test).
  // Empty until stage 2; solving the backup is a stage 2 prerequisite (STATUS).
  check('not in the backup list until the worker budget is solved', !/'toolbox_talks'/.test((SRC.match(/var _BACKUP_TABLES=\[[^\]]*\]/) || [''])[0]));
  check('db-columns.json has both tables', !!COLS.toolbox_talks && !!COLS.toolbox_reads);

  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const out = await page.evaluate(() => {
    window.sdb = function () {}; window.addLog = function () {};
    const ins = [], upd = [], toasts = [];
    window.sbIns = function (t, r) { ins.push([t, JSON.parse(JSON.stringify(r))]); };
    window.sbUpd = function (t, r) { upd.push([t, JSON.parse(JSON.stringify(r))]); };
    window.toast = function (m) { toasts.push(String(m)); };
    DB.toolbox_talks = [
      { id: 'tt-1', d: '2026-09-27', title: 'עבודה בגובה', body: 'רתמה, עיגון', s: 'פורסמה' },
      { id: 'tt-2', d: '2026-10-04', title: 'חומרים מסוכנים', body: 'גיליון בטיחות', s: 'טיוטה' },
    ];
    DB.toolbox_reads = [
      { id: 'r1', talk_id: 'tt-1', emp_name: 'עובד א' },
      { id: 'r2', talk_id: 'tt-1', emp_name: 'עובד ב' },
    ];
    _currentUser = { username: 'admin' };
    const res = {};
    goPage('toolbox');
    const rows = () => Array.from(document.querySelectorAll('#tb-tbt tr'));
    res.card = !!document.getElementById('tbt-card') && document.getElementById('pg-toolbox').contains(document.getElementById('tbt-card'));
    res.order = rows().map((tr) => tr.children[1].textContent);
    const r1 = rows().find((tr) => tr.textContent.includes('עבודה בגובה'));
    const r2 = rows().find((tr) => tr.textContent.includes('חומרים מסוכנים'));
    res.r1count = r1.children[3].textContent; res.r2count = r2.children[3].textContent;
    res.r1del = !!r1.querySelector('[data-dtbl]'); res.r2del = !!r2.querySelector('[data-dtbl]');
    res.r1date = r1.children[0].textContent;

    // new: title required, then something to read required
    openModal('m-tbt');
    svTbt(); res.noTitle = toasts.slice(-1)[0];
    document.getElementById('tbt-title').value = 'מלגזות';
    svTbt(); res.noBody = toasts.slice(-1)[0]; res.insEmpty = ins.length;
    document.getElementById('tbt-body').value = 'מהירות, הולכי רגל';
    res.dateDefault = gv('tbt-d');
    document.getElementById('tbt-d').value = '';
    svTbt(); res.newRow = ins.slice(-1)[0];
    res.cleared = document.getElementById('tbt-title').value === '' && document.getElementById('tbt-body').value === '';

    // edit through the generic editor keeps the id, no new row
    const before = ins.length;
    _genEdit('toolbox_talks', 'tt-2');
    res.editPrefill = { t: gv('tbt-title'), s: gv('tbt-s'), d: gv('tbt-d') };
    document.getElementById('tbt-title').value = 'חומרים מסוכנים - עדכון';
    svTbt();
    res.editIns = ins.length - before; res.editUpd = upd.slice(-1)[0];

    // publish toggle
    tbtPublish('tt-2'); res.pub = DB.toolbox_talks.find((x) => x.id === 'tt-2').s; res.pubUpd = upd.slice(-1)[0][0];
    tbtPublish('tt-2'); res.back = DB.toolbox_talks.find((x) => x.id === 'tt-2').s;
    DB.toolbox_talks.push({ id: 'tt-9', title: 'ריק', s: 'טיוטה' });
    tbtPublish('tt-9'); res.emptyPub = DB.toolbox_talks.find((x) => x.id === 'tt-9').s;

    // stage 2: the link button only on a published talk; it calls /api/talk with the session
    goPage('toolbox');
    const rowOf = (t) => Array.from(document.querySelectorAll('#tb-tbt tr')).find((tr) => tr.textContent.includes(t));
    res.linkPub = !!rowOf('עבודה בגובה').querySelector('[onclick^="tbtLink"]');
    res.linkDraft = !!rowOf('מלגזות').querySelector('[onclick^="tbtLink"]');
    const calls = [];
    // link_at (03/10/2026): the server's time of the new link; it runs out 14 days later, Israel's day.
    const lkAt = new Date().toISOString(), lkEnd = new Date(Date.now() + 14 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).split('-').reverse().join('/');
    window._sbToken = 'tok123';
    window.fetch = function (u, init) { calls.push([u, init]); return Promise.resolve(new Response(JSON.stringify({ url: 'https://tapugan-safety.pages.dev/api/talk?k=tt-1.x.y', days: 14, link_at: lkAt }), { status: 200 })); };
    let shared = null;
    Object.defineProperty(navigator, 'share', { value: function (d) { shared = d; return Promise.resolve(); }, configurable: true });
    // The CDN is blocked here: a stand-in for qrcode-generator records what it was asked to encode.
    const qrData = [];
    window.qrcode = function () { let d = ''; return { addData: function (t) { d = t; qrData.push(t); }, make: function () {}, getModuleCount: function () { return 21; }, isDark: function (r, c) { return (r + c) % 2 === 0; } }; };
    res.linkP = tbtLink('tt-1').then(function (r) {
      const m = document.getElementById('m-tbt-link');
      const out = { r: r, calls: calls.map((c) => [c[0], c[1].headers.Authorization, JSON.parse(c[1].body)]), sharedBefore: shared,
        open: !!m && m.style.display !== 'none', title: document.getElementById('tbt-link-title').textContent,
        url: document.getElementById('tbt-link-url').value, lkEnd: lkEnd, days: document.getElementById('tbt-link-days').textContent,
        rowTag: rowOf('עבודה בגובה').textContent, kept: DB.toolbox_talks[0].link_at === lkAt, qr: !!document.querySelector('#tbt-link-qr svg path'), qrData: qrData.slice(), cdn: document.querySelectorAll('script[src*="qrcode"]').length };
      DB.toolbox_talks[0].link_at = '2020-01-01T08:00:00Z'; rTbt(); out.goneTag = rowOf('עבודה בגובה').textContent;
      DB.toolbox_talks[0].s = 'טיוטה'; rTbt(); out.draftTag = rowOf('עבודה בגובה').textContent; DB.toolbox_talks[0].s = 'פורסמה'; rTbt();
      return _tbtLinkShare().then(function (s) { out.shareR = s; out.shared = shared; return out; });
    });
    res.draftLink = null; tbtLink('tt-2').then(function (r) { res.draftLink = r; });
    // the view page
    showView('toolbox_talks', 'tt-1'); res.view = CUR === 'view' && document.getElementById('pg-view').textContent.includes('רתמה, עיגון');
    return res.linkP.then(function (l) { res.link = l; delete res.linkP; return res; });
  });

  check('the card sits on the toolbox page', out.card);
  check('newest talk first', out.order[0] === 'חומרים מסוכנים', out.order);
  check('signature count per talk (2 and 0)', out.r1count === '2' && out.r2count === '0', [out.r1count, out.r2count]);
  check('a talk with signatures has no delete button, one without has', !out.r1del && out.r2del);
  check('date shown DD/MM/YYYY', out.r1date === '27/09/2026', out.r1date);
  check('no title: refused', /נושא/.test(out.noTitle || ''), out.noTitle);
  check('no body and no file: refused, nothing written', /תוכן/.test(out.noBody || '') && out.insEmpty === 0, [out.noBody, out.insEmpty]);
  const nr = out.newRow && out.newRow[1];
  check('new talk written to toolbox_talks as a draft by the user', out.newRow && out.newRow[0] === 'toolbox_talks' && nr.s === 'טיוטה' && nr.created_by === 'admin', out.newRow);
  check('date starts as today', /^\d{4}-\d{2}-\d{2}$/.test(out.dateDefault || ''), out.dateDefault);
  check('empty date is null, not ""', nr && nr.d === null, nr && nr.d);
  check('every field written has a column in the DB', nr && Object.keys(nr).every((k) => COLS.toolbox_talks.includes(k)), nr && Object.keys(nr));
  check('form cleared after save', out.cleared);
  check('edit opens with the record', out.editPrefill.t === 'חומרים מסוכנים' && out.editPrefill.s === 'טיוטה' && out.editPrefill.d === '2026-10-04', out.editPrefill);
  check('edit updates the same id, no new row', out.editIns === 0 && out.editUpd && out.editUpd[0] === 'toolbox_talks' && out.editUpd[1].id === 'tt-2' && out.editUpd[1].title === 'חומרים מסוכנים - עדכון', out.editUpd);
  check('publish, and back to draft', out.pub === 'פורסמה' && out.pubUpd === 'toolbox_talks' && out.back === 'טיוטה', [out.pub, out.back]);
  check('a talk with nothing to read is not published', out.emptyPub === 'טיוטה', out.emptyPub);
  check('the view page shows the text', out.view);
  check('link button only on a published talk', out.linkPub && !out.linkDraft, [out.linkPub, out.linkDraft]);
  check('link: POST /api/talk op=link with the session token', out.link && out.link.calls.length === 1 && out.link.calls[0][0] === '/api/talk' && out.link.calls[0][1] === 'Bearer tok123' && out.link.calls[0][2].op === 'link' && out.link.calls[0][2].id === 'tt-1', out.link);
  const L = out.link || {};
  check('link: the dialog opens with the title and the link, nothing shared yet', L.r === 'shown' && L.open && L.title === 'עבודה בגובה' && /api\/talk\?k=tt-1/.test(L.url) && L.sharedBefore === null, L);
  check('link: a QR of exactly that link is drawn in the dialog', L.qr && L.qrData.length === 1 && L.qrData[0] === L.url, L);
  check('link: a loaded QR library is not fetched again (the global is qrcode, not QRCode)', L.cdn === 0, L.cdn);
  check('the share button sends the title and the link', L.shareR === 'shared' && /עבודה בגובה/.test(L.shared.text) && /api\/talk\?k=tt-1/.test(L.shared.text), L);
  check('link_at: kept on the talk, the row says until when, the dialog too', L.kept && L.rowTag.includes('קישור עד ' + L.lkEnd) && L.days.startsWith('בתוקף עד ' + L.lkEnd + '.'), [L.kept, L.rowTag, L.days, L.lkEnd]);
  check('link_at: an expired link says so in the row; a draft shows no link date', /הקישור פג ב-15\/01\/2020/.test(L.goneTag || '') && !/קישור עד|הקישור פג/.test(L.draftTag || ''), [L.goneTag, L.draftTag]);
  check('a draft gets no link and no request', out.draftLink === 'draft', out.draftLink);
  // The employee card (BACKLOG 11.5, Michael 03/10/2026): weekly talks signed and not, since the start date.
  const card = await page.evaluate(() => {
    DB.emp = [{ id: 'e1', n: 'דנה', eid: '012345678', s: '2026-09-01' }, { id: 'e2', n: 'יוסי', s: '2026-10-01' }, { id: 'e3', n: 'חדש' }];
    DB.toolbox_talks = [
      { id: 'a', d: '2026-08-20', title: 'לפני ההצטרפות', s: 'פורסמה' },
      { id: 'b', d: '2026-09-27', title: 'עבודה בגובה', s: 'פורסמה' },
      { id: 'c', d: '2026-10-04', title: 'מלגזות', s: 'פורסמה' },
      { id: 'd', d: '2026-10-11', title: 'טיוטה <b>', s: 'טיוטה' },
    ];
    DB.toolbox_reads = [
      { talk_id: 'b', emp_id: 'e1', read_at: '2026-09-28T06:05:00Z' },
      { talk_id: 'c', emp_id: 'x:01234-5678:Dana', id_no: '01234-5678', read_at: '2026-10-05T07:00:00Z' },
      { talk_id: 'b', emp_id: 'e2', read_at: '2026-09-29T06:00:00Z' },
    ];
    const sec = (id) => { showView('emp', id); const el = document.getElementById('emp-talks'); return el ? { text: el.textContent, rows: el.querySelectorAll('.b').length, html: el.innerHTML } : null; };
    return { e1: sec('e1'), e2: sec('e2'), e3: sec('e3'), none: (DB.toolbox_talks = [], sec('e3')) };
  });
  check('card: signed 2 of the 2 since the start date (one by ID from outside the list)', card.e1 && /חתם על 2 מתוך 2/.test(card.e1.text) && card.e1.rows === 2 && !/לפני ההצטרפות/.test(card.e1.text), card.e1);
  check('card: the time of each signature, Israel time, DD/MM/YYYY', card.e1 && card.e1.text.includes('28/09/2026 09:05') && card.e1.text.includes('05/10/2026 10:00'), card.e1 && card.e1.text);
  check('card: a talk signed before the start date still shows; the missing one is red', card.e2 && /חתם על 1 מתוך 2/.test(card.e2.text) && /לא חתם/.test(card.e2.text) && /עבודה בגובה/.test(card.e2.text), card.e2);
  check('card: no start date = every published talk, drafts never', card.e3 && /חתם על 0 מתוך 3/.test(card.e3.text) && !/טיוטה/.test(card.e3.text), card.e3);
  check('card: no talks at all says so', card.none && /עוד לא פורסמה הדרכה שבועית/.test(card.none.text), card.none);
  // review 03/10/2026: the server's English codes reach Michael in Hebrew
  const errs2 = await page.evaluate(async () => {
    DB.toolbox_talks = [{ id: 'tt-1', d: '2026-09-27', title: 'עבודה בגובה', body: 'x', s: 'פורסמה' }];
    const out = {};
    for (const [st, er] of [[401, 'no session'], [404, 'not found'], [503, 'not configured'], [500, 'boom']]) {
      const ts = []; window.toast = (m) => ts.push(m);
      window.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: er }), { status: st }));
      await tbtLink('tt-1'); out[st] = ts[ts.length - 1];
    }
    window.fetch = () => Promise.resolve(new Response('<html>bad gateway', { status: 502 }));
    { const ts = []; window.toast = (m) => ts.push(m); out.html = await tbtLink('tt-1'); out.htmlT = ts[ts.length - 1]; }
    return out;
  });
  check('link errors in Hebrew: 401, 404 (not synced yet), 503 (the secret)', /להתחבר מחדש/.test(errs2[401]) && /לחכות לסנכרון/.test(errs2[404]) && /TRUSTEE_NOTIFY_SECRET/.test(errs2[503]) && !/no session|not found|not configured/.test(errs2[401] + errs2[404] + errs2[503]), errs2);
  check('an unknown error keeps the code; a page that is not JSON says failed with its status', /boom \(500\)/.test(errs2[500]) && errs2.html === 'failed' && /\(502\)/.test(errs2.htmlT), errs2);
  // review 03/10/2026: on a phone the printout fits, and the back button does not cover the title
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.evaluate(() => {
    DB.emp = [{ id: 'e1', n: 'דנה כהן', dep: 'ייצור' }];
    DB.toolbox_reads = [{ id: 'r1', talk_id: 'tt-1', emp_id: 'e1', emp_name: 'דנה כהן', id_no: '012345678', dept: 'ייצור', lang: 'he', device: 'phone', read_at: '2026-10-03T06:00:00Z' },
      { id: 'r2', talk_id: 'tt-1', emp_id: 'x:99887766:ivan', emp_name: 'איוון סמירנוב', id_no: '99887766', dept: 'קבלן ACME', lang: 'ru', device: 'tablet', read_at: '2026-10-03T06:05:00Z' }];
    window.print = function () {}; tbtWho('tt-1'); tbtWhoPrint();
  })]);
  await pop.setViewportSize({ width: 375, height: 812 }); await pop.waitForTimeout(300);
  const pr = await pop.evaluate(() => { const h = document.querySelector('h2').getBoundingClientRect(), b = document.getElementById('rpt-back'); const r = b ? b.getBoundingClientRect() : null; return { sw: document.documentElement.scrollWidth, over: !!r && r.bottom > h.top && r.top < h.bottom }; });
  await pop.close();
  check('print on a phone: no sideways scroll, the back button clear of the title', pr.sw <= 375 && !pr.over, pr);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
