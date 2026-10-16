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
      window.fetch = function (u, o) {
        // the server row has since moved on, so nothing matches the filter; the check that follows finds it with a newer ts
        if (!(o && o.method)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'n2', ts: '2026-09-20T09:00:00Z' }]) });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') });
      };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n2', d: 'mine', ts: '2026-09-20T08:30:00Z' } })
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
    console.log('\n  15/10/2026: the guard holds after a restart, a pull, weak signal and a live update');
    await page.evaluate(() => { _obSet([]); _rowVer = {}; });
    const pat = () => { window.__seen = []; window.fetch = function (u, o) { window.__seen.push({ u: String(u), m: (o && o.method) || 'GET', pref: (o && o.headers && o.headers.Prefer) || '' }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') }); }; };
    const cold = await page.evaluate((f) => {
      eval(f)();
      _rowVer = {};                                                   // a restart: nothing in memory
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n7', d: 'offline' }, base: '2026-10-15T06:00:00Z' })
        .then(() => ({ seen: window.__seen }), (e) => ({ seen: window.__seen, conflict: !!e.conflict }));
    }, '(' + pat.toString() + ')');
    check('after a restart, a queued edit is still guarded by the version it was made against (op.base)', /ts=eq\.2026-10-15T06%3A00%3A00Z|ts=eq\.2026-10-15T06:00:00Z/.test(cold.seen[0].u) && cold.conflict, cold);
    const pulled = await page.evaluate(() => {
      _rowVer = {}; _verSet('ncr', 'n8', 'v1');
      DB.ncr = [{ id: 'n8', d: 'mine', ts: 'v1' }];
      _obSet([{ op: 'upd', tbl: 'ncr', row: { id: 'n8', d: 'mine' }, base: 'v1', oid: 'o8' }]);
      _sbMergePull('ncr', [{ id: 'n8', d: 'theirs', ts: 'v2' }, { id: 'n9', d: 'x', ts: 'v5' }]);
      return { n8: _verOf('ncr', 'n8'), n9: _verOf('ncr', 'n9'), shown: DB.ncr.find((r) => r.id === 'n8').d };
    });
    check('a pull does not move the version of a row whose edit is still queued (it did, and the PATCH then overwrote)', pulled.n8 === 'v1' && pulled.n9 === 'v5' && pulled.shown === 'mine', pulled);
    const weak = await page.evaluate((f) => {
      eval(f)();
      _rowVer = {};
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'n10', d: 'x' }, base: 'v1', tries: 9, zeroTries: 0 }).then(() => window.__seen, () => window.__seen);
    }, '(' + pat.toString() + ')');
    check('nine failed tries (weak signal) on a guarded edit: still a guarded PATCH, never an upsert', weak[0].m === 'PATCH' && /ts=eq\.v1/.test(weak[0].u) && !/merge-duplicates/.test(weak[0].pref), weak);
    const blip = await page.evaluate(() => {
      _obSet([{ op: 'upd', tbl: 'ncr', row: { id: 'n11', d: 'x' }, base: 'v1', conflict: true, tries: 4, oid: 'o11' }]);
      window.fetch = function () { return Promise.reject(new TypeError('Failed to fetch')); };
      SB_ON = true; _obBusy = false;
      return _obDrainOps().then(() => { const op = _obGet()[0]; return { conflict: op && op.conflict, zero: op && op.zeroTries }; });
    });
    check('a network error after a conflict keeps it a conflict (it used to clear it, and the next send overwrote)', blip.conflict === true && !blip.zero, blip);
    const live = await page.evaluate(() => {
      _rowVer = {}; DB.ncr = [{ id: 'n12', d: 'mine' }, { id: 'n13', d: 'old' }];
      _obSet([{ op: 'upd', tbl: 'ncr', row: { id: 'n12', d: 'mine' }, base: 'v1', oid: 'o12' }]);
      _rtApply('ncr', { eventType: 'UPDATE', new: { id: 'n12', d: 'theirs', ts: 'v9' } });
      _rtApply('ncr', { eventType: 'UPDATE', new: { id: 'n13', d: 'new', ts: 'v7' } });
      return { n12: DB.ncr.find((r) => r.id === 'n12').d, v12: _verOf('ncr', 'n12'), n13: DB.ncr.find((r) => r.id === 'n13').d, v13: _verOf('ncr', 'n13') };
    });
    check('a live update leaves a row with a queued edit alone, and records the version of the others', live.n12 === 'mine' && live.v12 === null && live.n13 === 'new' && live.v13 === 'v7', live);
    const force = await page.evaluate(() => {
      _obSet([{ op: 'upd', tbl: 'ncr', row: { id: 'n14' }, base: 'v1', conflict: true, oid: 'o14' }]);
      window._obDrain = function () { return Promise.resolve(); };
      _verForce('ncr', 'n14');
      return 'base' in _obGet()[0];
    });
    check('«keep mine» drops the stored base too, or the retry would hit the same conflict', force === false, force);
    const zero = await page.evaluate(() => {
      const mk = (row) => function (u, o) {
        if (!(o && o.method)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(row ? [row] : []) });
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') });
      };
      _rowVer = {}; _verSet('ncr', 'z1', 'v1'); _verSet('ncr', 'z2', 'v1');
      window.fetch = mk({ id: 'z1', ts: '2026-10-15T08:00:00.000Z' });
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'z1', d: 'x', ts: '2026-10-15T08:00:00Z' } }).then(() => ({ own: 'done', v: _verOf('ncr', 'z1') }), (e) => ({ own: 'err ' + e.body })).then((a) => {
        window.fetch = mk(null);
        return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'z2', d: 'x', ts: '2026-10-15T08:00:00Z' } }).then(() => ({ ...a, gone: 'done' }), (e) => ({ ...a, gone: !!e.gone, conflict: !!e.conflict, body: e.body }));
      });
    });
    check('0 rows, but the server row carries our own ts: our earlier send landed (lost answer) -> done, not a conflict', zero.own === 'done' && zero.v === '2026-10-15T08:00:00.000Z', zero);
    check('0 rows and the row is gone: "deleted elsewhere", the person decides (no automatic upsert)', zero.gone === true && zero.conflict && /נמחקה/.test(zero.body || ''), zero);
    const noAuto = await page.evaluate(() => {
      const seen = []; _rowVer = {};
      window.fetch = (u, o) => { seen.push((o && o.method) || 'GET'); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') }); };
      return _obSend({ op: 'upd', tbl: 'ncr', row: { id: 'z3' }, zeroTries: 9, gone: true }).then(() => seen, () => seen);
    });
    check('...a row known to be gone is never upserted back by itself, whatever the tries', noAuto[0] === 'PATCH', noAuto);
    await page.evaluate(() => { _obSet([]); _rowVer = {}; });
  }

  console.log('\n  16/10/2026 (A8, BACKLOG 14.2): the version is the one the form was OPENED at');
  {
    // A form open on the phone while the PC saved the same record. The pull moved _verOf to the
    // PC's version, and the guard used to be taken at save time, so the phone's save matched it
    // and overwrote the PC's change in silence.
    const V1 = '2026-10-16T06:00:00.000Z', V2 = '2026-10-16T06:05:00.000Z';
    const run = (pull, pendingFirst) => page.evaluate(([V1, V2, pull, pendingFirst]) => {
      window.__realDrain = window.__realDrain || window._obDrain; window._obDrain = function () {};
      _obSet([]); _rowVer = {};
      DB.near_miss = []; _sbMergePull('near_miss', [{ id: 'dA', d: '2026-10-15', descr: 'כבל על הרצפה', s: 'פתוח', ts: V1 }], {});
      DB.near_miss = [{ id: 'dA', d: '2026-10-15', descr: 'כבל על הרצפה', s: 'פתוח', ts: V1 }];
      if (pendingFirst) _obPush({ op: 'upd', tbl: 'near_miss', row: { id: 'dA', s: 'פתוח' } });
      _genEdit('near_miss', 'dA');
      if (pull) _sbMergePull('near_miss', [{ id: 'dA', d: '2026-10-15', descr: 'כבל - מהמחשב', s: 'בטיפול', ts: V2 }], {});
      document.getElementById('nm-desc').value = 'כבל - מהטלפון';
      svNm();
      const op = _obGet().filter(o => o.tbl === 'near_miss' && o.op === 'upd').slice(-1)[0] || {};
      const seen = [];
      window.fetch = function (u, o) {
        seen.push(String(u));
        if (!(o && o.method)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'dA', ts: pull ? V2 : V1 }]) });
        const want = decodeURIComponent((String(u).match(/[?&]ts=eq\.([^&]+)/) || [])[1] || '');
        const cur = pull ? V2 : V1;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(!want || want === cur ? [{ id: 'dA', ts: '2026-10-16T06:10:00.000Z' }] : []), text: () => Promise.resolve('[]') });
      };
      return _obSend(op).then(() => ({ pin: op.pin || null, conflict: false, seen }), (e) => ({ pin: op.pin || null, conflict: !!e.conflict, seen }))
        .then((x) => { window._obDrain = window.__realDrain; _obSet([]); return x; });
    }, [V1, V2, pull, pendingFirst]);

    const a8 = await run(true, false);
    check('the edit carries the version the form was opened at', a8.pin === V1, a8);
    check('a change saved elsewhere while the form was open is a conflict, not a silent overwrite', a8.conflict === true && /ts=eq\./.test(a8.seen[0] || ''), a8);
    // Broken on purpose (16/10/2026): with _obSend back to _verOf first, this check fails (conflict:false).
    // Caught on the first run: the OneDrive hook wraps sbUpd(tbl,row) and dropped the pin (pin:null).
    const calm = await run(false, false);
    check('...and with nothing changed elsewhere the same save lands', calm.pin === V1 && calm.conflict === false, calm);
    const own = await run(false, true);
    check('an edit of ours still waiting is not pinned (it would conflict with itself)', own.pin === null, own);

    const ncr = await page.evaluate(([V1, V2]) => {
      window._obDrain = function () {};
      _obSet([]); _rowVer = {};
      DB.ncr = [{ id: 'nA', num: 'NCR-9', d: 'שמן ברצפה', a: 'בטיחות', s: 'פתוח', p: 'בינונית', ts: V1 }];
      _sbMergePull('ncr', [DB.ncr[0]], {});
      editNcr('nA');
      _sbMergePull('ncr', [Object.assign({}, DB.ncr[0], { d: 'מהמחשב', ts: V2 })], {});
      svNcr();
      const op = _obGet().filter(o => o.tbl === 'ncr' && o.op === 'upd').slice(-1)[0] || {};
      window._verForce('ncr', 'nA');
      const after = _obGet().filter(o => o.tbl === 'ncr' && o.op === 'upd').slice(-1)[0] || {};
      window._obDrain = window.__realDrain; _obSet([]); _rowVer = {};
      return { pin: op.pin || null, after: after.pin || null };
    }, [V1, V2]);
    check('the NCR editor pins the version it opened', ncr.pin === V1, ncr);
    check('«keep mine» drops the pin, or the retry would be refused for ever', ncr.after === null, ncr);

    // The custom editors (16/10/2026, BACKLOG 14.2 part 2): each opens with _editPin and saves with
    // _editPinTake, so a form open on the phone does not overwrite a change the PC saved meanwhile.
    const ED = [
      ['inc', 'editInc', 'svInc', { d: 'נפילה במדרגות', dt: '2026-10-15T08:00:00.000Z', ty: 'כמעט תאונה', sv: 'קל', l: 'מחסן', s: 'פתוח', r: 'בדיקה' }],
      ['leg', 'editLeg', 'svLeg', { law_num: '1', topic: 'חוק', s: 'בתוקף' }],
      ['equip_inspections', 'eqiEdit', 'svEqi', { n: 'מלגזה', code: 'M1', d: '2026-01-01', e: '2027-01-01', s: 'תקין' }],
      ['tasks', 'editTsk', 'svTsk', { title: 'לבדוק מטף', assignee: 'דני', due: '2026-11-01', s: 'open' }],
      ['env_aspects', 'editEasp', 'svEasp', { activity: 'שטיפה', aspect: 'שפכים', impact: 'זיהום', s: 'פעיל' }],
      ['locations', 'editLoc', 'svLoc', { name: 'מחסן א', level: 1 }],
      ['inspection_types', 'editItp', 'svItp', { name: 'מלגזה', recur_count: 6, recur_unit: 'month' }],
      ['issue_types', 'editItype', 'svItype', { name: 'חשמל', level: 1 }],
      ['projects', 'editPrj', 'svPrj', { name: 'שיפוץ' }],
      ['app_users', 'editUser', 'svUser', { username: 'dani', role: 'viewer', full_name: 'דני כהן' }],
    ];
    const eds = await page.evaluate(async ([V1, V2, ED]) => {
      window._obDrain = function () {};
      const out = {};
      for (const [t, open, save, f] of ED) {
        _obSet([]); _rowVer = {}; window.__toasts = [];
        const row = Object.assign({ id: 'e-' + t, ts: V1 }, f);
        DB[t] = [Object.assign({}, row)];
        _sbMergePull(t, [Object.assign({}, row)], {});
        try { window[open]('e-' + t); } catch (e) { out[t] = 'open: ' + e.message; continue; }
        await new Promise((r) => setTimeout(r, 30)); // eqiEdit fills the form in a setTimeout
        _sbMergePull(t, [Object.assign({}, row, { ts: V2 })], {});
        try { window[save](); } catch (e) { out[t] = 'save: ' + e.message; continue; }
        const op = _obGet().filter(o => o.tbl === t && o.op === 'upd').slice(-1)[0];
        out[t] = op ? (op.pin || null) : ('no op: ' + window.__toasts.join(' | '));
      }
      window._obDrain = window.__realDrain; _obSet([]); _rowVer = {};
      return out;
    }, [V1, V2, ED]);
    ED.forEach(([t]) => check('the ' + t + ' editor saves against the version it opened', eds[t] === V1, eds[t]));

    // ptw (16/10/2026): `ts` there is the permit's start time ("08:00"), so the guard is on `ver`.
    const ptw = await page.evaluate(([V1, V2]) => {
      window._obDrain = function () {};
      _obSet([]); _rowVer = {};
      const row = { id: 'pA', num: 'PTW-1', con: 'קבלן', ts: '08:00', te: '12:00', s: 'פעיל', ver: V1 };
      DB.ptw = [Object.assign({}, row)];
      _sbMergePull('ptw', [Object.assign({}, row)], {});
      _genEdit('ptw', 'pA');
      _sbMergePull('ptw', [Object.assign({}, row, { con: 'מהמחשב', ver: V2 })], {});
      svPtw();
      const op = _obGet().filter(o => o.tbl === 'ptw' && o.op === 'upd').slice(-1)[0] || {};
      let url = '';
      window.fetch = function (u, o) { if (o && o.method === 'PATCH') url = String(u); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') }); };
      return _obSend(op).then(() => 0, () => 0).then(() => { window._obDrain = window.__realDrain; _obSet([]); _rowVer = {}; return { pin: op.pin || null, url }; });
    }, [V1, V2]);
    check('ptw guards on ver, the version the permit form opened at', ptw.pin === V1 && /[?&]ver=eq\./.test(ptw.url) && !/[?&]ts=eq\./.test(ptw.url), ptw);
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
