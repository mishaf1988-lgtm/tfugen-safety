// The net for "a button with nothing behind it".
//
// Twice on 2026-09-20 a feature turned out to be dead: the equipment-PDF
// import and Smart Capture's photo path had both been broken for months by a
// change somewhere underneath them, and nothing said so — the buttons were
// still there, they just did nothing useful. Both were found by hand.
//
// This suite is the sweep that finds the next one by itself. It makes no
// judgement about what a feature SHOULD do; it only asserts that every wire in
// the app is connected to something:
//
//   1. every function named by an inline handler in the markup exists
//   2. every modal opens and closes
//   3. every save button actually produces a row
//   4. no file input points at a handler that is gone
//
// When a saver legitimately refuses (an editor with nothing to edit, a form
// that needs more than typed text), that is asserted as a REFUSAL WITH A
// REASON, not quietly excused.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 140)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _isAdmin = true;
    _applyRoleGates();
    window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = [];
    window.toast = function (m) { window.__toasts.push(String(m)); };
  });

  console.log('\n1. every handler in the markup names a function that exists');
  {
    const r = await page.evaluate(() => {
      const names = new Set();
      const where = {};
      document.querySelectorAll('*').forEach((el) => {
        ['onclick', 'onchange', 'oninput', 'onsubmit', 'onload'].forEach((a) => {
          const v = el.getAttribute && el.getAttribute(a);
          if (!v) return;
          (v.match(/(?:^|[;{}\s(])([A-Za-z_$][\w$]*)\s*\(/g) || []).forEach((m) => {
            const n = m.replace(/[^A-Za-z_$\w]/g, '');
            names.add(n);
            if (!where[n]) where[n] = (el.id || el.tagName) + '@' + a;
          });
        });
      });
      // language keywords and browser globals a handler may legitimately call
      const KNOWN = new Set(['if', 'for', 'while', 'return', 'function', 'typeof', 'catch', 'switch',
        'setTimeout', 'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat', 'String', 'Number',
        'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'encodeURIComponent',
        'decodeURIComponent', 'event', 'this']);
      const missing = [...names].filter((n) => !KNOWN.has(n) && typeof window[n] !== 'function');
      return { checked: names.size, missing: missing.map((n) => n + ' (' + where[n] + ')').sort() };
    });
    check('the markup wires up a real number of handlers (' + r.checked + ')', r.checked > 150, r.checked);
    check('none of them names a function that does not exist', r.missing.length === 0, r.missing);
  }

  console.log('\n2. every file input has a live handler');
  {
    const r = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('input[type=file]').forEach((el) => {
        const v = el.getAttribute('onchange');
        if (!v) return;                       // handlers assigned in JS are fine
        const m = v.match(/([A-Za-z_$][\w$]*)\s*\(/);
        if (m && typeof window[m[1]] !== 'function') bad.push(el.id + ' -> ' + m[1]);
      });
      return bad;
    });
    check('no file input points at a handler that is gone', r.length === 0, r);
  }

  console.log('\n3. every modal opens and closes');
  {
    const r = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id^=m-]')].map((x) => x.id);
      const stuckClosed = [], threw = [], stuckOpen = [];
      ids.forEach((m) => {
        try {
          openModal(m);
          if (getComputedStyle(document.getElementById(m)).display === 'none') stuckClosed.push(m);
          closeModal(m);
          if (getComputedStyle(document.getElementById(m)).display !== 'none') stuckOpen.push(m);
        } catch (e) { threw.push(m + ': ' + e.message.slice(0, 60)); }
      });
      return { total: ids.length, stuckClosed: stuckClosed, threw: threw, stuckOpen: stuckOpen };
    });
    check('all ' + r.total + ' modals open', r.stuckClosed.length === 0 && r.threw.length === 0, { stuckClosed: r.stuckClosed, threw: r.threw });
    check('...and all of them close again', r.stuckOpen.length === 0, r.stuckOpen);
  }

  console.log('\n4. every save button actually saves');
  {
    // A saver that needs more than typed text gets set up the way the APP sets
    // it up, rather than being excused. Only one cannot be: a trustee tour is
    // assembled by ticking tasks in a bespoke UI, and trustee-t2-test.js drives
    // that properly with 36 checks. It is listed with the reason it refuses, so
    // this list cannot quietly grow into cover for a genuinely broken saver.
    const PREPARE = {
      // m-user edits an app_users row that must already exist — the app opens
      // it through editUser(id), which fills the hidden #u-id. Creating a user
      // is a different function (createNewUser / m-newuser).
      svUser: () => {
        DB.app_users = [{ id: 'u1', username: 'u1', full_name: 'ישן', role: 'מדווח', active: true }];
        editUser('u1');
        return 'm-user';
      },
    };
    const EXPECTED_REFUSAL = {
      svTru: 'שם הנאמן הוא שדה חובה',
    };
    await page.evaluate('window.__PREP = { svUser: ' + PREPARE.svUser.toString() + ' }');
    const r = await page.evaluate(({ expected, prepared }) => {
      const map = {};
      document.querySelectorAll('[id^=m-] [onclick]').forEach((el) => {
        const m = (el.getAttribute('onclick') || '').match(/^\s*(sv[A-Z]\w*)\s*\(\s*\)/);
        if (!m) return;
        const host = el.closest('[id^=m-]');
        if (host && !map[m[1]]) map[m[1]] = host.id;
      });
      const saved = [], refused = [], broken = [];
      Object.keys(map).sort().forEach((sv) => {
        const mid = map[sv];
        let ins = 0, upd = 0;
        window.sbIns = function () { ins++; }; window.sbUpd = function () { upd++; };
        window.__toasts = [];
        const before0 = prepared.indexOf(sv) >= 0 ? (window.__PREP[sv](), null) : null;
        const before = Object.keys(DB).map((k) => (DB[k] || []).length).join();
        try {
          if (prepared.indexOf(sv) < 0) openModal(mid);
          // Fill every control with a value its own type accepts. A date input
          // silently rejects free text, which leaves the field empty and makes
          // the saver bail — that reads as a broken feature and is a broken test.
          document.querySelectorAll('#' + mid + ' input,#' + mid + ' select,#' + mid + ' textarea').forEach((el, i) => {
            const t = (el.type || '').toLowerCase();
            if (t === 'checkbox' || t === 'radio') { el.checked = true; return; }
            if (t === 'file' || t === 'hidden') return;
            if (el.tagName === 'SELECT') { if (el.options.length > 1) el.selectedIndex = 1; return; }
            if (t === 'date') el.value = '2026-06-15';
            else if (t === 'number') el.value = String(i + 1);
            else if (t === 'time') el.value = '08:30';
            else el.value = 'בדיקה ' + i;
          });
          window[sv]();
        } catch (e) {
          broken.push({ sv: sv, modal: mid, threw: e.message.slice(0, 80) });
          return;
        }
        const after = Object.keys(DB).map((k) => (DB[k] || []).length).join();
        const wrote = ins + upd > 0 || before !== after;
        if (wrote) { saved.push(sv); return; }
        const why = window.__toasts.join(' | ');
        if (expected[sv] && why.indexOf(expected[sv]) >= 0) refused.push({ sv: sv, why: why });
        else broken.push({ sv: sv, modal: mid, wroteNothing: true, said: why || '(silently)' });
      });
      return { saved: saved, refused: refused, broken: broken, total: Object.keys(map).length };
    }, { expected: EXPECTED_REFUSAL, prepared: Object.keys(PREPARE) });

    check('every save button in the app was driven (' + r.total + ' of them)', r.total >= 25, r.total);
    check('each one either writes a row or refuses out loud — none fails silently', r.broken.length === 0, r.broken);
    check(r.saved.length + ' savers wrote a row from a filled form', r.saved.length >= 27, r.saved.length);
    check('the one saver a typed form cannot reach refuses out loud (trustee-t2-test drives it properly)', r.refused.length === Object.keys(EXPECTED_REFUSAL).length, r.refused);
    check('the user editor, opened the way the app opens it, does write', r.saved.indexOf('svUser') >= 0, r.saved);
  }

  console.log('\n5. every page renders, at production scale, without throwing');
  {
    const r = await page.evaluate(() => {
      const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
      DB.ncr = Array.from({ length: 375 }, (_, i) => ({ id: 'n' + i, num: 'NCR-' + i, d: 'אי-התאמה ' + i, s: i % 3 ? 'פתוח' : 'סגור', cd: i % 3 ? null : iso(-60 - i), o: 'דני', u: iso(i % 60 - 30), sd: iso(-i), ts: new Date(Date.now() - i * 864e5).toISOString() }));
      DB.tasks = Array.from({ length: 120 }, (_, i) => ({ id: 't' + i, title: 'משימה ' + i, status: 'פתוח', due: iso(i % 90 - 30), assignee: 'דני', priority: 'רגיל' }));
      ['ppe', 'tr', 'docs', 'ctr', 'emp', 'med', 'ins', 'drl', 'wst', 'hzm', 'env'].forEach((t) => {
        DB[t] = Array.from({ length: 150 }, (_, i) => ({ id: t + i, n: 'פריט ' + i, ty: 'סוג', w: 'עובד ' + i, o: 'דני', c: 'קבלן', e: iso(i % 120 - 40) }));
      });
      DB.equip_inspections = Array.from({ length: 200 }, (_, i) => ({ id: 'eq' + i, n: 'ציוד ' + i, code: 'C' + i, vendor: 'ספק', e: iso(i % 120 - 40) }));
      const pages = [...document.querySelectorAll('[id^=pg-]')].map((x) => x.id.slice(3));
      const threw = [];
      pages.forEach((pg) => { try { goPage(pg); } catch (e) { threw.push(pg + ': ' + e.message.slice(0, 60)); } });
      return { total: pages.length, threw: threw };
    });
    check('all ' + r.total + ' pages render with 375 NCRs and 1,850 expiring rows', r.threw.length === 0, r.threw);
    check('and nothing was thrown at the window during the whole sweep', pageErrors.length === 0, pageErrors.slice(0, 5));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
