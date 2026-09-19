// What happens when the device's localStorage is full. It used to be the only
// failure in the app with no user-visible signal at all:
//   * _obSet swallowed QuotaExceededError, so _obPush wrote to a copy that was
//     never persisted — the op simply ceased to exist
//   * the sync pill counted _obGet().length, so it read "0 pending"
//   * _sdbFlush caught the same error and wrote {} over tfgn2 — throwing away
//     the entire local mirror, so the next ldb() loaded an empty app
// The user saw "נשמר ✓" and the row in the list, and nothing had been kept.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const alerts = [];
  page.on('dialog', (d) => { alerts.push(d.message()); d.dismiss().catch(() => {}); });
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // Make every localStorage write throw exactly what a full device throws,
  // for the outbox key only — so _obGet still works and we isolate the write.
  const jam = (keys) => page.evaluate((keys) => {
    const real = Storage.prototype.setItem;
    window.__realSetItem = real;
    Storage.prototype.setItem = function (k, v) {
      if (keys.indexOf(k) >= 0) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      return real.call(this, k, v);
    };
  }, keys);
  const unjam = () => page.evaluate(() => { if (window.__realSetItem) Storage.prototype.setItem = window.__realSetItem; });

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    SB_ON = false;                       // keep the drain from firing
    localStorage.removeItem('tfgn_outbox');
    _obMem.length = 0; _obFull = false; _obWarnFull._shown = false;
    _applyRoleGates(); goPage('dash');
  });

  console.log('\n1. a save that cannot be persisted is not silently dropped');
  {
    await jam(['tfgn_outbox']);
    const r = await page.evaluate(() => {
      const ok = _obPush({ op: 'ins', tbl: 'ncr', row: { id: 'n1', num: 'NCR-9001', d: 'דיווח בזמן אחסון מלא' } });
      return { returned: ok, onDisk: JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').length, inMem: _obMem.length, full: _obFull };
    });
    await page.waitForTimeout(150);
    check('_obPush reports failure instead of returning quietly', r.returned === false, r);
    check('nothing reached localStorage (the quota really did bite)', r.onDisk === 0, r);
    check('...but the op is held in memory, not thrown away', r.inMem === 1, r);
    check('the user is told, with an alert that names the risk', alerts.length >= 1 && /אחסון/.test(alerts[0]) && /יאבדו/.test(alerts[0]), alerts[0]);
  }

  console.log('\n2. the sync pill stops reading "0 pending"');
  {
    const r = await page.evaluate(() => {
      _obBadge();
      const tx = document.getElementById('sync-pill-txt');
      return { txt: tx ? tx.textContent : null, mem: _obMem.length };
    });
    check('the pill counts the in-memory op too, so it does not read 0', /1/.test(r.txt || ''), r);
  }

  console.log('\n3. a second op is queued too, and the alert does not nag');
  {
    const before = alerts.length;
    const r = await page.evaluate(() => {
      _obPush({ op: 'ins', tbl: 'ncr', row: { id: 'n2', num: 'NCR-9002', d: 'שני' } });
      return { inMem: _obMem.length };
    });
    await page.waitForTimeout(150);
    check('both ops are held', r.inMem === 2, r);
    check('the alert is shown once, not on every save', alerts.length === before, { before: before, now: alerts.length });
  }

  console.log('\n4. when space frees up, the held ops are sent — not lost');
  {
    await unjam();
    const r = await page.evaluate(async () => {
      const sent = [];
      window._obSend = function (op) { sent.push(op.row && op.row.num); return Promise.resolve(); };
      SB_ON = true;
      await _obDrainOps();
      return { sent: sent, inMem: _obMem.length, onDisk: JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').length };
    });
    check('both held ops reached the server', r.sent.sort().join() === 'NCR-9001,NCR-9002', r);
    check('and the memory queue is empty afterwards', r.inMem === 0, r);
    check('nothing was left stranded on disk either', r.onDisk === 0, r);
  }

  console.log('\n5. a held op that FAILS to send stays held');
  {
    await page.evaluate(() => { _obMem.length = 0; localStorage.removeItem('tfgn_outbox'); });
    await jam(['tfgn_outbox']);
    await page.evaluate(() => { _obPush({ op: 'ins', tbl: 'ncr', row: { id: 'n3', num: 'NCR-9003', d: 'שלישי' } }); });
    const r = await page.evaluate(async () => {
      window._obSend = function () { return Promise.reject({ status: 0, body: 'offline' }); };
      SB_ON = true;
      await _obDrainOps();
      return { inMem: _obMem.length, num: _obMem[0] && _obMem[0].row && _obMem[0].row.num, tries: _obMem[0] && _obMem[0].tries };
    });
    check('it is still in memory after a failed send, with tries counted', r.inMem === 1 && r.num === 'NCR-9003' && r.tries === 1, r);
    await unjam();
  }

  console.log('\n6. a full disk no longer wipes the local copy of everything');
  {
    const r = await page.evaluate(() => {
      DB.ncr = [{ id: 'keep1', num: 'NCR-0001', d: 'רשומה שצריכה לשרוד' }];
      _sdbFlush();                                   // writes a good mirror
      const before = JSON.parse(localStorage.getItem('tfgn2') || '{}');
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'tfgn2') { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        return real.call(this, k, v);
      };
      DB.ncr.push({ id: 'keep2', num: 'NCR-0002', d: 'חדשה' });
      _sdbFlush();                                   // this one cannot be written
      Storage.prototype.setItem = real;
      const after = JSON.parse(localStorage.getItem('tfgn2') || '{}');
      return { beforeRows: (before.ncr || []).length, afterRows: (after.ncr || []).length, flagged: window._sdbFull === true };
    });
    check('the previous mirror survives — it is NOT overwritten with {}', r.afterRows === 1 && r.beforeRows === 1, r);
    check('and the app knows it is stale (_sdbFull)', r.flagged, r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
