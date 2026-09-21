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

  const sent = await page.evaluate(() => {
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
    return { seen: seen, called: called, names: names };
  });

  console.log('\n1. the audit actually exercised the save paths');
  {
    check('save functions were found and called (' + sent.names.length + ')', sent.names.length >= 20, sent.names.length);
    check('...and at least a dozen tables were written to (' + Object.keys(sent.seen).length + ')',
      Object.keys(sent.seen).length >= 12, Object.keys(sent.seen));
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
