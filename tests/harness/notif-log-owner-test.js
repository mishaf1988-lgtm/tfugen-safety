// 06/11/2026: notifications_log on the server is Michael's alone (migrations/2026-11-06_notif_log_owner_only.sql,
// a RESTRICTIVE policy: only admin@tfugen.local reads or writes it through the API). Two things must hold:
//   * the migration file keeps that policy, scoped to authenticated and to the owner's email, with no DROP;
//   * _notifLog in another manager's browser keeps the line locally and does not queue a server insert
//     (the server would refuse it, and the op would stay in the outbox as an error forever).
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../migrations/2026-11-06_notif_log_owner_only.sql'), 'utf8')
    .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  check('migration: restrictive policy for the owner only',
    /create policy notifications_log_owner_only on public\.notifications_log as restrictive for all to authenticated/i.test(sql)
    && (sql.match(/'admin@tfugen\.local'/g) || []).length === 2, sql);
  check('migration: no drop, no delete', !/\b(drop|delete|truncate)\b/i.test(sql));

  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const run = (user) => page.evaluate((u) => {
    window._currentUser = u;
    window.__ins = [];
    window.sbIns = function (t, r) { window.__ins.push(t); };
    DB.notifications_log = [];
    _notifLog('round_missed', 'wa', { title: 'x' });
    return { local: DB.notifications_log.length, ins: window.__ins.slice() };
  }, user);
  const own = await run({ username: 'admin', role: 'אדמין' });
  check('owner: kept locally and sent to the server', own.local === 1 && own.ins.join() === 'notifications_log', own);
  const mgr = await run({ username: 'dana', role: 'מנהל' });
  check('another manager: kept locally, nothing sent', mgr.local === 1 && mgr.ins.length === 0, mgr);
  const none = await run(null);
  check('no user loaded: nothing sent', none.ins.length === 0, none);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
