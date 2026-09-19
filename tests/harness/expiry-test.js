// The expiry page used to be a dead end that also lied:
//   * a record with no expiry date rendered a GREEN "valid" badge, because
//     du(null) is 9999 and eb() fell through to the x>60 branch
//   * ...and every scanner skipped it, so it was invisible as well as green
//   * "≤30 יום" was x>=0&&x<=30 — it HID everything already expired
//   * the rows carried no action at all, so seeing an expiry led nowhere
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const iso = (days) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return d.toISOString().substring(0, 10); };
const SEED = {
  equip_inspections: [
    { id: 'e1', code: 'EQ-1', n: 'מלגזה 1', e: iso(-10), loc: 'מחסן' },   // expired 10 days ago
    { id: 'e2', code: 'EQ-2', n: 'מלגזה 2', e: iso(3), loc: 'מחסן' },     // due in 3
    { id: 'e3', code: 'EQ-3', n: 'מלגזה 3', e: iso(20), loc: 'ייצור' },    // due in 20
    { id: 'e4', code: 'EQ-4', n: 'מלגזה 4', e: iso(200), loc: 'ייצור' },   // far away
    { id: 'e5', code: 'EQ-5', n: 'מלגזה ללא תאריך', loc: 'ייצור' },        // NO expiry date
  ],
  tr: [{ id: 't1', n: 'הדרכה ללא תאריך', w: 'לב' }],
  docs: [{ id: 'd1', n: 'נוהל בתוקף', c: 'בטיחות', e: iso(5) }],
  ppe: [], ctr: [],
};

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate((seed) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    Object.keys(seed).forEach((k) => { DB[k] = JSON.parse(JSON.stringify(seed[k])); });
    window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {};
    window._currentUser = { username: 'admin' }; _isAdmin = true;
    _applyRoleGates(); goPage('exp');
  }, SEED);

  const tab = (f) => page.evaluate((f) => {
    expFilter(f);
    return {
      names: Array.from(document.querySelectorAll('#tb-exp tr'))
        .map((tr) => (tr.querySelector('td strong') || {}).textContent || '')
        .filter(Boolean),
      kpis: ['exp', '7', '30', '90', 'none'].reduce((o, k) => { const el = document.getElementById('exp-k-' + k); o[k] = el ? el.textContent : null; return o; }, {}),
    };
  }, f);

  console.log('\n1. a missing expiry date no longer looks valid');
  {
    const r = await page.evaluate(() => ({
      none: eb(null), empty: eb(''), good: eb('2099-01-01'), soon: eb(new Date(Date.now() + 5 * 864e5).toISOString().substring(0, 10)),
    }));
    check('eb(null) is NOT green — it says "אין תאריך"', !/bG/.test(r.none) && /אין תאריך/.test(r.none), r.none);
    check('eb("") behaves the same', !/bG/.test(r.empty) && /אין תאריך/.test(r.empty), r.empty);
    check('a real far-off date is still green', /bG/.test(r.good), r.good);
    check('a date 5 days out is still amber', /bY/.test(r.soon), r.soon);
  }

  console.log('\n2. "≤30 יום" no longer hides what already expired');
  {
    const t30 = await tab('30');
    check('≤30 includes the one that expired 10 days ago', t30.names.indexOf('מלגזה 1') >= 0, t30.names);
    check('...together with the 3-day and 20-day ones, and the 5-day document', t30.names.length === 4, t30.names);
    check('the 200-day one is still out', t30.names.indexOf('מלגזה 4') < 0, t30.names);
    const t7 = await tab('7');
    check('≤7 also includes the expired one (it needs handling most)', t7.names.indexOf('מלגזה 1') >= 0 && t7.names.length === 3, t7.names);
    check('the counters agree with the lists they label: ≤30 reads 4', t30.kpis['30'] === '4', t30.kpis);
    check('and "פג תוקף" still counts only the truly expired: 1', t30.kpis.exp === '1', t30.kpis);
  }

  console.log('\n3. records with no date are visible instead of invisible');
  {
    const none = await tab('none');
    check('the new "ללא תאריך" tab lists both undated records', none.names.length === 2 && none.names.indexOf('מלגזה ללא תאריך') >= 0, none.names);
    check('its counter reads 2', none.kpis.none === '2', none.kpis);
    const all = await tab('all');
    check('"הכל" shows all 7 — 5 dated plus the 2 undated', all.names.length === 7, all.names);
    check('and the undated ones sort last, so the urgent stay on top', all.names.slice(-2).every((x) => /ללא תאריך/.test(x)) && all.names[0] === 'מלגזה 1', all.names);
  }

  console.log('\n4. a row can now be acted on without leaving the page');
  {
    await tab('all');
    const r = await page.evaluate(() => {
      const first = document.querySelector('#tb-exp tr');
      const cells = first.querySelectorAll('td').length;
      const btns = Array.from(first.querySelectorAll('button')).map((b) => b.getAttribute('title'));
      return { cells: cells, btns: btns };
    });
    check('each row has 6 cells, the last one holding the actions', r.cells === 6, r);
    check('the actions are צפה and צור משימה', r.btns.length === 2 && /צפה/.test(r.btns[0]) && /משימה/.test(r.btns[1]), r.btns);
    const spawn = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#tb-exp tr:first-child button')).find((x) => /משימה/.test(x.getAttribute('title') || ''));
      b.click();
      const open = getComputedStyle(document.getElementById('m-tsk')).display !== 'none';
      return { open: open, srcTbl: document.getElementById('tsk-src-tbl').value, srcId: document.getElementById('tsk-src-id').value, title: document.getElementById('tsk-title').value };
    });
    check('tapping it opens the task form bound to the right equipment record', spawn.open && spawn.srcTbl === 'equip_inspections' && spawn.srcId === 'e1', spawn);
    await page.evaluate(() => closeModal('m-tsk'));
  }

  console.log('\n5. the empty state still spans the table');
  {
    const r = await page.evaluate(() => {
      ['docs', 'tr', 'ppe', 'ctr', 'equip_inspections'].forEach((k) => { DB[k] = []; });
      expFilter('all');
      const td = document.querySelector('#tb-exp td');
      return { colspan: td ? td.getAttribute('colspan') : null, text: td ? (td.innerText || '').trim().slice(0, 20) : null };
    });
    check('the "nothing here" row spans all 6 columns', r.colspan === '6', r);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
