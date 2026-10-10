// Operational sweep (10/10/2026, Michael: "אני רוצה בדיקת תפעול של האפליקציה"). He found
// by hand what no test did: a row deleted from the tasks page stayed on screen and its 👁
// said "record not found" (lesson 69). Every test so far checked one feature from one page.
// This one walks the app like a user: every page opens without an error, every 👁 opens its
// record, and a 🗑 removes the row from the screen at once, leaving every other 👁 working.
// The data is made up (a few rows in every table, the fields the renderers read).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 600) : '')); } };
const PAGES = (process.env.PAGES || '').split(',').filter(Boolean);

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const pages = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; window._role = () => 'admin'; window._isAdminUser = () => true;
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sbDel = function () {}; window.sdb = function () {}; window.addLog = function () {};
    window.__toasts = []; const t0 = window.toast; window.toast = function (m, o) { window.__toasts.push(String(m)); try { t0(m, o); } catch (e) {} };
    // A few rows in every table, with the fields the renderers read.
    const today = new Date(), iso = (d) => new Date(today.getTime() + d * 864e5).toISOString().substring(0, 10);
    Object.keys(DB).forEach((k) => {
      if (!Array.isArray(DB[k]) || k === 'hist') return;
      DB[k] = [0, 1, 2].map((i) => ({
        id: k + '-' + i, n: 'פריט ' + i, title: 'כותרת ' + i, num: 'N-' + i, d: i === 2 ? 'תיאור אי התאמה' : iso(-10 * i), sd: iso(-5), e: iso(i === 0 ? -3 : 20 * i),
        due: iso(5 - i), s: i === 1 ? 'סגור' : 'פתוח', status: i === 1 ? 'הושלם' : 'פתוח', priority: 'גבוה', c: 'טפסים', o: 'מיכאל', u: iso(7), w: 'עובד', ty: 'סוג', type: 'סוג',
        loc: 'מחסן', dep: 'ייצור', dept: 'ייצור', sev: 'בינונית', descr: 'תיאור', area: 'אזור', rep: 'מדווח', emp_name: 'עובד ' + i, code: 'C' + i, vendor: 'ספק',
        ok: i !== 0, t: 1, m: iso(0).substring(0, 7), tour_no: 1, name: 'שם ' + i, active: true, next_due: iso(10), version: 1, ncr_id: 'ncr-0', ts: new Date().toISOString(),
      }));
    });
    return Object.keys({ dash: 1, exp: 1, eqi: 1, nm: 1, round: 1, tasks: 1, users: 1, docs: 1, aud: 1, ncr: 1, inc: 1, tr: 1, rsk: 1, emp: 1, ptw: 1, ppe: 1, hearing: 1, ins: 1, drl: 1, ctr: 1, wst: 1, hzm: 1, env: 1, leg: 1, toolbox: 1, thz: 1, audit: 1, mr: 1, cal: 1, easp: 1, lg: 1, loc: 1, prj: 1, itp: 1, itype: 1, agents: 1, trustees: 1 });
  });

  for (const p of (PAGES.length ? PAGES : pages)) {
    const e0 = errs.length;
    const r = await page.evaluate((p) => {
      const NOTFOUND = /לא נמצאה|אינה נתמכת|לא ניתן להציג/;
      const closeAll = () => { document.querySelectorAll('.modal').forEach((m) => { if (m.style.display === 'block' || m.style.display === 'flex') try { closeModal(m.id); } catch (e) {} }); const del = document.getElementById('m-del-confirm'); if (del && del.style.display === 'block') try { cancelDel(); } catch (e) {} };
      const out = { opened: true, eyes: 0, bad: [], del: null };
      try { goPage(p); } catch (e) { return { opened: false, err: String(e) }; }
      const root = document.getElementById('pg-' + p) || document.getElementById('page-' + p) || document.body;
      // A 👁 opens the record on its own screen ("view"), so come back to the page after each one.
      const back = () => { closeAll(); if (typeof CUR !== 'undefined' && CUR !== p) try { goPage(p); } catch (e) {} };
      const vis = (sel) => [...root.querySelectorAll(sel)].filter((b) => b.offsetParent !== null);
      const tryEyes = (label) => {
        const n = Math.min(6, vis('[onclick*="showView"]').length);
        for (let i = 0; i < n; i++) {
          const b = vis('[onclick*="showView"]')[i]; if (!b) break;
          window.__toasts = [];
          try { b.click(); } catch (e) { out.bad.push(label + ' click threw: ' + e); }
          const t = window.__toasts.find((m) => NOTFOUND.test(m));
          if (t) out.bad.push(label + ': ' + t + ' (' + (b.getAttribute('data-vtbl') || '') + ' ' + (b.getAttribute('data-vid') || '') + ')');
          back(); out.eyes++;
        }
      };
      tryEyes('👁');
      // ✏️ opens the edit form of that record (a modal that is shown), with no error.
      const ed = vis('[onclick^="edit"],[onclick*=" edit"]')[0] || vis('button').find((b) => /^[\u270e\u270f]\ufe0f?$/.test(b.textContent.trim()));
      if (ed) {
        try { ed.click(); } catch (e) { out.bad.push('✏️ click threw: ' + e); }
        const shown = [...document.querySelectorAll('.modal')].some((m) => m.style.display === 'block' || m.style.display === 'flex');
        if (!shown) out.bad.push('✏️ opened no form (' + (ed.getAttribute('onclick') || '').slice(0, 40) + ')');
        out.edit = true; back();
      }
      back();
      const trash = vis('[onclick*="askDel"]').find((b) => b.getAttribute('data-dtbl') && b.getAttribute('data-did'));
      if (trash) {
        const tbl = trash.getAttribute('data-dtbl'), id = trash.getAttribute('data-did');
        trash.click();
        const pwEl = document.getElementById('del-pw'); if (pwEl) pwEl.value = _delPw();
        try { confirmDel(); } catch (e) { out.bad.push('confirmDel threw: ' + e); }
        const gone = !(DB[tbl] || []).some((x) => String(x.id) === String(id));
        const stale = [...root.querySelectorAll('[data-did],[data-vid],[data-sid],[data-id],[data-tid]')].some((el) => el.offsetParent !== null && [el.dataset.did, el.dataset.vid, el.dataset.sid, el.dataset.id, el.dataset.tid].indexOf(id) >= 0);
        out.del = { tbl, id, gone, stale };
        back(); tryEyes('👁 after delete');
      }
      closeAll();
      return out;
    }, p);
    const pageErrs = errs.slice(e0);
    console.log('\n' + p + (r.del ? '  (deleted ' + r.del.tbl + ')' : '') + '  👁 ' + (r.eyes || 0) + (r.edit ? '  ✏️' : ''));
    check(p + ': opens, no page error', r.opened && !pageErrs.length, { err: r.err, pageErrs: pageErrs.slice(0, 3) });
    check(p + ': every 👁 opens its record', !r.bad || !r.bad.length, r.bad);
    if (r.del) check(p + ': 🗑 removes it from the data and from the screen at once', r.del.gone && !r.del.stale, r.del);
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
