// The trustee on the factory floor, on weak signal (15/10/2026, Michael: "no stops and no data that
// disappears"). The review of the trustee and sync paths found ways to hang the form and to lose a
// hazard's photo. Each is checked here in the real index.html:
//  - a photo the phone cannot decode answered nothing: the slot stayed on "uploading" for ever;
//  - no fetch had a time limit: a dropped connection held the queue (_obBusy) until a reload;
//  - a new row went up before its photo, and the trustee's session cannot update it afterwards;
//  - a restored draft kept the placeholder of a photo already uploaded;
//  - an insert whose answer was lost was refused for ever on retry (upsert needs UPDATE);
//  - after the lock, the queue went on sending as anonymous.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const SRC = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.sdb = function () {}; window.addLog = function () {}; window.toast = function () {}; window._sbAuth = function () { return Promise.resolve(); }; _sbToken = 'tok'; });

  console.log('\n1. a photo that cannot be read does not hang the form');
  const bad = await page.evaluate(() => new Promise((res) => {
    const f = new File([new Uint8Array([1, 2, 3, 4, 5])], 'x.heic', { type: 'image/heic' }), t = Date.now();
    _imgCompress(f, 1200, 0.8, (b, d) => res({ same: b === f, ms: Date.now() - t }));
    setTimeout(() => res({ timeout: true }), 25000);
  }));
  check('an image the browser cannot decode: the callback comes, with the original file', bad.same === true && bad.ms < 5000, bad);
  const good = await page.evaluate(() => new Promise((res) => {
    const c = document.createElement('canvas'); c.width = 50; c.height = 40; c.getContext('2d').fillRect(0, 0, 10, 10);
    c.toBlob((bl) => _imgCompress(new File([bl], 'a.png', { type: 'image/png' }), 1200, 0.8, (b, d) => res({ jpeg: b && b.type, data: /^data:image\/jpeg/.test(d || '') })));
  }));
  check('...and a normal photo is still shrunk to a JPEG', good.jpeg === 'image/jpeg' && good.data, good);

  console.log('\n2. no request waits for ever');
  const ab = await page.evaluate(() => {
    window.fetch = (u, o) => new Promise((res, rej) => { if (o && o.signal) o.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); });
    const t = Date.now();
    return _fetchT('https://x/rest/v1/t', {}, 200).then(() => ({ ok: true }), (e) => ({ name: e.name, ms: Date.now() - t }));
  });
  check('_fetchT gives up after its time limit (AbortError)', ab.name === 'AbortError' && ab.ms < 1500, ab);
  const uses = ['function _obSend', 'function _sbFetchAll', 'function _fileUpload', 'function _empGateAsk', 'function _truApi'].map((f) => {
    const i = SRC.indexOf(f); return [f, i >= 0 && /_fetchT\(/.test(SRC.slice(i, i + (f === 'function _obSend' ? 2600 : 1600)))];
  });
  check('the queue, the sync, the upload, the trustee gate and the trustee API all use it', uses.every((u) => u[1]), uses.filter((u) => !u[1]));
  const stuck = await page.evaluate(() => {
    window.fetch = (u, o) => new Promise((res, rej) => { if (o && o.signal) o.signal.addEventListener('abort', () => rej(new TypeError('aborted'))); });
    const real = window._fetchT; window._fetchT = (u, o) => real(u, o, 150);
    _obSet([{ op: 'ins', tbl: 'near_miss', row: { id: 'nm1' }, oid: 'o1' }]); SB_ON = true; _obBusy = false;
    return _obDrainOps().then(() => { window._fetchT = real; return { busy: _obBusy, queued: _obGet().length, err: (_obGet()[0] || {}).lastError }; });
  });
  check('a send that hangs ends as a network error: the queue is free again and the row stays queued', stuck.busy === false && stuck.queued === 1 && /^net/.test(stuck.err || ''), stuck);

  console.log('\n3. a new row goes up with its photo, not before it');
  const hold = await page.evaluate(() => {
    const sent = [];
    window.fetch = (u, o) => { sent.push(String(u)); return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve([{ id: 'x' }]), text: () => Promise.resolve('') }); };
    _phLeft = { p1: 1 };
    _obSet([{ op: 'ins', tbl: 'trustee_reports', row: { id: 'r1', photo_url: 'pending:p1' }, oid: 'a' }, { op: 'ins', tbl: 'trustee_reports', row: { id: 'r2', photo_url: 'pending:gone' }, oid: 'b' }, { op: 'ins', tbl: 'trustee_reports', row: { id: 'r3' }, oid: 'c' }]);
    SB_ON = true; _obBusy = false;
    return _obDrainOps().then(() => ({ sent, left: _obGet().map((o) => o.row.id), tries: (_obGet()[0] || {}).tries }));
  });
  check('a row whose photo is still in the phone\'s queue waits (not counted as a failure)', hold.left.join() === 'r1' && !hold.tries && !hold.sent.some((u) => /r1/.test(u)), hold);
  check('...a row whose photo is no longer queued, and a row with no photo, go now', hold.sent.length === 2, hold.sent);

  console.log('\n4. the restored draft gets the real address');
  const dr = await page.evaluate(() => {
    localStorage.setItem(_TRU_DRAFT_KEY, JSON.stringify({ photos: { a1: 'pending:p9' }, f: 'x' }));
    _obSet([]);
    _phResolve('p9', 'https://s/storage/v1/object/public/incidents-photos/tru-1.jpg');
    return localStorage.getItem(_TRU_DRAFT_KEY);
  });
  check('a photo uploaded while the app was closed: the draft now holds its address, not the placeholder', /tru-1\.jpg/.test(dr) && !/pending:p9/.test(dr), dr);

  console.log('\n5. an insert that already arrived');
  const twice = await page.evaluate(() => {
    const seen = [];
    const mk = (exists) => (u, o) => {
      seen.push(((o && o.method) || 'GET') + ' ' + String(u).replace(/^.*\/rest\/v1\//, ''));
      if (o && o.method === 'POST') return Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('{"message":"new row violates row-level security policy"}') });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(exists ? [{ id: 'r5' }] : []) });
    };
    window.fetch = mk(true);
    return _obSend({ op: 'ins', tbl: 'trustee_reports', row: { id: 'r5' } }).then(() => 'done', (e) => 'err ' + e.status).then((a) => {
      window.fetch = mk(false);
      return _obSend({ op: 'ins', tbl: 'trustee_reports', row: { id: 'r6' } }).then(() => 'done', (e) => 'err ' + e.status).then((b) => ({ a, b, seen }));
    });
  });
  check('refused on retry but the row is on the server: done, not stuck for ever', twice.a === 'done' && twice.seen.some((s) => /^GET trustee_reports\?id=eq\.r5/.test(s)), twice);
  check('refused and not on the server: still an error that stays queued', twice.b === 'err 403', twice);

  console.log('\n6. the lock stops the background sends');
  const lk = await page.evaluate(() => { SB_ON = true; try { _lockNow(); } catch (e) {} return SB_ON; });
  check('after the lock SB_ON is off: nothing goes out as anonymous until the next sign-in', lk === false, lk);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  ✗ crashed: ' + (e && e.stack)); process.exit(1); });
