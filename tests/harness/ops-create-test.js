// Operational sweep, part 2 (10/10/2026, Michael: "אני רוצה בדיקת תפעול מלאה"): what
// ops-sweep-test.js does not do. On every page with a "new" button: open the form, fill
// every visible field by its type, save, and check the record is in the data, went to the
// server (sbIns), and shows on the page. Then edit one record, save, and check it changed
// in place (no duplicate, sbUpd). Data and server are fake; the forms and the code are real.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 700) : '')); } };
const ONLY = (process.env.PAGES || '').split(',').filter(Boolean);
const PAGES = ['dash', 'tasks', 'docs', 'aud', 'nm', 'ncr', 'inc', 'tr', 'rsk', 'emp', 'ptw', 'ppe', 'ins', 'drl', 'ctr', 'wst', 'hzm', 'env', 'leg', 'toolbox', 'easp', 'eqi', 'round', 'thz', 'hearing', 'loc', 'prj', 'itp', 'itype', 'trustees'];

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; window._role = () => 'admin'; window._isAdminUser = () => true;
    window.__ins = []; window.__upd = [];
    window.sbIns = function (t, r) { window.__ins.push({ t, r: JSON.parse(JSON.stringify(r || {})) }); };
    window.sbUpd = function (t, r) { window.__upd.push({ t, r: JSON.parse(JSON.stringify(r || {})) }); };
    window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; const t0 = window.toast; window.toast = function (m, o) { window.__toasts.push(String(m)); try { t0(m, o); } catch (e) {} };
    const today = new Date(), iso = (d) => new Date(today.getTime() + d * 864e5).toISOString().substring(0, 10);
    Object.keys(DB).forEach((k) => {
      if (!Array.isArray(DB[k]) || k === 'hist') return;
      DB[k] = [0, 1].map((i) => ({ id: k + '-' + i, n: 'פריט ' + i, title: 'כותרת ' + i, num: 'N-' + i, d: iso(-10 * i), e: iso(20), due: iso(5), s: 'פתוח', status: 'פתוח', priority: 'רגיל', c: 'טפסים', o: 'מיכאל', loc: 'מחסן', dep: 'ייצור', descr: 'תיאור', name: 'שם ' + i, active: true, ts: new Date().toISOString() }));
    });
  });

  for (const p of (ONLY.length ? ONLY : PAGES)) {
    const e0 = errs.length;
    const r = await page.evaluate((p) => {
      const MARK = 'בדיקת תפעול ' + p;
      const out = { p, add: null, saved: null, edit: null };
      const shownModal = () => [...document.querySelectorAll('.modal')].find((m) => m.style.display === 'block' || m.style.display === 'flex');
      const closeAll = () => { document.querySelectorAll('.modal').forEach((m) => { if (m.style.display === 'block' || m.style.display === 'flex') try { closeModal(m.id); } catch (e) {} }); };
      const fill = (m, mark) => {
        const iso = new Date().toISOString().substring(0, 10);
        [...m.querySelectorAll('input,textarea,select')].filter((el) => el.offsetParent !== null && !el.disabled && !el.readOnly).forEach((el) => {
          const ty = (el.type || '').toLowerCase();
          if (['hidden', 'file', 'button', 'submit', 'checkbox', 'radio', 'password', 'search'].indexOf(ty) >= 0) return;
          if (el.tagName === 'SELECT') { const o = [...el.options].find((x) => x.value && !x.disabled); if (o && !el.value) el.value = o.value; }
          else if (ty === 'date') el.value = iso;
          else if (ty === 'time') el.value = '08:00';
          else if (ty === 'number') el.value = el.value || '1';
          else if (ty === 'email') el.value = 'a@b.co';
          else if (ty === 'tel') el.value = '0501234567';
          else if (!el.value) el.value = mark;
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        // The first text field carries the mark even when it had a default.
        const first = [...m.querySelectorAll('input[type=text],input:not([type]),textarea')].find((el) => el.offsetParent !== null && !el.readOnly && !el.disabled);
        if (first) { first.value = mark; first.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      const saveBtn = (m) => [...m.querySelectorAll('button')].find((b) => b.offsetParent !== null && (/^\s*sv|save|Save/.test(b.getAttribute('onclick') || '') || /שמור/.test(b.textContent)));
      try { goPage(p); } catch (e) { return { p, err: 'goPage: ' + e }; }
      const root = document.getElementById('pg-' + p) || document.body;
      const NEW = /openModal\('m-(?!reports-sheet|modules-sheet|del|view)|openNew[A-Za-z]*\(\)|openTskModal\(\)|^new[A-Z]|^add[A-Z]|^_?[a-z]*New\(/;
      const add = [...root.querySelectorAll('button,a')].find((b) => b.offsetParent !== null && NEW.test(b.getAttribute('onclick') || '') && !/Xl|Import|Rename|Reset|Delete|Starter/.test(b.getAttribute('onclick') || ''));
      if (!add) return out;
      out.add = (add.getAttribute('onclick') || '').slice(0, 50);
      const before = {}; Object.keys(DB).forEach((k) => { if (Array.isArray(DB[k])) before[k] = DB[k].length; });
      window.__ins = []; window.__toasts = [];
      try { add.click(); } catch (e) { out.saved = { err: 'open: ' + e }; return out; }
      const m = shownModal();
      if (!m) { out.saved = { err: 'no form opened' }; return out; }
      out.form = m.id;
      fill(m, MARK);
      const sb = saveBtn(m);
      if (!sb) { out.saved = { err: 'no save button in ' + m.id }; closeAll(); return out; }
      try { sb.click(); } catch (e) { out.saved = { err: 'save threw: ' + e }; }
      const grown = Object.keys(before).filter((k) => DB[k].length === before[k] + 1);
      const row = grown.length ? DB[grown[0]].find((x) => JSON.stringify(x).indexOf(MARK) >= 0) : null;
      const stillOpen = shownModal() === m;
      if (CUR !== p) try { goPage(p); } catch (e) {}
      const pg = document.getElementById('pg-' + p) || document.body;
      // Shown: its text on the page, or a row button that points at its id (a list may show
      // other columns than the field the mark went into, e.g. drills show type and date).
      const onPage = pg.textContent.indexOf(MARK) >= 0 || (!!row && [...pg.querySelectorAll('[data-vid],[data-did],[data-tid],[data-id]')].some((el) => [el.dataset.vid, el.dataset.did, el.dataset.tid, el.dataset.id].indexOf(row.id) >= 0));
      out.saved = { tbl: grown[0] || null, row: !!row, ins: window.__ins.map((x) => x.t), toasts: window.__toasts.slice(0, 3), stillOpen, onPage };
      closeAll();
      // Edit the record just made: change the mark, save, check in place.
      if (row) {
        const tbl = grown[0], id = row.id, n0 = DB[tbl].length;
        const ed = [...(document.getElementById('pg-' + p) || document.body).querySelectorAll('[onclick]')].find((b) => b.offsetParent !== null && /edit|_tskOpen|Edit\(/.test(b.getAttribute('onclick') || '') && ((b.getAttribute('onclick') || '').indexOf(id) >= 0 || [b.dataset.tid, b.dataset.id, b.dataset.eid].indexOf(id) >= 0));
        // No ✏️ on the row: the way most pages edit is 👁 then "ערוך" in the view (_genEdit).
        let opener = ed ? () => ed.click() : null;
        if (!ed) { try { showView(tbl, id); } catch (e) {} const ve = document.getElementById('view-edit'); if (ve && ve.offsetParent !== null) opener = () => ve.click(); }
        if (opener) {
          window.__upd = [];
          opener();
          const m2 = shownModal();
          if (m2) {
            const first = [...m2.querySelectorAll('input[type=text],input:not([type]),textarea')].find((el) => el.offsetParent !== null && !el.readOnly && el.value.indexOf(MARK) >= 0);
            if (first) { first.value = MARK + ' ערוך'; first.dispatchEvent(new Event('input', { bubbles: true })); }
            const sb2 = saveBtn(m2); if (sb2) sb2.click();
            const rec = DB[tbl].find((x) => x.id === id);
            out.edit = { field: !!first, same: DB[tbl].length === n0, changed: !!rec && JSON.stringify(rec).indexOf(MARK + ' ערוך') >= 0, upd: window.__upd.map((x) => x.t) };
          } else out.edit = { err: 'no form' };
          closeAll();
        }
      }
      return out;
    }, p);
    const pe = errs.slice(e0);
    console.log('\n' + p + (r.add ? '  [' + r.add + ']' : '  (no "new" button)') + (r.form ? ' -> ' + r.form : ''));
    check(p + ': no page error', !pe.length && !r.err, { err: r.err, pe: pe.slice(0, 3) });
    if (r.saved) {
      check(p + ': new record saved, sent to the server and shown', r.saved.row && r.saved.ins.indexOf(r.saved.tbl) >= 0 && !r.saved.stillOpen && r.saved.onPage, r.saved);
    }
    if (r.edit) check(p + ': edit saved in place (no duplicate)', r.edit.field && r.edit.same && r.edit.changed && r.edit.upd.length > 0, r.edit);
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
