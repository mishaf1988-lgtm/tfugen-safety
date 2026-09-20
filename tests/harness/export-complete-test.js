// #617 capped the tasks and expiry pages at 200 painted rows to get the DOM
// down from 16,548 elements. _exportCSV reads the PAINTED DOM — so from the
// moment that cap shipped, the CSV Michael hands to an auditor from the expiry
// page held 200 rows of N, plus a row reading "מוצגות 200 מתוך 610".
//
// An export that silently drops records is worse than a slow page. That is the
// same reasoning that kept the counters above those lists uncapped; it was not
// carried through to the export, and this suite is what makes sure it stays
// carried through.
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
    // catch the download instead of performing it
    window.__csv = null;
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) { window.__blob = blob; return realCreate(blob); };
    HTMLAnchorElement.prototype.click = function () { window.__clicked = this.download; };
    // far more rows than the cap, across all five expiry registers
    const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().split('T')[0];
    ['ppe', 'tr', 'docs', 'ctr'].forEach((t) => {
      DB[t] = Array.from({ length: 150 }, (_, i) => ({ id: t + i, n: t + '-פריט-' + i, ty: 'סוג', w: 'עובד ' + i, o: 'דני', c: 'קבלן', e: iso(i % 200 - 40) }));
    });
    DB.equip_inspections = Array.from({ length: 200 }, (_, i) => ({ id: 'eq' + i, n: 'ציוד-' + i, code: 'C' + i, vendor: 'ספק', e: iso(i % 200 - 40) }));
    window._expShowAll = false; window._expFilter = 'all';
  });

  console.log('\n1. the expiry export carries every row, not the painted 200');
  {
    const r = await page.evaluate(() => {
      goPage('exp');
      const total = _expCollect().length + _expNoDate().length;
      const painted = g('tb-exp').querySelectorAll('tr').length;
      window.__blob = null; window.__toasts = [];
      _exportCSV();
      return window.__blob.text().then((txt) => ({
        total: total,
        painted: painted,
        lines: txt.trim().split('\n').length,
        hasNote: /מוצגות \d+ מתוך/.test(txt),
        capRestored: g('tb-exp').querySelectorAll('tr').length,
        showAllFlag: window._expShowAll,
      }));
    });
    check('there are far more expiring rows than the cap (' + r.total + ')', r.total > 400, r.total);
    check('the screen still paints only the capped 200 plus a footer', r.painted === 201, r.painted);
    check('but the CSV holds every row plus a header', r.lines === r.total + 1, { lines: r.lines, total: r.total });
    check('the "showing 200 of N" line is NOT in the file', !r.hasNote, r.hasNote);
    check('and the screen goes back to 200 afterwards — the export does not un-cap the page', r.capRestored === 201, r.capRestored);
    check('...with the flag restored too, so a later render is still capped', r.showAllFlag === false, r.showAllFlag);
  }

  console.log('\n2. "show all" chosen by the user is respected, not clobbered');
  {
    const r = await page.evaluate(() => {
      goPage('exp');
      expShowAll();                       // the user asked to see everything
      const before = g('tb-exp').querySelectorAll('tr').length;
      window.__blob = null;
      _exportCSV();
      return window.__blob.text().then(() => ({
        before: before,
        after: g('tb-exp').querySelectorAll('tr').length,
        flag: window._expShowAll,
      }));
    });
    check('the full list is still on screen after exporting', r.after === r.before, r);
    check('and the flag the user set is still true', r.flag === true, r.flag);
  }

  console.log('\n3. an ordinary uncapped page is unaffected');
  {
    const r = await page.evaluate(() => {
      DB.rsk = Array.from({ length: 12 }, (_, i) => ({ id: 'r' + i, d: 'סיכון ' + i, a: 'אזור', o: 'דני' }));
      goPage('rsk');
      const painted = document.querySelector('#pg-rsk tbody').querySelectorAll('tr').length;
      window.__blob = null;
      _exportCSV();
      return window.__blob.text().then((txt) => ({ painted: painted, lines: txt.trim().split('\n').length }));
    });
    check('a 12-row register exports its 12 rows plus a header', r.lines === r.painted + 1, r);
  }

  console.log('\n4. the footer row is marked as furniture, wherever it lands');
  {
    const r = await page.evaluate(() => {
      const html = _capNote(610, 200, 'expShowAll()', 6);
      return { cls: /class="cap-note"/.test(html), isRow: /^<tr/.test(html), div: !/^<tr/.test(_capNote(610, 200, 'tskShowAll()', 0)) };
    });
    check('the table footer carries class="cap-note", so no export can read it as data', r.cls && r.isRow, r);
    check('the card-list footer is still a plain div', r.div, r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
