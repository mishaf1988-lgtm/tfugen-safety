// notifications_log is append-only — one row per notification ever sent, and
// it never stops growing. Two things followed from that, both found by the
// wiring sweep on 2026-09-20:
//
//   * sbSync pulled the WHOLE table on every sync (on focus, and every ten
//     minutes) to render twenty lines on a settings panel. On the factory's
//     wifi, a year of history downloaded to show one screen.
//   * the "🗑 נקה יומן מקומי" button emptied DB.notifications_log and called
//     sdb() — but that table is in _SDB_SKIP, so nothing was written, and
//     nothing was deleted server-side either. The next sync, under a minute
//     later, pulled it all back. It looked like a delete and lasted seconds.
//
// The list is a recent window now, and the CSV export — which is the evidence
// that notifications went out — asks the server for the whole log at the
// moment it is clicked, so nothing exportable got smaller.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
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
    window.__urls = [];
    window._sbAuth = function () { return Promise.resolve(); };
    window.sbH = function () { return {}; };
    // 2,000 rows on the server: about four years of a working notification setup
    window.__server = Array.from({ length: 2000 }, (_, i) => ({
      id: 'l' + i,
      ts: new Date(Date.now() - i * 36e5).toISOString(),
      user_email: 'admin@tfugen.local',
      event_type: i % 2 ? 'task_overdue' : 'expiry_30days',
      channel: 'email',
      payload: { title: 'התראה ' + i },
    }));
    // Stand in for the network. Since #657 sbGet pages with a Range header
    // instead of ?limit=, exactly as PostgREST expects and as the nightly
    // worker has always done \u2014 so the cap is now a range, not a query param.
    window.fetch = function (u, o) {
      window.__urls.push(String(u));
      window.__ranges = window.__ranges || [];
      const range = (o && o.headers && o.headers.Range) || '';
      window.__ranges.push(range);
      const m = range.match(/^(\d+)-(\d+)$/);
      const qm = String(u).match(/[?&]limit=(\d+)/);
      let rows;
      if (m) rows = window.__server.slice(+m[1], +m[2] + 1);
      else if (qm) rows = window.__server.slice(0, Number(qm[1]));
      else rows = window.__server;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rows), text: () => Promise.resolve('') });
    };
    // catch the download instead of performing it
    window.__csv = null;
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) { window.__csvBlob = blob; return realCreate(blob); };
    HTMLAnchorElement.prototype.click = function () { window.__csv = this.download; };
  });

  console.log('\n1. the routine sync asks for a window, not the whole history');
  {
    const r = await page.evaluate(() => {
      window.__urls = []; window.__ranges = [];
      return sbGet('notifications_log').then((rows) => ({
        url: window.__urls[0], ranges: window.__ranges, got: rows.length, cap: _sbLimit.notifications_log,
      }));
    });
    check('the request asks for a bounded range', /^\d+-\d+$/.test(r.ranges[0] || ''), r.ranges);
    check('it is the configured cap, not an arbitrary number', r.ranges[0] === '0-' + (r.cap - 1), { ranges: r.ranges, cap: r.cap });
    check('...and one request is enough for it', r.ranges.length === 1, r.ranges);
    check('so 500 rows come back instead of 2,000', r.got === 500, r.got);
  }

  console.log('\n2. no business table was capped by mistake');
  {
    const r = await page.evaluate(() => {
      const out = {};
      const tbls = ['ncr', 'tasks', 'equip_inspections', 'trustee_reports', 'ppe', 'emp', 'app_users'];
      return Promise.all(tbls.map((t) => {
        window.__urls = [];
        window.__ranges = [];
        return sbGet(t).then(() => { out[t] = /[?&]limit=/.test(window.__urls[0]) || /^0-499$/.test(window.__ranges[0] || ''); });
      })).then(() => ({ capped: Object.keys(out).filter((k) => out[k]), limits: Object.keys(_sbLimit) }));
    });
    check('no business table asks for a limit — hiding an old NCR would be data loss', r.capped.length === 0, r.capped);
    check('exactly one table is capped, and it is the append-only log', r.limits.join() === 'notifications_log', r.limits);
  }

  console.log('\n3. the CSV export is still the whole log');
  {
    const r = await page.evaluate(() => {
      DB.notifications_log = window.__server.slice(0, 500);   // what the device holds
      window.__urls = []; window.__toasts = []; window.__csv = null; window.__csvBlob = null;
      _notifLogExport();
      return new Promise((res) => setTimeout(() => window.__csvBlob.text().then((txt) => res({
        url: window.__urls[0],
        lines: txt.trim().split('\n').length,
        file: window.__csv,
        toasts: window.__toasts,
        hasOldest: txt.indexOf('התראה 1999') > 0,
        hasNewest: txt.indexOf('התראה 0') > 0,
      })), 300));
    });
    check('it goes to the server rather than reading the device copy', /rest\/v1\/notifications_log/.test(r.url), r.url);
    check('...and asks for no limit at all', !/[?&]limit=/.test(r.url), r.url);
    check('all 2,000 rows are in the file, plus the header', r.lines === 2001, r.lines);
    check('the oldest entry is there — the one the device no longer holds', r.hasOldest, r.hasOldest);
    check('and the newest', r.hasNewest, r.hasNewest);
    check('the toast says how many rows were exported', r.toasts.some((t) => /2000/.test(t)), r.toasts);
  }

  console.log('\n4. offline, it exports what it has and says so');
  {
    const r = await page.evaluate(() => {
      DB.notifications_log = window.__server.slice(0, 500);
      window.fetch = function () { return Promise.reject(new Error('offline')); };
      window.__toasts = []; window.__csvBlob = null;
      _notifLogExport();
      return new Promise((res) => setTimeout(() => window.__csvBlob.text().then((txt) => res({
        lines: txt.trim().split('\n').length,
        toasts: window.__toasts,
      })), 300));
    });
    check('a file is still produced', r.lines === 501, r.lines);
    check('and the toast says it is the device copy only, not the whole log', r.toasts.some((t) => /אין רשת/.test(t)), r.toasts);
  }

  console.log('\n5. the button that pretended to delete is gone');
  {
    const r = await page.evaluate(() => ({
      fn: typeof window._notifLogClear,
      btn: [...document.querySelectorAll('button')].filter((b) => /_notifLogClear/.test(b.getAttribute('onclick') || '')).length,
      csvBtn: [...document.querySelectorAll('button')].filter((b) => /_notifLogExport/.test(b.getAttribute('onclick') || '')).length,
    }));
    check('the function no longer exists', r.fn === 'undefined', r.fn);
    check('no button calls it', r.btn === 0, r.btn);
    check('the CSV export button is still there — that one does something', r.csvBtn === 1, r.csvBtn);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
