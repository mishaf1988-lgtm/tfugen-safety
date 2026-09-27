// The live reports log in OneDrive: does it upload when the list changes,
// stay quiet when it does not, and retry after a failed push?
//
// _hazOdTick is driven against a fake OneDrive (_odToken / _odPushFile) and a
// fake XLSX, so nothing leaves the page.
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
    try { localStorage.removeItem('tfgn_haz_od_sig'); } catch (e) {}

    DB.trustee_tasks = [{ id: 'k5', n: 5, t: 'עמדות כיבוי אש', active: true }];
    DB.trustee_reports = [{ id: 'h1', u: 'דני', t: 5, d: '2026-09-20', loc: 'מחסן', f: 'מטף חסום', ok: false, s: 'פתוח', ts: '2026-09-20T08:00:00Z' }];
    DB.near_miss = [];

    const r = {};
    connected = false; r.offline = await _hazOdTick(); connected = true;
    r.offlinePushes = pushes.length;
    r.first = await _hazOdTick();
    r.firstPush = pushes[0];
    r.same = await _hazOdTick();
    r.afterSame = pushes.length;
    DB.trustee_reports[0].s = 'נסגר';
    r.closed = await _hazOdTick();
    r.afterClose = pushes.length;
    DB.near_miss.push({ id: 'n1', d: '2026-09-26', descr: 'מעידה', area: 'רציף', rep: 'משה', s: 'פתוח', ts: '2026-09-26T08:00:00Z' });
    failNext = true; r.failed = await _hazOdTick();
    r.afterFail = pushes.length;
    r.retry = await _hazOdTick();
    r.afterRetry = pushes.length;
    const keepT = DB.trustee_reports, keepN = DB.near_miss;
    DB.trustee_reports = []; DB.near_miss = [];
    r.empty = await _hazOdTick();
    DB.trustee_reports = keepT; DB.near_miss = keepN;
    return r;
  });

  console.log('\n1. when it uploads');
  check('not connected to OneDrive = nothing is sent', out.offline === 'offline' && out.offlinePushes === 0, out);
  check('first run uploads the file', out.first === 'pushed', out.first);
  check('...to the fixed file דיווחים/יומן דיווחים.xlsx',
    out.firstPush && out.firstPush.folder === 'דיווחים' && out.firstPush.name === 'יומן דיווחים.xlsx', out.firstPush);
  check('...as xlsx', out.firstPush && /spreadsheetml/.test(out.firstPush.type), out.firstPush);
  check('nothing changed = no second upload', out.same === 'same' && out.afterSame === 1, out);
  check('a report closed = uploaded again', out.closed === 'pushed' && out.afterClose === 2, out);
  console.log('\n2. failure and empty');
  check('a failed push (file open in Excel) does not throw', out.failed === 'failed' && out.afterFail === 2, out);
  check('...and is retried on the next tick', out.retry === 'pushed' && out.afterRetry === 3, out);
  check('an empty list never overwrites the file', out.empty === 'empty', out.empty);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
