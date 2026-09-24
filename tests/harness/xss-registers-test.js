// Text in the registers is text, not markup.
//
// Review of 2026-09-24. Nine list renderers -- documents, audits, employees,
// contractors, safety rounds, drills, waste, environmental monitoring and the
// activity log -- built their rows by concatenating record fields straight
// into innerHTML. They run in the main window, which holds the admin's
// Supabase session in localStorage.
//
// That is not only a question of trusting managers. The OneDrive inbox import
// fills these tables with fields an AI read out of a document's CONTENT, and
// it writes the FILE NAME into the activity log. A crafted PDF, or a file with
// markup in its name, dropped into the inbox, became a script that ran the
// moment the admin opened the page.
//
// The anonymous trustee kiosk's free text -- the finding, the location, the
// name -- was already escaped everywhere. These nine were not.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

// page id, DB table, the text fields that render in the row
const REGISTERS = [
  ['docs', 'docs', ['n', 'c', 'v', 'o']],
  ['aud', 'auds', ['n', 'a', 'sc']],
  ['emp', 'emp', ['n', 'r', 'dep', 'ph']],
  ['ctr', 'ctr', ['n', 'ty', 'c', 'tr']],
  ['ins', 'ins', ['a', 'fn', 'i']],
  ['drl', 'drl', ['sc', 'ty']],
  ['wst', 'wst', ['c', 'h', 'q', 'ty']],
  ['env', 'env', ['lim', 'me', 'r', 'ty', 'u']],
  ['lg', 'hist', ['tx']],
];
const PAYLOAD = '<img src=x onerror="window.__xss=(window.__xss||[]).concat(this.dataset.f)" data-f="FIELD">';

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; window._isAdmin = true;
    window.toast = function () {};
  });

  console.log('\nmarkup in a record field stays text, on every register');
  for (const [pg, tbl, fields] of REGISTERS) {
    const r = await page.evaluate(async (a) => {
      window.__xss = [];
      const t = new Date().toISOString().slice(0, 10);
      const row = { id: 'x1', ts: t + 'T08:00:00Z', d: t, e: t };
      a.fields.forEach(function (f) { row[f] = a.payload.replace('FIELD', a.tbl + '.' + f); });
      DB[a.tbl] = [row];
      goPage(a.pg);
      await new Promise((r2) => setTimeout(r2, 120));
      const main = document.getElementById('pg-' + a.pg) || document.body;
      return {
        fired: window.__xss.slice(),
        // An escaped payload shows as text; an unescaped one is an <img>.
        imgs: main.querySelectorAll('img[data-f]').length,
        shown: (main.textContent || '').indexOf('onerror=') >= 0,
      };
    }, { pg, tbl, fields, payload: PAYLOAD });
    check(tbl + ': no field ran as code' + (r.fired.length ? ' (' + r.fired.join(', ') + ')' : ''),
      r.fired.length === 0 && r.imgs === 0, r);
    check(tbl + ': ...and the text is still shown, as text', r.shown, r);
  }

  // The structural guard: a renderer added later with the same shape fails
  // here even if nobody writes a payload test for its table. The allow-list is
  // the rows built from code -- colours, counts and filter chips -- that were
  // checked by hand on 2026-09-24.
  console.log('\nno list renderer concatenates a raw record field into markup');
  {
    const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    const ALLOWED = new Set(['mChips:c', 'mChips:l', 'mChips:n', 'pills:color', 'tShown:color', 'tShown:n',
      'chips:clear', 'tchips:clear', 'hchips:clear']);
    const raw = [];
    src.split('\n').forEach((L, i) => {
      const m = L.match(/\.innerHTML\s*=\s*(?:\(?\s*)?(?:DB\.)?([A-Za-z_]+)[\w.\s()|\[\]]*\.map\(function\((\w)\)/);
      if (!m) return;
      const o = m[2];
      const fields = new Set();
      (L.match(new RegExp("'\\+" + o + "\\.([a-zA-Z_]\\w*)\\+'", 'g')) || []).forEach((x) => fields.add(x.split('.')[1].replace(/\+'$/, '')));
      (L.match(new RegExp("\\(" + o + "\\.([a-zA-Z_]\\w*)\\|\\|'", 'g')) || []).forEach((x) => fields.add(x.split('.')[1].replace(/\|\|'$/, '')));
      fields.delete('id');
      fields.forEach((f) => { if (!ALLOWED.has(m[1] + ':' + f)) raw.push((i + 1) + ' ' + m[1] + '.' + f); });
    });
    check('every text field in a list row goes through esc() (' + raw.length + ' raw)', raw.length === 0, raw.slice(0, 10));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
