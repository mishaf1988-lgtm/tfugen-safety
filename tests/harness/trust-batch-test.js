// Two things about trusting what is on the screen.
//
// 5.7  Every PATCH went out as `?id=eq.<id>` with the whole row in the body
//      and no condition at all — no If-Match, no version, nothing. Last
//      writer wins, silently. Two real cases, both Michael's own: the NCR
//      modal open on the phone while the desktop changed the status, and —
//      worse — the offline queue, where an edit made in the plant with no
//      signal goes out hours later carrying stale values over everything
//      done since. On an NCR that means a closed finding reopening, or a
//      target date moving backwards, in a record an auditor reads.
//
// 3.11 Not one of the 46 sv* functions writes who saved the record. Opening
//      a PPE or contractor row with an expiry that looks wrong, nothing on
//      the sheet says who entered it or when. Finding out meant the audit
//      page, which pulls the last 200 rows across ALL tables — a day or two
//      of history — with no search. §7.5.3 says a controlled document
//      carries that.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

let ACCEPT = true, DIALOGS = [];

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', async (d) => { DIALOGS.push(d.message()); await (ACCEPT ? d.accept() : d.dismiss()).catch(() => {}); });
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
    window.__iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
  });

  console.log('\n5.7 a save does not quietly overwrite somebody else’s');
  {
    const r = await page.evaluate(() => {
      const seen = [];
      // the server answers as PostgREST does: a PATCH whose filter matches
      // nothing returns 200 and []
      window.fetch = function (u, o) {
        seen.push(String(u));
        const url = String(u);
        const wantTs = (url.match(/[?&]ts=eq\.([^&]+)/) || [])[1];
        const serverTs = '2026-09-20T10:00:00Z';
        const matched = !wantTs || decodeURIComponent(wantTs) === serverTs;
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(matched ? [{ id: 'n1', ts: '2026-09-20T11:00:00Z' }] : []),
          text: () => Promise.resolve('[]'),
        });
      };
      _rowVer = {};
      // the row as the server last gave it to us
      _sbMergePull('ncr', [{ id: 'n1', num: 'NCR-1', d: 'x', ts: '2026-09-20T10:00:00Z' }], {});
      return { version: _verOf('ncr', 'n1'), seen: seen };
    });
    check('a pull records the version the server gave us', r.version === '2026-09-20T10:00:00Z', r.version);

    // What this caught the first time it ran: the guard column came from
    // _sbTsCol, which is an ORDERING map — and `ncr`, the table the whole
    // item is about, is not in it. So it fell back to created_at, which a
    // save never moves: the condition matched for ever and the guard was
    // decoration on exactly the record an auditor reads.
    const col = await page.evaluate(() => ({ col: _verCol(), listed: !!_sbTsCol['ncr'] }));
    check('the guard column is one that a save actually moves', col.col === 'ts', col);
    check('...including for a table the ordering map never listed, like ncr', col.listed === false && col.col === 'ts', col);

    const ok = await page.evaluate(() => {
      const seen = [];
      window.fetch = function (u) {
        seen.push(String(u));
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'n1', ts: '2026-09-20T11:00:00Z' }]), text: () => Promise.resolve('') });
      };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n1', d: 'y', ts: '2026-09-20T11:00:00Z' } })
        .then(function () { return { seen: seen, newVer: _verOf('ncr', 'n1') }; });
    });
    check('the PATCH carries that version as a condition', /ts=eq\./.test(ok.seen[0] || ''), ok.seen);
    check('...and a save that lands moves the recorded version forward', ok.newVer === '2026-09-20T11:00:00Z', ok.newVer);

    const conflict = await page.evaluate(() => {
      _verSet('ncr', 'n2', '2026-09-20T08:00:00Z');       // what WE last saw
      window.fetch = function () {
        // the server row has since moved on, so nothing matches the filter
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') });
      };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n2', d: 'mine' } })
        .then(function () { return { threw: false }; },
              function (e) { return { threw: true, conflict: !!e.conflict, zero: !!e.zeroRows, body: e.body }; });
    });
    check('a row that changed under us is a conflict, not a success', conflict.threw && conflict.conflict, conflict);
    check('...and the message says what happened, not «no permission»', /שונתה במקום אחר/.test(conflict.body || '') && !/הרשאה/.test(conflict.body || ''), conflict.body);

    const unversioned = await page.evaluate(() => {
      _verSet('ncr', 'n3', null);                          // never pulled: created offline
      const seen = [];
      window.fetch = function (u) {
        seen.push(String(u));
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'n3' }]), text: () => Promise.resolve('') });
      };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n3', d: 'x' } }).then(function () { return seen; });
    });
    check('a row we have never pulled is sent unguarded, exactly as before', !/ts=eq\./.test(unversioned[0] || ''), unversioned);

    const noUpsert = await page.evaluate(() => {
      _verSet('ncr', 'n4', '2026-09-20T08:00:00Z');
      const seen = [];
      window.fetch = function (u, o) {
        seen.push({ m: (o && o.method) || 'GET' });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') });
      };
      // tries>=3 normally turns an update into an upsert; a conflict must not
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n4', d: 'x' }, tries: 5, conflict: true })
        .then(function () { return { seen: seen, ok: true }; }, function () { return { seen: seen, ok: false }; });
    });
    check('a conflict is never resolved by the upsert fallback — that is the silent overwrite', noUpsert.seen[0] && noUpsert.seen[0].m === 'PATCH', noUpsert);

    // the person decides, not whoever pressed save last
    DIALOGS = []; ACCEPT = true;
    const keepMine = await page.evaluate(() => {
      const q = [{ op: 'upd', tbl: 'ncr', row: { id: 'n5', num: 'NCR-55', d: 'שלי' }, conflict: true, tries: 2 }];
      _obSet(q);
      _verSet('ncr', 'n5', '2026-09-20T08:00:00Z');
      window._obDrain = function () { window.__drained = true; return Promise.resolve(); };
      window.__drained = false;
      syncDiag();
      return { ver: _verOf('ncr', 'n5'), queued: _obGet().length, conflict: (_obGet()[0] || {}).conflict, drained: window.__drained };
    });
    check('the conflict gets its own question, naming the record', /NCR-55/.test(DIALOGS.join('|')), DIALOGS);
    check('...and says the save did NOT happen, rather than implying it did', /לא בוצעה/.test(DIALOGS.join('|')), DIALOGS);
    check('choosing «keep mine» drops the guard and retries', keepMine.ver === null && keepMine.conflict === false && keepMine.drained, keepMine);

    DIALOGS = []; ACCEPT = false;
    const discard = await page.evaluate(() => {
      _obSet([{ op: 'upd', tbl: 'ncr', row: { id: 'n6', num: 'NCR-66', d: 'שלי' }, conflict: true }]);
      window.sbSync = function () { window.__resynced = true; };
      window.__resynced = false;
      window.__toasts = [];
      syncDiag();
      return { queued: _obGet().length, resynced: window.__resynced, toasts: window.__toasts };
    });
    check('choosing the other way throws MY edit away, not theirs', discard.queued === 0, discard);
    check('...and pulls the server copy so the screen stops lying', discard.resynced, discard);
    check('...and says so', /בוטלה/.test(discard.toasts.join('|')), discard.toasts);
    await page.evaluate(() => { _obSet([]); _rowVer = {}; });
  }

  console.log('\n3.11 the record says who touched it');
  {
    const r = await page.evaluate(() => {
      ['ncr', 'ppe', 'ctr', 'tr', 'audit_log'].forEach((t) => { DB[t] = []; });
      DB.ppe = [{ id: 'p1', ty: 'אחר', w: 'דני', e: '2027-01-01', c: 'תקין', ts: '2026-09-18T07:00:00Z' }];
      DB.audit_log = [
        { id: 'a1', table_name: 'ppe', record_id: 'p1', op: 'INSERT', user_email: 'dani@tfugen.local', ts: '2026-09-10T06:00:00Z' },
        { id: 'a2', table_name: 'ppe', record_id: 'p1', op: 'UPDATE', user_email: 'admin@tfugen.local', ts: '2026-09-18T07:00:00Z' },
        { id: 'a3', table_name: 'ncr', record_id: 'x', op: 'UPDATE', user_email: 'other@tfugen.local', ts: '2026-09-19T07:00:00Z' },
      ];
      showView('ppe', 'p1');
      const box = g('view-stamp');
      return { has: !!box, text: box ? box.textContent : '', rows: _auditFor('ppe', 'p1').map((a) => a.id) };
    });
    check('the record carries a stamp', r.has, r);
    check('...naming who changed it last', /admin/.test(r.text), r.text);
    check('...and who created it', /נוצר/.test(r.text) && /dani/.test(r.text), r.text);
    check('...with how many changes there were', /2 שינויים/.test(r.text), r.text);
    check('another record’s history is not mixed in', r.rows.join() === 'a2,a1', r.rows);

    const aged = await page.evaluate(() => {
      DB.audit_log = [];                      // the log has aged out of the device
      showView('ppe', 'p1');
      const box = g('view-stamp');
      return { has: !!box, text: box ? box.textContent : '' };
    });
    check('a record whose history has aged out still shows its own timestamp', aged.has && /עודכן/.test(aged.text), aged);
    check('...without inventing a name for it', !/admin|dani/.test(aged.text), aged.text);

    const nothing = await page.evaluate(() => {
      DB.ppe = [{ id: 'p2', ty: 'אחר', w: 'x' }];   // no ts, no audit rows
      DB.audit_log = [];
      showView('ppe', 'p2');
      return !!g('view-stamp');
    });
    check('with nothing to say, it says nothing rather than «?»', !nothing, nothing);

    const ncr = await page.evaluate(() => {
      DB.ncr = [{ id: 'n9', num: 'NCR-9', d: 'x', s: 'סגור', cd: '2026-09-01', ts: '2026-09-02T07:00:00Z' }];
      DB.audit_log = [{ id: 'b1', table_name: 'ncr', record_id: 'n9', op: 'UPDATE', user_email: 'admin@tfugen.local', ts: '2026-09-02T07:00:00Z' }];
      showView('ncr', 'n9');
      return !!g('view-stamp');
    });
    check('it is on every record type, not just the registers', ncr, ncr);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
