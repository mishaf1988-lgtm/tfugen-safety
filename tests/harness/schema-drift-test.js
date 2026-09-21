// Does every field the app SAVES actually exist in the database?
//
// When it does not, nothing errors. PostgREST answers PGRST204, _obSend drops
// that one key and resends, the row saves without it, and since #654 a toast
// says so once. On a phone, once, in Hebrew, while you are typing the next
// record. That is how `near_miss.ncr_id` — the link from a near-miss to the
// NCR opened from it, written by #662 — never reached the server at all, and
// nobody noticed for a week.
//
// Nothing could catch that class before: the harness runs against a stubbed
// sbIns/sbUpd and has no idea what the real schema holds. This compares the
// two. schema-snapshot.json is the live catalogue, captured through the
// Supabase connector; the header of that file says how to refresh it.
//
// The fields are captured by RUNNING the save functions, not by reading the
// source — a record literal spread over four lines with conditionals in it is
// exactly where a regex quietly misses a key.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-snapshot.json'), 'utf8'));
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// Columns the app is allowed to send that the table does not have, with the
// reason. Anything not listed here is a finding.
const KNOWN = {
  // `hist` is the local activity log — addLog() pushes to DB.hist and it is in
  // the localStorage snapshot, but nothing syncs it. Not a drift.
};

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept('2026-01-01').catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const sent = await page.evaluate(async () => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    try { _applyRoleGates(); } catch (e) {}
    window.sdb = function () {}; window.addLog = function () {};
    window.toast = function () {}; window.alert = function () {};
    window.rDash = function () {};
    const seen = {};
    const note = (t, r) => {
      if (!t || !r || typeof r !== 'object') return;
      seen[t] = seen[t] || {};
      Object.keys(r).forEach((k) => { seen[t][k] = 1; });
    };
    window.sbIns = (t, r) => note(t, r);
    window.sbUpd = (t, r) => note(t, r);
    window.sbDel = function () {};

    // sbIns/sbUpd is the form path. The Excel and PDF imports do not use it —
    // they fetch PostgREST directly (_eqiPdfSyncRow, _eqiHistoryWrite). So the
    // capture also sits on fetch, which is where EVERY write ends up whichever
    // helper it came through.
    window._sbToken = 't';
    window._sbAuth = () => Promise.resolve({ access_token: 't' });
    window.fetch = function (u, o) {
      try {
        const m = String(u).match(/\/rest\/v1\/([a-z_]+)/i);
        if (m && o && o.body) {
          const parsed = JSON.parse(o.body);
          (Array.isArray(parsed) ? parsed : [parsed]).forEach((row) => note(m[1], row));
        }
      } catch (e) {}
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ id: 'x' }]), text: () => Promise.resolve('[]') });
    };

    // Fill every field in the document with something plausible for its type,
    // so a save is not refused for a missing required value.
    document.querySelectorAll('input,select,textarea').forEach((el) => {
      try {
        if (el.type === 'checkbox' || el.type === 'radio') { el.checked = true; return; }
        if (el.type === 'date') { el.value = '2026-01-01'; return; }
        if (el.type === 'time') { el.value = '08:30'; return; }
        if (el.type === 'number') { el.value = '1'; return; }
        if (el.tagName === 'SELECT') { if (el.options.length) el.selectedIndex = el.options.length - 1; return; }
        if (el.id && /-id$/.test(el.id)) return;        // leave record-id fields blank => insert
        el.value = 'QA';
      } catch (e) {}
    });

    // Every sv* the page defines, called once. Ones that need a specific state
    // simply save nothing, which costs us nothing.
    const names = Object.getOwnPropertyNames(window).filter((n) => /^sv[A-Z]/.test(n) && typeof window[n] === 'function');
    const called = [];
    names.forEach((n) => {
      try { window[n](); called.push(n); } catch (e) {}
    });

    // The sv* functions are what a person typing into a form reaches. They are
    // NOT the only writers: the Excel and PDF imports build their own record
    // literals, and those are the first thing that runs against real data.
    // Driving a file picker from here is not practical, so the builders are
    // called directly with plausible arguments.
    const bulk = [];
    const eqiItem = {
      internal_number: 'EQ-1', code: 'EQ-1', n: 'מלגזה', inspection_date: '2026-01-01',
      next_inspection_date: '2027-01-01', expiry_date: '2027-01-01', inspector: 'בודק',
      report_number: 'R-1', license_number: 'L-1', serial_number: 'S-1', manufacturer: 'יצרן',
      model: 'דגם', year_of_production: '2020', loc: 'ייצור', vendor: 'ספק',
      inspection_type: 'תקופתית', deficiencies: '', status: 'תקין', notes: '',
      test_pressure: '1', work_pressure: '1', approved_pressure: '1', client_name: 'תפוגן',
      inspector_address: 'כתובת', inspector_phone: '050', inspector_certificate: 'C-1',
      cycle_months: 12,
    };
    const eqiData = Object.assign({}, eqiItem);
    // These are async — they go through _sbAuth().then(fetch). Calling them
    // without awaiting returns before a single write happens, and the audit
    // passes having checked nothing. (It did, until this line.)
    for (const [fn, args] of [
      ['_eqiPdfPersistCreate', [eqiItem, eqiData, 'https://x/y.pdf']],
      ['_eqiHistoryWrite', ['eq-1', eqiItem, eqiData, 'https://x/y.pdf']],
    ]) {
      if (typeof window[fn] !== 'function') continue;
      try { await window[fn].apply(null, args); bulk.push(fn); } catch (e) { bulk.push(fn + '(threw)'); }
    }

    return { seen: seen, called: called, names: names, bulk: bulk };
  });

  console.log('\n1. the audit actually exercised the save paths');
  {
    check('save functions were found and called (' + sent.names.length + ')', sent.names.length >= 20, sent.names.length);
    check('...and at least a dozen tables were written to (' + Object.keys(sent.seen).length + ')',
      Object.keys(sent.seen).length >= 12, Object.keys(sent.seen));
    // The import builders write records a person never types, and they are the
    // first code that meets real data. A run that skipped them proves less
    // than it looks.
    check('the bulk import builders were exercised too (' + sent.bulk.join(', ') + ')',
      sent.bulk.length >= 1, sent.bulk);
  }

  console.log('\n2. every table the app writes to exists');
  {
    const missing = Object.keys(sent.seen).filter((t) => !SNAP.tables[t]);
    check('no save targets a table that is not in the database', missing.length === 0, missing);
  }

  console.log('\n3. every field the app writes exists on its table');
  {
    const drift = [];
    Object.keys(sent.seen).forEach((t) => {
      const cols = SNAP.tables[t];
      if (!cols) return;                       // reported by section 2
      Object.keys(sent.seen[t]).forEach((k) => {
        if (cols.indexOf(k) >= 0) return;
        if ((KNOWN[t] || []).indexOf(k) >= 0) return;
        drift.push(t + '.' + k);
      });
    });
    check('no field is silently dropped on save', drift.length === 0, drift);
  }

  console.log('\n4. the tables the app syncs all exist');
  {
    // A table in the sync list that does not exist means every pull for it
    // 404s and every push is discarded — the feature is simply absent, with
    // no error the user ever sees.
    const lists = await page.evaluate(() => ({
      backup: (typeof _BACKUP_TABLES !== 'undefined') ? _BACKUP_TABLES : [],
      db: Object.keys(DB || {}),
    }));
    const badBackup = lists.backup.filter((t) => !SNAP.tables[t]);
    check('every table in the backup list exists', badBackup.length === 0, badBackup);
    const badDb = lists.db.filter((t) => !SNAP.tables[t] && t !== 'hist');
    check('every table the app keeps locally exists in the database (hist is local by design)', badDb.length === 0, badDb);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
