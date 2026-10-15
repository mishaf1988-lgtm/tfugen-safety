// The sync core, after the deep review of 15/10/2026 (Michael: "a thorough check down to the smallest detail,
// no data that disappears"). Each check is one way a save could be lost, sent twice, sent under
// the wrong person, or hang, found in the real code of index.html:
//  - a manager whose session was revoked silently became anonymous and the pull emptied the tables;
//  - two drains at once, and an old edit retried after a newer one landed;
//  - a network error made every later op wait its own 30 seconds;
//  - the queue of one user went out under the next user's sign-in;
//  - the photo store failing or hanging was read as "no photos", and a refused photo held its report for ever;
//  - the kiosk sent audit rows the server always refuses (197 a day on one phone, live logs).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.sdb = function () {}; window.addLog = function () {}; window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__realAuth = window._sbAuth; window._sbAuth = function () { return Promise.resolve(); }; _sbToken = 'tok';
    window.__resp = (st, body) => Promise.resolve({ ok: st >= 200 && st < 300, status: st, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  });

  console.log('\n1. a signed-in person is never swapped for an anonymous session');
  const auth = await page.evaluate(() => {
    let anon = 0, refresh = 0;
    _sbClient = { auth: { getSession: () => Promise.resolve({ data: { session: null } }), signInAnonymously: () => { anon++; return Promise.resolve({ data: { session: { access_token: 'anon' } } }); }, refreshSession: () => { refresh++; return new Promise((r) => setTimeout(() => r({ data: { session: null } }), 50)); } } };
    window._sbBoot = function () {}; window._captcha = () => Promise.resolve('');
    window._sbAuth = window.__realAuth; _sbAuthPromise = null;
    _currentUser = { username: 'dana' };
    return _sbAuth().then(() => 'ok', (e) => (e.sessionExpired ? 'expired' : 'err')).then((a) => {
      _sbAuthPromise = null;
      return Promise.all([_sbReauth().catch((e) => !!e.sessionExpired), _sbReauth().catch((e) => !!e.sessionExpired)]).then((b) => {
        document.body.classList.add('emp-mode'); _sbAuthPromise = null;
        return _sbAuth().then(() => { document.body.classList.remove('emp-mode'); return { a, b, anon, refresh }; });
      });
    });
  });
  check('a manager with no session: "session expired", no anonymous sign-in', auth.a === 'expired', auth);
  check('two re-authentications at once: one refresh, both told the session expired, still no anonymous', auth.refresh === 1 && auth.b.every(Boolean), auth);
  check('the trustee kiosk still signs in anonymously', auth.anon === 1, auth);
  await page.evaluate(() => { window._sbAuth = function () { return Promise.resolve(); }; _currentUser = { username: 'dana' }; _sbToken = 'tok'; });

  console.log('\n2. one drain at a time, and the order of one record holds');
  const one = await page.evaluate(() => {
    let n = 0; window.fetch = () => { n++; return new Promise((r) => setTimeout(() => r(__resp(201, [{ id: 'x' }])), 80)); };
    _obSet([{ op: 'ins', tbl: 'ppe', row: { id: 'p1' }, oid: 'a' }]); SB_ON = true; _obBusy = false; _obDrainP = null; _phBusy = false;
    const a = _obDrain(), b = _obDrain();
    return Promise.all([a, b]).then(() => ({ same: a === b, n, left: _obGet().length }));
  });
  check('two drains started together are one drain: the row goes once', one.same && one.n === 1 && one.left === 0, one);
  const order = await page.evaluate(() => {
    const seen = []; window.fetch = (u, o) => { seen.push(o.method + ' ' + u.replace(/^.*\/rest\/v1\//, '')); return __resp(500, { message: 'boom' }); };
    _obSet([{ op: 'upd', tbl: 'ppe', row: { id: 'p2', v: 'old' }, oid: 'u1' }, { op: 'upd', tbl: 'ppe', row: { id: 'p2', v: 'new' }, oid: 'u2' }, { op: 'ins', tbl: 'ppe', row: { id: 'p3' }, oid: 'i3' }, { op: 'del', tbl: 'ppe', id: 'p3', oid: 'd3' }]);
    _obBusy = false; _obDrainP = null;
    return _obDrainOps().then(() => ({ seen, left: _obGet().map((o) => o.oid + ':' + (o.tries || 0)) }));
  });
  check('an edit fails: the newer edit of the same record waits (it would land first, then the old one overwrite it)', order.seen.filter((x) => /p2/.test(x)).length === 1, order);
  check('an insert fails: the delete of the same record waits (it counted as done and the record came back)', !order.seen.some((x) => /^DELETE/.test(x)) && order.left.join() === 'u1:1,u2:0,i3:1,d3:0', order);
  const net = await page.evaluate(() => {
    let n = 0; window.fetch = () => { n++; return Promise.reject(new TypeError('Failed to fetch')); };
    _obSet([{ op: 'ins', tbl: 'ppe', row: { id: 'q1' }, oid: 'q1' }, { op: 'ins', tbl: 'ppe', row: { id: 'q2' }, oid: 'q2' }, { op: 'ins', tbl: 'ppe', row: { id: 'q3' }, oid: 'q3' }]);
    _obBusy = false; _obDrainP = null;
    return _obDrainOps().then(() => ({ n, left: _obGet().length, busy: _obBusy }));
  });
  check('a network error ends the pass: one request, not one 30-second wait per row; all stay queued', net.n === 1 && net.left === 3 && net.busy === false, net);
  const merge = await page.evaluate(() => {
    let release; window.fetch = () => new Promise((r) => { release = () => r(__resp(500, {})); });
    _obSet([{ op: 'ins', tbl: 'trustee_reports', row: { id: 'm1', photo_url: 'pending:pz' }, oid: 'm1' }]);
    _phLeft = {}; _obBusy = false; _obDrainP = null;
    const p = _obDrainOps();
    return new Promise((res) => setTimeout(() => {
      const q = _obGet(); q[0].row.photo_url = 'https://s/tru-1.jpg'; _obSet(q);   // _phResolve during the pass
      release(); p.then(() => res(_obGet()[0]));
    }, 50));
  });
  check('the photo address written into the queue during a pass is kept (the pass put the placeholder back)', merge.row.photo_url === 'https://s/tru-1.jpg' && merge.tries === 1, merge);
  const who = await page.evaluate(() => {
    let n = 0; window.fetch = () => { n++; return __resp(201, [{}]); };
    _currentUser = { username: 'dana' }; _obSet([]);
    sbIns('ppe', { id: 'w1' });
    const mine = _obGet().find((o) => o.tbl === 'ppe'); const uid = mine && mine.uid;
    _obSet([{ op: 'ins', tbl: 'ppe', row: { id: 'w2' }, oid: 'w2', uid: 'yossi' }]); _obBusy = false; _obDrainP = null;
    return _obDrainOps().then(() => ({ uid, n, left: _obGet().map((o) => o.uid) }));
  });
  check('a queued action carries its user, and another user\'s action waits for that user', who.uid === 'dana' && who.left.join() === 'yossi', who);

  console.log('\n3. the lock, the stale sync, the pill');
  const lock = await page.evaluate(() => { _isAdmin = true; SB_ON = true; _obReady = true; const g0 = _sbGen; try { _lockNow(); } catch (e) {} return { on: SB_ON, ready: _obReady, gen: _sbGen - g0 }; });
  check('the lock stops the queue and every pull already running (generation moves)', lock.on === false && lock.ready === false && lock.gen === 1, lock);
  const gen = await page.evaluate(() => new Promise((res) => {
    window.__merged = 0; const real = window._sbMergePull; window._sbMergePull = function () { window.__merged++; };
    window.sbGet = () => new Promise((r) => setTimeout(() => r([{ id: 'x' }]), 60));
    SB_ON = false; sbSync(true); _sbGen++;   // a lock arrives while the answers are on the way
    setTimeout(() => { window._sbMergePull = real; res({ merged: window.__merged, on: SB_ON }); }, 1500);
  }));
  check('answers that arrive after the lock are not merged, and the app is not marked synced', gen.merged === 0 && gen.on === false, gen);
  const stale = await page.evaluate(() => { _obSet([]); _obMem = []; _phN = 0; _sbStale = true; _sbAuthBad = 0; _obBadge('ok'); const t = (document.getElementById('sync-pill-txt') || {}).textContent || ''; _sbStale = false; return t; });
  check('a sync where some tables did not come back does not say "in the cloud"', /לא התעדכנו/.test(stale), stale);

  console.log('\n4. photos');
  const unk = await page.evaluate(() => {
    _phUnknown = true; _phLeft = {}; _phGaveUp = {};
    const held = _obWaitsPhoto({ op: 'ins', row: { id: 'h', photo_url: 'pending:abc' } });
    _phGaveUp.abc = 1; const released = !_obWaitsPhoto({ op: 'ins', row: { id: 'h', photo_url: 'pending:abc' } });
    _phUnknown = false; _phGaveUp = {};
    return { held, released };
  });
  check('the photo store could not be read: a row with a waiting photo is held, not sent as if the photo were gone', unk.held === true, unk);
  check('a photo the server refused for good releases its row', unk.released === true, unk);
  const perm = await page.evaluate(() => new Promise((res) => {
    window.__toasts = []; const realAll = window._phAll, realUp = window._fileUpload;
    window._phAll = (cb) => cb([{ pid: 'pp1', blob: new Blob(['x']), prefix: 'tru-ph-1' }]);
    window._fileUpload = (b, pre, cb) => cb(null, 403, 'policy');
    _phBusy = false; _phGaveUp = {}; _phTries = {}; SB_ON = true;
    _phDrain().then(() => { window._phAll = realAll; window._fileUpload = realUp; res({ gave: !!_phGaveUp.pp1, toast: window.__toasts.join('|'), busy: _phBusy }); });
  }));
  check('a 403 on the upload: the report is let go without the photo, and the person is told', perm.gave && /לא עלתה/.test(perm.toast) && perm.busy === false, perm);
  const busyNow = await page.evaluate(() => { const realAll = window._phAll; window._phAll = () => {}; _phBusy = false; SB_ON = true; _phDrain(); const b = _phBusy; _phBusy = false; window._phAll = realAll; return b; });
  check('the photo drain is busy from its first moment (ten saves started ten uploads of every photo)', busyNow === true, busyNow);
  const idb = await page.evaluate(() => new Promise((res) => {
    const real = window.indexedDB; _PHDB = null; const t = Date.now();
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: () => ({}) } });
    _phDb((d) => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: real }); res({ d, ms: Date.now() - t }); });
  }));
  check('a photo store that never opens answers "none" within 3 seconds', idb.d === null && idb.ms < 4000, idb);
  const part = await page.evaluate(() => {
    _obSet([]); DB.near_miss = [{ id: 'n9', d: 'old desc', s: 'open', photo_url: 'pending:pq' }];
    _phResolve('pq', 'https://s/nm-1.jpg');
    const op = _obGet().find((o) => o.tbl === 'near_miss'); return op && op.row;
  });
  check('the photo repair sends only the photo field, not the whole (possibly stale) row', part && part.photo_url === 'https://s/nm-1.jpg' && part.id === 'n9' && !('d' in part), part);

  console.log('\n5. audit rows');
  const aud = await page.evaluate(() => {
    _obSet([]); _aud('ins', 'ncr', { id: 'a1' }); _aud('ins', 'ppe', { id: 'a2' });
    document.body.classList.add('emp-mode'); _aud('ins', 'ppe', { id: 'a3' }); document.body.classList.remove('emp-mode');
    return _obGet().filter((o) => o.tbl === 'audit_log').map((o) => o.row.record_id);
  });
  check('no client audit row for tables the database audits itself, nor from the kiosk', aud.join() === 'a2', aud);
  const a403 = await page.evaluate(() => { window.fetch = () => __resp(403, { message: 'new row violates row-level security policy for table "audit_log"' }); return _obSend({ op: 'ins', tbl: 'audit_log', row: { table_name: 'x' } }).then(() => 'dropped', (e) => 'kept ' + e.status); });
  check('an audit row refused with 403 is dropped, not retried for ever (the red pill next to real reports)', a403 === 'dropped', a403);

  console.log('\n6. paging and catching up');
  const pg = await page.evaluate(() => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: 'r' + i })), page2 = [{ id: 'r999' }, { id: 'r1000' }];
    let k = 0; const real = window._fetchT; window._fetchT = () => __resp(206, k++ ? page2 : page1);
    return _sbFetchAll('https://x/rest/v1/t', 0).then((res) => { window._fetchT = real; return { n: res.rows.length, ids: new Set(res.rows.map((r) => r.id)).size }; });
  });
  check('a row that moved between two pages is kept once, and the read goes on past the duplicate', pg.n === 1001 && pg.ids === 1001, pg);
  check('reads are ordered with id as the tie-breaker', /'\.desc,id\.desc'/.test(await page.evaluate(() => _sbGetOnce.toString())));
  const kiosk = await page.evaluate(() => { let n = 0; const real = window.sbSync; window.sbSync = () => { n++; }; SB_ON = true; document.body.classList.add('emp-mode'); _sbPullOnFocus(true); document.body.classList.remove('emp-mode'); _sbPullOnFocus(true); window.sbSync = real; return n; });
  check('the kiosk does not run the full 43-table sync on focus (it pulls its own tables)', kiosk === 1, kiosk);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  ✗ crashed: ' + (e && e.stack)); process.exit(1); });
