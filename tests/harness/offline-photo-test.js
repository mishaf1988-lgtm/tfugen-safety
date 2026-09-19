// Offline photo queue: a failed upload is kept on the device (IndexedDB) and
// sent when the connection returns, so a trustee can file a hazard with no
// signal — a photo is mandatory there, so before this the whole report was
// blocked. Drives the real report form, the real _attachPick input, the real
// _phQueue/_phDrain and the real svTru validation. The network is blocked, so
// the first upload fails for real rather than being stubbed into failing.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// A genuine 1x1 JPEG, so the real _imgCompress path runs (canvas + toBlob).
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

const pick = async (page, areaId) => {
  await page.evaluate((a) => { _attachPending[a] = true; _attachPick(a, a); }, areaId);
  await page.setInputFiles('#_att_inp_' + areaId, { name: 'hazard.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.waitForFunction((a) => _attachPending[a] === false, areaId, { timeout: 8000 });
};

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('filechooser', () => {});                       // _attachPick clicks the input; don't hang on it
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['trustee_reports', 'trustees', 'trustee_winners', 'near_miss', 'tasks'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); }; window.empToast = window.toast;
    window.__realUpload = _fileUpload;                    // restored between sections
    window.__online = function (on) {
      _fileUpload = on
        ? function (blob, prefix, cb) { window.__uploaded.push({ prefix, size: blob && blob.size }); cb('https://sb.co/storage/v1/object/public/incidents-photos/' + prefix + '-sent.jpg'); }
        : window.__realUpload;
    };
    window.__uploaded = [];
    _obSet([]);
    window._currentUser = { username: 'admin' }; _applyRoleGates();
  });

  console.log('\n1. Offline: the photo a worker just took is kept, not lost');
  // Open the real form on task 1 and mark the item a ליקוי, so the photo area exists.
  const k = await page.evaluate(() => {
    _truSetMe('לב'); _truReport(1);
    const key = _truForm.tasks[1].items[0].k;
    _truFormSetOk(1, key, false);
    return key;
  });
  const areaId = 'tru-ph-1-' + k;
  await pick(page, areaId);
  const q1 = await page.evaluate((a) => new Promise(res => {
    _phAll(list => res({
      url: _attachUrls[a], n: list.length, hasBlob: !!(list[0] && list[0].blob && list[0].blob.size > 0),
      prefix: list[0] && list[0].prefix, phN: _phN,
      area: (document.getElementById(a) || {}).innerHTML || '',
      pill: (document.getElementById('emp-sync-count') || {}).textContent
    }));
  }), areaId);
  check('upload failed with no network → the file is in IndexedDB with its bytes', q1.n === 1 && q1.hasBlob && q1.prefix === areaId, q1);
  check('the attachment holds a pending sentinel, not null', /^pending:ph/.test(q1.url || ''), q1.url);
  check('the area says the photo is kept on the device and will be sent later', /נשמרה במכשיר/.test(q1.area) && /תעלה אוטומטית/.test(q1.area), q1.area.slice(0, 200));
  check('the pending counter and the worker-mode pill include the photo', q1.phN === 1 && q1.pill === '1', { phN: q1.phN, pill: q1.pill });

  console.log('\n2. The hazard report can now be filed offline (this is the point)');
  const sv = await page.evaluate((key) => {
    document.querySelector('#tru-tasks [data-tru-f][data-n="1"][data-k="' + key + '"]').value = 'דלת חירום חסומה';
    document.getElementById('tru-loc').value = 'מחסן';
    const before = DB.trustee_reports.length;
    window.__toasts = [];
    svTru();
    const rows = DB.trustee_reports.slice(before);
    return { saved: rows.length, photo: rows[0] && rows[0].photo_url, ok: rows[0] && rows[0].ok, f: rows[0] && rows[0].f,
      toasts: window.__toasts, closed: document.getElementById('m-tru').style.display !== 'block',
      queued: _obGet().filter(o => o.tbl === 'trustee_reports').length };
  }, k);
  check('svTru accepts the pending photo and saves the hazard (no «חסרה תמונה» block)', sv.saved === 1 && sv.ok === false && sv.f === 'דלת חירום חסומה' && !sv.toasts.some(t => /חסרה תמונה/.test(t)), sv);
  check('the row carries the sentinel and is queued in the outbox', /^pending:ph/.test(sv.photo || '') && sv.queued === 1 && sv.closed, sv);

  console.log('\n3. Back online: the photo goes up and the sentinel is replaced everywhere');
  const dr = await page.evaluate((a) => new Promise(res => {
    window.__online(true); SB_ON = true;
    _phDrain().then(() => _phAll(list => res({
      left: list.length, phN: _phN, uploaded: window.__uploaded.length,
      row: (DB.trustee_reports.slice(-1)[0] || {}).photo_url,
      op: (_obGet().filter(o => o.tbl === 'trustee_reports')[0] || {}).row,
      area: _attachUrls[a],
      upds: _obGet().filter(o => o.op === 'upd' && o.tbl === 'trustee_reports').length
    })));
  }), areaId);
  check('the queued photo is uploaded once and removed from the device', dr.uploaded === 1 && dr.left === 0 && dr.phN === 0, dr);
  check('the saved row now holds the real URL', /-sent\.jpg$/.test(dr.row || ''), dr.row);
  check('the outbox op was patched in place — it goes up once, already correct', /-sent\.jpg$/.test((dr.op || {}).photo_url || ''), dr.op);
  check('no redundant update was queued for a row that had not been sent yet', dr.upds === 0, dr.upds);

  console.log('\n4. A row that already reached the server is repaired with an update');
  const up = await page.evaluate(() => {
    _obSet([]);
    DB.near_miss = [{ id: 'nm1', d: '2026-09-19', photo_url: 'pending:phZZZ', descr: 'x' }];
    _phResolve('phZZZ', 'https://sb.co/storage/v1/object/public/incidents-photos/nm-sent.jpg');
    const ops = _obGet().filter(o => o.tbl === 'near_miss');
    return { row: DB.near_miss[0].photo_url, ops: ops.length, op: ops[0] && ops[0].op, id: ops[0] && ops[0].row && ops[0].row.id };
  });
  check('sentinel swapped in the row and an upd queued, because the insert had already gone', /nm-sent\.jpg$/.test(up.row || '') && up.ops === 1 && up.op === 'upd' && up.id === 'nm1', up);

  console.log('\n5. Removing the attachment removes the queued file');
  const k2 = await page.evaluate(() => {
    window.__online(false);                                // uploads fail again
    _truReport(2);
    const key = _truForm.tasks[2].items[0].k;
    _truFormSetOk(2, key, false);
    return key;
  });
  const area2 = 'tru-ph-2-' + k2;
  await pick(page, area2);
  const cl = await page.evaluate((a) => new Promise(res => {
    _phAll(before => { _attachClear(a); setTimeout(() => _phAll(after => res({ before: before.length, after: after.length, url: _attachUrls[a], phN: _phN })), 300); });
  }), area2);
  check('«הסר» deletes the file from the device too, so nothing uploads orphaned', cl.before === 1 && cl.after === 0 && !cl.url && cl.phN === 0, cl);

  console.log('\n6. A real server answer is still an error — waiting would not help');
  const se = await page.evaluate(() => new Promise(res => {
    try { closeModal('m-tru'); } catch (e) {}
    _fileUpload = function (f, p, cb) { cb(null, 403, 'forbidden'); };
    const d = document.createElement('div'); d.id = 'x-area'; document.body.appendChild(d);
    _attachPending['x-area'] = true;
    _attachPick('x-area', 'x-area');
    const inp = document.getElementById('_att_inp_x-area');
    Object.defineProperty(inp, 'files', { value: [new File([new Blob(['x'])], 'a.jpg', { type: 'image/jpeg' })], configurable: true });
    inp.onchange();
    setTimeout(() => _phAll(l => res({ queued: l.length, url: _attachUrls['x-area'], html: d.innerHTML })), 400);
  }));
  check('403 is shown as an error and is NOT queued for retry', se.queued === 0 && se.url === null && /נסה שוב/.test(se.html), { queued: se.queued, url: se.url });

  console.log('\n7. A pending photo shows as waiting, never as a dead link');
  const ch = await page.evaluate(() => {
    DB.trustee_reports = [{ id: 'p1', u: 'לב', t: 1, d: new Date().toISOString().substring(0, 10), m: _truThisMonth(), loc: 'מחסן', ok: false, f: 'ממצא', photo_url: 'pending:phQQQ', s: 'פתוח', ts: new Date().toISOString() }];
    _truSetMe('לב'); _truRender();
    const mine = (document.getElementById('tru-mine') || {}).innerHTML || '';
    goPage('trustees'); _truMgrSetFilter('all'); rTrustees();
    const mgr = (document.getElementById('tb-trustees') || {}).innerHTML || '';
    return { mineChip: /ממתינה/.test(mine), mineLink: /data-sign="pending/.test(mine), mgrChip: /ממתינה/.test(mgr), mgrLink: /data-sign="pending/.test(mgr) };
  });
  check('trustee and manager both see «⏳ ממתינה» instead of a photo link that opens nothing', ch.mineChip && !ch.mineLink && ch.mgrChip && !ch.mgrLink, ch);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
