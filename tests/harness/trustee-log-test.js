// The trustee reports log (Excel, pushed to OneDrive): is every report in it,
// does a finding say open/closed with who closed it and when, and does the
// OneDrive push fire only on change and retry after a failure?
// Driven against a fake OneDrive and a fake XLSX, so nothing leaves the page.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ locale: 'he-IL' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const out = await page.evaluate(async () => {
    const pushes = [];
    let connected = true, failNext = false;
    window._odToken = () => (connected ? { account: { username: 'x' } } : null);
    window._odPushFile = (blob, folder, name) => {
      if (failNext) { failNext = false; return Promise.reject(new Error('OD 423: locked')); }
      pushes.push({ folder, name, type: blob.type }); return Promise.resolve({});
    };
    window._ensureXlsxLib = () => Promise.resolve();
    window.XLSX = { utils: { book_new: () => ({}), aoa_to_sheet: (a) => a, book_append_sheet: () => {} },
      write: () => new Uint8Array([1, 2, 3]) };
    try { localStorage.removeItem('tfgn_tru_od_sig'); } catch (e) {}
    window.sbIns = () => {}; window.sbUpd = () => {}; window.sdb = () => {};

    DB.trustee_tasks = [{ id: 'k5', n: 5, t: 'עמדות כיבוי אש', active: true }, { id: 'k8', n: 8, t: 'מעקב סגירה', active: true }];
    DB.trustee_reports = [
      { id: 'ok1', u: 'דני', t: 5, d: '2026-09-18', loc: 'מעבדה', ok: true, s: 'תקין', ts: '2026-09-18T08:00:00Z' },
      { id: 'h1', u: 'דני', t: 5, d: '2026-09-20', loc: 'מחסן', f: 'מטף חסום', ok: false, s: 'נסגר', ts: '2026-09-20T08:00:00Z', mgr_note: 'נותב לאחזקה' },
      { id: 'c1', u: 'רונית', t: 8, d: '2026-09-24', loc: 'מחסן', f: 'תמונת אחרי', ok: true, s: 'תקין', ref: 'h1', ts: '2026-09-24T08:00:00Z' },
      { id: 'h2', u: 'יוסי', t: 5, d: '2026-09-25', loc: 'רציף', f: 'מעבר חסום', ok: false, s: 'פתוח', ts: '2026-09-25T08:00:00Z' },
    ];
    DB.near_miss = [{ id: 'n1', d: '2026-09-26', descr: 'מעידה', s: 'פתוח' }];

    const aoa = _truLogAoa();
    const H = aoa[0], col = (name) => H.indexOf(name);
    const byId = {}; aoa.slice(1).forEach((row) => { byId[row[row.length - 1]] = row; });
    const r = { header: H, n: aoa.length - 1, ids: Object.keys(byId), firstId: aoa[1] && aoa[1][aoa[1].length - 1] };
    const get = (id, name) => byId[id] && byId[id][col(name)];
    r.okKind = get('ok1', 'סוג הדיווח'); r.okOC = get('ok1', 'פתוח / סגור');
    r.h1OC = get('h1', 'פתוח / סגור'); r.h1Date = get('h1', 'תאריך סגירה'); r.h1By = get('h1', 'נסגר על ידי');
    r.h1Days = get('h1', 'ימים פתוח / עד סגירה'); r.h1Note = get('h1', 'הערת מנהל');
    r.c1Kind = get('c1', 'סוג הדיווח'); r.h2OC = get('h2', 'פתוח / סגור'); r.h2By = get('h2', 'נסגר על ידי');

    connected = false; r.offline = await _truOdTick(); connected = true;
    r.offlinePushes = pushes.length;
    r.first = await _truOdTick(); r.firstPush = pushes[0];
    r.same = await _truOdTick(); r.afterSame = pushes.length;
    DB.trustee_reports.push({ id: 'h3', u: 'דני', t: 5, d: '2026-09-27', loc: 'מעבדה', f: 'שלט חסר', ok: false, s: 'פתוח', ts: '2026-09-27T08:00:00Z' });
    r.added = await _truOdTick(); r.afterAdd = pushes.length;
    DB.trustee_reports[3].s = 'נסגר';
    failNext = true; r.failed = await _truOdTick(); r.afterFail = pushes.length;
    r.retry = await _truOdTick(); r.afterRetry = pushes.length;
    const keep = DB.trustee_reports; DB.trustee_reports = [];
    r.empty = await _truOdTick(); DB.trustee_reports = keep;

    const labels = [];
    const origPop = window._popMenu;
    window._popMenu = function (a, id, build) { try { build(function (i, l, cb) { labels.push({ l, cb }); }, function () {}); } catch (e) {} };
    try { _truMgrMenu(null); } catch (e) {}
    window._popMenu = origPop;
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    window._currentUser = { username: 'admin' }; try { _applyRoleGates(); } catch (e) {}
    try { goPage('dash'); } catch (e) {}
    try { rDash(); } catch (e) { r.dashErr = String(e); }
    const tile = document.querySelector('#dash-qa #dash-tru-log button');
    r.tileText = tile ? tile.textContent.replace(/\s+/g, ' ') : null;
    r.tileVisible = !!(tile && tile.offsetParent);
    r.tileWired = !!(tile && /_truLogExportXlsx/.test(tile.getAttribute('onclick') || ''));
    r.qaCount = document.querySelectorAll('#dash-qa .qa-btn').length;
    r.menu = labels.some((x) => x.cb === window._truLogExportXlsx && /נאמנים/.test(x.l));
    return r;
  });

  console.log('\n1. every trustee report is in, and only trustee reports');
  check('clean check, finding, closure report, open finding: all 4 rows', out.n === 4, out.ids);
  check('near-miss is NOT in the trustee log', out.ids.indexOf('n1') < 0, out.ids);
  check('newest first', out.firstId === 'h2', out.firstId);
  check('clean check is labelled תקין, open/closed "-"', out.okKind === 'תקין' && out.okOC === '-', [out.okKind, out.okOC]);
  check('the closure report is labelled סגירת ממצא', out.c1Kind === 'סגירת ממצא', out.c1Kind);
  console.log('\n2. open and closed');
  check('closed finding says סגור', out.h1OC === 'סגור', out.h1OC);
  check('...with the closure date from the task-8 report', out.h1Date === '24/09/2026', out.h1Date);
  check('...and who closed it', out.h1By === 'רונית', out.h1By);
  check('...and days until closure (4)', out.h1Days === 4, out.h1Days);
  check('...and the manager note', out.h1Note === 'נותב לאחזקה', out.h1Note);
  check('open finding says פתוח, no closer', out.h2OC === 'פתוח' && out.h2By === '', [out.h2OC, out.h2By]);
  console.log('\n3. OneDrive push');
  check('not connected = nothing sent', out.offline === 'offline' && out.offlinePushes === 0, out.offline);
  check('first run uploads', out.first === 'pushed', out.first);
  check('...to נאמני בטיחות/יומן דיווחי נאמנים.xlsx',
    out.firstPush && out.firstPush.folder === 'נאמני בטיחות' && out.firstPush.name === 'יומן דיווחי נאמנים.xlsx', out.firstPush);
  check('...as xlsx', out.firstPush && /spreadsheetml/.test(out.firstPush.type), out.firstPush);
  check('no change = no upload', out.same === 'same' && out.afterSame === 1, out.afterSame);
  check('a new report = uploaded again', out.added === 'pushed' && out.afterAdd === 2, out.afterAdd);
  check('a failed push does not throw', out.failed === 'failed' && out.afterFail === 2, out.afterFail);
  check('...and a closure is retried on the next tick', out.retry === 'pushed' && out.afterRetry === 3, out.afterRetry);
  check('an empty list never overwrites the file', out.empty === 'empty', out.empty);
  console.log('\n4. reachable');
  check('manual download is on the trustee manager menu', out.menu);
  console.log('\n5. home screen');
  check('the log tile is on the home screen', out.tileVisible, out.tileText);
  check('...shows total reports and open findings (5 reports, 1 open)', /5 דיווחים/.test(out.tileText || '') && /1 ליקויים פתוחים/.test(out.tileText || ''), out.tileText);
  check('...and downloads the log', out.tileWired);
  check('...without adding a 7th quick-action tile', out.qaCount === 6, out.qaCount);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
