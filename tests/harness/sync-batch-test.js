// Four things about the sync layer. All four share a shape: the app told the
// user it was fine when it was not.
//
// 5.1  sbGet built one URL and never paged. PostgREST caps a response at
//      db-max-rows (1000) and says so in Content-Range, which nothing read.
//      _sbMergePull then treats what came back as the WHOLE table, so a local
//      row that was not in the page and has no queued op is dropped from DB —
//      and sdb() writes the trimmed copy to localStorage. Sorted
//      created_at.desc, so the OLDEST records vanish first: from the lists,
//      the counters, the expiry page, the CSV and the in-app backup.
//      workers/backup-cron.js has paged since it was written; the browser did not.
//
// 5.2  sbH() asks for return=representation, so PostgREST answers a PATCH or
//      DELETE that matched NOTHING with 200 and []. Nobody read the body, so
//      the op was marked sent and dropped from the queue, the pill went
//      ✓ בענן — and the next pull brought the old value back. RLS really does
//      produce this: a מדווח, or the anonymous kiosk session, gets 0 rows and
//      a 200 on every UPDATE.
//
// 5.3  Every non-2xx read collapsed to null, and sbSync treats null as
//      "unreachable, keep the cache" — then still sets SB_ON and paints
//      ✓ בענן. With an invalidated refresh token the manager saw days-old
//      expiries under a green tick. And _sbAuthPromise was memoized and never
//      cleared on a 401, so every later read reused the same dead token.
//
// 5.6  supabase-js comes from a CDN with no crossorigin attribute, so the
//      answer is an opaque response and a service worker may not cache it.
//      Offline, _sbClient stays null, the boot falls through to the login
//      screen, and typing the password answers "Supabase אינו זמין" — which
//      erases itself after 2.5 seconds, leaving a blank login screen. The data
//      is on the device and unreachable. Employee mode got in fine; it was the
//      MANAGER who was locked out.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(__dirname, '../..');
const HTML = 'file://' + path.join(ROOT, 'index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true; _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window._sbAuth = function () { return Promise.resolve({ access_token: 't' }); };
    window._sbToken = 't';
  });

  console.log('\n5.1 a table bigger than one page comes back whole');
  {
    const r = await page.evaluate(() => {
      // 2,350 rows: the server answers at most 1000 per request and reports the
      // range, exactly as PostgREST does.
      const ALL = []; for (let i = 0; i < 2350; i++) ALL.push({ id: 'n' + i, num: 'NCR-' + i, ts: '2026-01-01' });
      const asked = [];
      window.fetch = function (u, o) {
        const range = (o && o.headers && o.headers.Range) || '';
        asked.push(range);
        const m = range.match(/^(\d+)-(\d+)$/);
        const from = m ? +m[1] : 0, to = m ? +m[2] : 999;
        const slice = ALL.slice(from, to + 1);
        return Promise.resolve({
          ok: true, status: 206,
          json: () => Promise.resolve(slice),
          text: () => Promise.resolve(JSON.stringify(slice)),
        });
      };
      return sbGet('ncr').then(function (rows) { return { n: rows && rows.length, asked: asked, first: rows && rows[0].id, last: rows && rows[rows.length - 1].id }; });
    });
    check('all 2,350 rows arrive, not the first 1,000', r.n === 2350, r.n);
    check('...in three requests, each asking for its own range', r.asked.join('|') === '0-999|1000-1999|2000-2999', r.asked);
    check('the newest is still first — the order is unchanged', r.first === 'n0', r.first);
    check('and the oldest is there, which is the one that used to be dropped', r.last === 'n2349', r.last);

    const exact = await page.evaluate(() => {
      const ALL = []; for (let i = 0; i < 1000; i++) ALL.push({ id: 'x' + i });
      const asked = [];
      window.fetch = function (u, o) {
        const range = (o && o.headers && o.headers.Range) || '';
        asked.push(range);
        const m = range.match(/^(\d+)-(\d+)$/); const from = m ? +m[1] : 0, to = m ? +m[2] : 999;
        const slice = ALL.slice(from, to + 1);
        return Promise.resolve({ ok: true, status: 206, json: () => Promise.resolve(slice), text: () => Promise.resolve('') });
      };
      return sbGet('ncr').then(function (rows) { return { n: rows.length, asked: asked }; });
    });
    check('a table that is exactly one page full asks once more and stops', exact.n === 1000 && exact.asked.length === 2, exact);

    const empty = await page.evaluate(() => {
      window.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') }); };
      return sbGet('ncr').then(function (rows) { return { isArr: Array.isArray(rows), n: rows.length }; });
    });
    check('an empty table is still an empty array, not null — null means unreachable', empty.isArr && empty.n === 0, empty);

    const capped = await page.evaluate(() => {
      const ALL = []; for (let i = 0; i < 3000; i++) ALL.push({ id: 'l' + i });
      const asked = [];
      window.fetch = function (u, o) {
        asked.push((o && o.headers && o.headers.Range) || '');
        const m = asked[asked.length - 1].match(/^(\d+)-(\d+)$/);
        return Promise.resolve({ ok: true, status: 206, json: () => Promise.resolve(ALL.slice(+m[1], +m[2] + 1)), text: () => Promise.resolve('') });
      };
      return sbGet('notifications_log').then(function (rows) { return { n: rows.length, asked: asked }; });
    });
    check('notifications_log still stops at its 500-row ceiling', capped.n === 500 && capped.asked.join() === '0-499', capped);

    const runaway = await page.evaluate(() => {
      // A server that always answers a full page. The fixture gives up at 80
      // requests so a missing guard FAILS here instead of hanging the suite.
      let calls = 0;
      window.fetch = function (u, o) {
        calls++;
        const m = ((o && o.headers && o.headers.Range) || '0-999').match(/^(\d+)-(\d+)$/);
        const n = calls > 80 ? 0 : (+m[2] - +m[1] + 1); const out = [];
        for (let i = 0; i < n; i++) out.push({ id: 'r' + calls + '_' + i });
        return Promise.resolve({ ok: true, status: 206, json: () => Promise.resolve(out), text: () => Promise.resolve('') });
      };
      return sbGet('ncr').then(function (rows) { return { calls: calls, n: rows.length }; });
    });
    check('a server that never runs out is cut off rather than looped for ever', runaway.calls === 50 && runaway.n === 50000, runaway);
  }

  console.log('\n5.2 a write that changed nothing is not «sent»');
  {
    const r = await page.evaluate(() => {
      const seen = [];
      window.fetch = function (u, o) {
        seen.push({ u: String(u), m: (o && o.method) || 'GET' });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') });
      };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n1', d: 'x' } })
        .then(function () { return { threw: false, seen: seen }; },
              function (e) { return { threw: true, zero: !!e.zeroRows, body: e.body, seen: seen }; });
    });
    check('an UPDATE the server applied to 0 rows is an error, not a success', r.threw && r.zero, r);
    check('...and it says why, in words the manager can act on', /הרשאה/.test(r.body || ''), r.body);
    check('it really was a PATCH that we are judging', r.seen[0] && r.seen[0].m === 'PATCH', r.seen);

    const real = await page.evaluate(() => {
      window.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'n1' }]), text: () => Promise.resolve('') }); };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n1' } }).then(function () { return 'ok'; }, function (e) { return 'threw:' + e.message; });
    });
    check('an UPDATE that really changed a row is still a success', real === 'ok', real);

    const del = await page.evaluate(() => {
      window.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') }); };
      return _obSend({ op: 'del', tbl: 'ncr', id: 'gone' }).then(function () { return 'ok'; }, function (e) { return 'threw:' + e.message; });
    });
    check('a DELETE that matched nothing is DONE, not stuck — the row is already gone', del === 'ok', del);

    const upsert = await page.evaluate(() => {
      const seen = [];
      window.fetch = function (u, o) {
        seen.push({ m: (o && o.method) || 'GET', pref: (o && o.headers && o.headers.Prefer) || '' });
        return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve([{ id: 'n1' }]), text: () => Promise.resolve('') });
      };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n1', d: 'x' }, tries: 3 }).then(function () { return seen; });
    });
    check('after three refusals the row is put back as an upsert, not queued for ever', upsert[0].m === 'POST' && /merge-duplicates/.test(upsert[0].pref), upsert);

    const stillRefused = await page.evaluate(() => {
      window.fetch = function () { return Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('{"message":"new row violates row-level security policy"}') }); };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n1' }, tries: 5 }).then(function () { return 'ok'; }, function (e) { return e.status; });
    });
    check('...and if RLS is what refuses, the upsert is refused too and the op stays visible', stillRefused === 403, stillRefused);

    const eqi = await page.evaluate(() => {
      window.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') }); };
      return _eqiPdfSyncRow('upd', { id: 'e1' }).then(function () { return 'ok'; }, function (e) { return 'threw'; });
    });
    check('the PDF import had the same blind spot, and no longer does', eqi === 'threw', eqi);
  }

  console.log('\n5.3 a rejected session does not read as «in the cloud»');
  {
    const r = await page.evaluate(() => {
      let auths = 0, calls = 0;
      window._sbAuthPromise = 'STALE'; window._sbToken = 'dead';
      window._sbAuth = function () { auths++; return Promise.resolve({ access_token: 'fresh' }); };
      window.fetch = function () { calls++; return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve(null), text: () => Promise.resolve('JWT expired') }); };
      return sbGet('ncr').then(function (rows) {
        return { rows: rows, auths: auths, calls: calls, bad: _sbAuthRejected(), promise: window._sbAuthPromise };
      });
    });
    check('a 401 still returns null, so the cache is kept rather than wiped', r.rows === null, r.rows);
    check('...but the memoized session is dropped and rebuilt once', r.auths >= 2 && r.promise !== 'STALE', r);
    check('...and the read is retried with the new token', r.calls === 2, r.calls);
    check('when it fails again, the app knows the session is dead', r.bad, r.bad);

    const pill = await page.evaluate(() => {
      const p = document.getElementById('sync-pill');
      _obBadge('ok');
      const txt = (document.getElementById('sync-pill-txt') || {}).textContent;
      const cls = p ? p.className : '';
      _obBadge('auth');
      return { okTxt: txt, okCls: cls, authTxt: (document.getElementById('sync-pill-txt') || {}).textContent, authCls: p ? p.className : '' };
    });
    check('the pill refuses to say ✓ בענן while the session is rejected', !/ok/.test(pill.okCls) && pill.okTxt !== 'בענן', pill);
    check('...it says the data is old, and offers the details', /ישנים/.test(pill.authTxt || '') && /err/.test(pill.authCls), pill);

    const recovered = await page.evaluate(() => {
      window._sbAuth = function () { return Promise.resolve({ access_token: 'ok' }); };
      window.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'a' }]), text: () => Promise.resolve('') }); };
      return sbGet('ncr').then(function () {
        _obBadge('ok');
        return { bad: _sbAuthRejected(), cls: (document.getElementById('sync-pill') || {}).className };
      });
    });
    check('once a read succeeds again the warning clears', !recovered.bad && /ok/.test(recovered.cls), recovered);

    const notAuth = await page.evaluate(() => {
      let calls = 0;
      window.fetch = function () { calls++; return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null), text: () => Promise.resolve('boom') }); };
      return sbGet('ncr').then(function (rows) { return { rows: rows, calls: calls, bad: _sbAuthRejected() }; });
    });
    check('a 500 is not treated as an auth failure — no re-auth, no lock icon', notAuth.calls === 1 && !notAuth.bad && notAuth.rows === null, notAuth);
  }

  console.log('\n5.6 the manager can open the app offline');
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'functions/sw.js.js'), 'utf8');
    const tag = (src.match(/<script[^>]*supabase-js[^>]*>/) || [''])[0];
    check('the supabase-js tag is crossorigin, so the answer is CORS and not opaque', /crossorigin/.test(tag), tag);
    check('it is still deferred, so it does not block the first paint', /defer/.test(tag), tag);
    check('the worker names it as a vendor file to keep', /VENDOR\s*=\s*\[/.test(sw) && /supabase-js@2\.45\.4/.test(sw), (sw.match(/const VENDOR[\s\S]{0,180}/) || [''])[0]);
    check('...the same version the page asks for', (tag.match(/supabase-js@([\d.]+)/) || [])[1] === (sw.match(/supabase-js@([\d.]+)/) || [])[1], [tag.match(/supabase-js@([\d.]+)/), sw.match(/supabase-js@([\d.]+)/)]);
    check('it is fetched at install, so the first offline open already has it', /VENDOR\.map\(\(u\) => c\.add\(/.test(sw), (sw.match(/addAll\(SHELL\)[\s\S]{0,200}/) || [''])[0]);
    check('a vendor file that 404s does not take the shell cache with it', /c\.add\(new Request\(u, \{ mode: 'cors' \}\)\)\.catch/.test(sw));
    check('a CORS response is cacheable for vendor files only, not for everything', /isVendor && resp\.type === 'cors'/.test(sw), (sw.match(/const store[\s\S]{0,220}/) || [''])[0]);
    check('offline, the vendor file is served from the cache first', /if \(isVendor\) \{[\s\S]{0,260}caches\.match\(req/.test(sw));
    check('a failed script request is NOT answered with index.html — nosniff refuses it anyway', /req\.mode === 'navigate' \? caches\.match\('\/'\)/.test(sw), (sw.match(/catch\(\(\) => caches\.match\(req\)[\s\S]{0,200}/) || [''])[0]);

    // and the message the manager actually sees if it is still missing
    const msg = await page.evaluate(() => {
      document.getElementById('login').style.display = 'flex';
      window._sbClient = null;
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
      g('pw').value = 'x';
      doLogin();
      return { text: (g('pw-err') || {}).textContent || '' };
    });
    check('the offline message explains why, instead of two words', /אין חיבור/.test(msg.text) && msg.text.length > 40, msg.text);
    check('...and says what to do about it', /קליטה/.test(msg.text), msg.text);
    const sticky = await page.evaluate(() => new Promise((res) => setTimeout(() => res((g('pw-err') || {}).textContent || ''), 3000)));
    check('and it stays on screen — it used to erase itself after 2.5s, leaving nothing', sticky.length > 40, sticky);
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }); document.getElementById('login').style.display = 'none'; });
  }

  console.log('\n5.8 the audit-log migration is written (NOT run — it changes an RLS policy)');
  {
    const sql = fs.readFileSync(path.join(ROOT, 'migrations/2026-09-20_audit_log_append_only.sql'), 'utf8');
    check('it drops the FOR ALL policy that allowed UPDATE and DELETE', /DROP POLICY IF EXISTS audit_log_admin_manager_all/.test(sql));
    check('...and replaces the read half with a SELECT-only policy', /CREATE POLICY audit_log_admin_manager_select[\s\S]{0,80}FOR SELECT/.test(sql));
    check('INSERT keeps working — the app depends on it', /audit_log_authenticated_insert/.test(sql) && /FOR INSERT/.test(sql));
    check('no policy is created for UPDATE or DELETE, which is the whole point', !/FOR UPDATE/.test(sql) && !/FOR DELETE/.test(sql), (sql.match(/FOR (UPDATE|DELETE)/g) || []));
    check('it carries a rollback', /DROP POLICY IF EXISTS audit_log_admin_manager_select/.test(sql));
    check('...and a verification block to paste', /pg_policies/.test(sql) && /ROLLBACK/.test(sql));
    check('and it says out loud that it has not been run', /טרם הורצה/.test(sql));

    // the claim the migration rests on: the app never writes to audit_log
    const appSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('the app never updates audit_log', !/sbUpd\(\s*'audit_log'/.test(appSrc), (appSrc.match(/sbUpd\(\s*'audit_log'[^)]*\)/g) || []));
    check('...and never deletes from it', !/sbDel\(\s*'audit_log'/.test(appSrc) && !/askDel\(\s*'audit_log'/.test(appSrc));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
