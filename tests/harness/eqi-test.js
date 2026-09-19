// EQI expired-widget check: renders the REAL index.html in headless Chromium
// at phone width with the network blocked, seeds equipment rows, and verifies
// the summary strip, pill → filter wiring, the expired CSV export (captured
// as a download), the empty states and that no notification is produced.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','notifications_log'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window._currentUser = { username: 'admin' };
    // Count anything that tries to log/send a notification while we use the widget.
    window.__notif = 0;
    const orig = window._notifyEvent; window._notifyEvent = function () { window.__notif++; return orig ? orig.apply(this, arguments) : []; };
    const origLog = window._notifLog; window._notifLog = function () { window.__notif++; return origLog ? origLog.apply(this, arguments) : undefined; };
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().split('T')[0];
  const shift = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  const strip = () => page.evaluate(() => {
    const s = document.getElementById('eqi-summary');
    const btns = Array.from(s.querySelectorAll('button')).map(b => b.textContent.trim());
    return { text: s.textContent.replace(/\s+/g, ' ').trim(), btns, rows: document.querySelectorAll('#tb-eqi tr').length, emptyText: (document.querySelector('#tb-eqi td.et') || {}).textContent || '', filter: window._eqiFilter };
  });

  console.log('\n1. empty equipment table (post-reset)');
  await page.evaluate(() => { DB.equip_inspections = []; eqiFilter('all'); goPage('eqi'); });
  let s = await strip();
  check('"expired: 0" is shown, not hidden', /פג תוקף: 0/.test(s.text), s.text);
  check('≤30 / ok / total pills present with 0', /≤30 יום: 0/.test(s.text) && /תקינים: 0/.test(s.text) && /סה״כ: 0/.test(s.text), s.text);
  check('export-expired button present with (0)', s.btns.some(t => /ייצוא פגי תוקף \(0\)/.test(t)), s.btns);
  check('clear empty text for no equipment', /אין רשומות ציוד/.test(s.text) && /אין רשומות ציוד/.test(s.emptyText), { strip: s.text, table: s.emptyText });
  const emptyExport = await page.evaluate(() => { const t = []; const o = window.toast; window.toast = (m) => t.push(m); try { _eqiExportExpiredCsv(); } catch (e) { t.push('THREW ' + e); } window.toast = o; return t; });
  check('export with 0 expired: clear toast, no exception, no file', emptyExport.length === 1 && /אין פריטים פגי תוקף/.test(emptyExport[0]) && !/THREW/.test(emptyExport[0]), emptyExport);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/eqi-empty-375.png' });

  console.log('\n2. seeded equipment: 2 expired (one older), 1 due in 10 days, 1 without e, 1 status ok');
  await page.evaluate((r) => { DB.equip_inspections = r; eqiFilter('all'); rEqi(); }, [
    { id: 'E-OLD', n: 'מלגזה ישנה', code: 'FL-OLD', e: shift(-40), vendor: 'בודק א', s: 'לא תקין' },
    { id: 'E-NEW', n: 'דוד קיטור', code: 'BOIL-1', e: shift(-3), vendor: 'בודק ב', s: 'תקין' },
    { id: 'E-SOON', n: 'סל הרמה', code: 'BASK-1', e: shift(10), s: 'תקין' },
    { id: 'E-NOE', n: 'ללא תאריך', code: 'X-1', s: 'תקין' },
    { id: 'E-FAR', n: 'אוטוקלאב', code: 'AC-1', e: shift(200), s: 'תקין' },
  ]);
  s = await strip();
  check('expired: 2 · ≤30: 1 · ok(status): 4 · total: 5', /פג תוקף: 2/.test(s.text) && /≤30 יום: 1/.test(s.text) && /תקינים: 4/.test(s.text) && /סה״כ: 5/.test(s.text), s.text);
  check('export button shows (2)', s.btns.some(t => /ייצוא פגי תוקף \(2\)/.test(t)), s.btns);

  console.log('\n3. pill → filter wiring');
  await page.evaluate(() => { Array.from(document.querySelectorAll('#eqi-summary button')).find(b => /פג תוקף/.test(b.textContent)).click(); });
  s = await strip();
  const expRows = await page.evaluate(() => Array.from(document.querySelectorAll('#tb-eqi tr')).map(tr => tr.textContent).filter(t => /FL-OLD|BOIL-1|BASK-1|X-1|AC-1/.test(t)).map(t => (t.match(/FL-OLD|BOIL-1|BASK-1|X-1|AC-1/) || [])[0]));
  check('expired pill → filter=exp, list has exactly the 2 expired, oldest first', s.filter === 'exp' && expRows.join(',') === 'FL-OLD,BOIL-1', { filter: s.filter, expRows });
  check('item due in 10 days and item without e are NOT in the expired list', !expRows.includes('BASK-1') && !expRows.includes('X-1'), expRows);
  await page.evaluate(() => { Array.from(document.querySelectorAll('#eqi-summary button')).find(b => /≤30/.test(b.textContent)).click(); });
  s = await strip();
  const soonRows = await page.evaluate(() => Array.from(document.querySelectorAll('#tb-eqi tr')).map(tr => tr.textContent).filter(t => /FL-OLD|BOIL-1|BASK-1|X-1|AC-1/.test(t)).map(t => (t.match(/FL-OLD|BOIL-1|BASK-1|X-1|AC-1/) || [])[0]));
  check('≤30 pill → only the item due in 10 days', s.filter === '30' && soonRows.join(',') === 'BASK-1', { filter: s.filter, soonRows });
  await page.evaluate(() => { Array.from(document.querySelectorAll('#eqi-summary button')).find(b => /תקינים/.test(b.textContent)).click(); });
  s = await strip();
  check('ok pill → filter=ok, 4 rows (same rule as the tab)', s.filter === 'ok' && s.rows === 4, { filter: s.filter, rows: s.rows });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/eqi-seeded-375.png' });

  console.log('\n4. expired CSV export (captured download)');
  await page.evaluate(() => eqiFilter('ok'));  // user is on another tab — export must not change it
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.evaluate(() => _eqiExportExpiredCsv()),
  ]);
  const p = await dl.path();
  const csv = fs.readFileSync(p, 'utf8');
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  check('file name marks it as expired', /tapugan-equipment-expired-\d{4}-\d{2}-\d{2}\.csv/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('header + exactly 2 data rows', lines.length === 3, lines.length);
  check('oldest expired first (FL-OLD before BOIL-1)', lines[1].includes('FL-OLD') && lines[2].includes('BOIL-1'), lines.slice(1).map(l => l.slice(0, 60)));
  check('10-day and no-date items excluded', !csv.includes('BASK-1') && !csv.includes('X-1') && !csv.includes('AC-1'));
  check('UTF-8 BOM present (Excel Hebrew)', csv.charCodeAt(0) === 0xFEFF);
  const after = await strip();
  check('export did not change the tab the user was on', after.filter === 'ok', after.filter);

  console.log('\n5. no notifications from viewing / exporting');
  const notif = await page.evaluate(() => ({ calls: window.__notif, log: (DB.notifications_log || []).length }));
  check('no _notifyEvent / _notifLog calls, notifications_log untouched', notif.calls === 0 && notif.log === 0, notif);

  console.log('\n6. regression: tabs still work');
  const tabs = await page.evaluate(() => { const out = {}; ['all', 'exp', '30', '90', 'ok'].forEach(k => { eqiFilter(k); out[k] = document.querySelectorAll('#tb-eqi tr').length; }); return out; });
  check('all=5 exp=2 30=1 90=1 ok=4', tabs.all === 5 && tabs.exp === 2 && tabs['30'] === 1 && tabs['90'] === 1 && tabs.ok === 4, tabs);
  const exp = await page.evaluate(() => { goPage('exp'); expFilter('exp'); return { cur: window.CUR, k: document.getElementById('exp-k-exp').textContent }; });
  check('pg-exp expired tab still counts equipment (2)', exp.cur === 'exp' && exp.k === '2', exp);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
