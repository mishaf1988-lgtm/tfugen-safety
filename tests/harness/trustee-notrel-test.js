// «לא ליקוי» (30/09/2026, Michael): a trustee reports something that is not a
// deficiency, to collect points. Until now the only way to mark it was «נסגר»
// plus a note, which handed the trustee 2 closing points on top of the task's
// 10. Now the manager marks it from the row menu and the app treats the report
// as if it was never made: no task credit, no closing points, out of every
// count and list, grey badge, a counter on the leaderboard, and undo.
// The note is written in the convention the server already reads
// (functions/api/hazard-file.js notRelevant), so the file and the department
// report drop it too.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
// The server's rule, copied so a drift between the two is caught here.
const SERVER_NOT_RELEVANT = /^\s*לא רלוונטי/;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  // The reason prompt: what the next dialog answers (null = cancel).
  let answer = 'נבדק במקום, אין ליקוי';
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push({ type: d.type(), msg: d.message(), def: d.defaultValue() }); if (d.type() === 'prompt' && answer === null) return d.dismiss(); return d.accept(d.type() === 'prompt' ? answer : undefined); });
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const M = new Date().toISOString().substring(0, 7), D = new Date().toISOString().substring(0, 10);

  console.log('\n1. before: the doubtful report earns the task and would earn the closing');
  const s1 = await page.evaluate(({ M, D }) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','trustee_reports'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window.__toasts = []; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.__upd = []; const ou = window.sbUpd; window.sbUpd = function (t, r) { window.__upd.push({ t, id: r.id, s: r.s, note: r.mgr_note, closed_d: r.closed_d }); return ou(t, r); };
    const r = (id, u, t, ok, s, extra) => Object.assign({ id, u, t, ok, s, d: D, m: M, loc: 'אולם טיגון', f: ok ? null : 'ממצא ' + id, ts: '2026-09-1' + (id.length % 10) + 'T08:00:00Z' }, extra || {});
    DB.trustee_reports = [
      r('d1', 'דנה', 1, false, 'פתוח', { f: 'דלת חירום חסומה' }), r('d2', 'דנה', 2, true, 'תקין'),
      // זיו: task 3 is a "hazard" that is not one, task 6 is a real ok report
      r('z1', 'זיו', 3, false, 'פתוח', { f: 'נראה לי מסוכן', mgr_note: 'נותב לאחזקה' }), r('z2', 'זיו', 6, true, 'תקין'),
    ];
    window._currentUser = { username: 'admin', full_name: 'מיכאל' }; _applyRoleGates();
    goPage('trustees');
    const sc = _truScore('זיו', M);
    return { sc: { nTasks: sc.nTasks, total: sc.total, open: sc.open, notRel: sc.notRel }, pills: Array.from(document.querySelectorAll('#tru-mgr-summary button')).map(b => b.textContent.trim()).join(' '), hazard: _truIsHazard(_truFind('z1')), field: _mfTruFindings().map(x => x.id).join(',') };
  }, { M, D });
  check('זיו: 2 tasks = 20 points, 1 open hazard, nothing marked', s1.sc.nTasks === 2 && s1.sc.total === 20 && s1.sc.open === 1 && s1.sc.notRel === 0, s1.sc);
  check('no «לא ליקוי» pill while nothing is marked', !/לא ליקוי/.test(s1.pills), s1.pills);
  check('z1 counts as a hazard, on the field screen too', s1.hazard && s1.field.split(',').includes('z1'), s1);

  console.log('\n2. the row menu: «לא ליקוי», with a reason');
  const s2 = await page.evaluate(() => {
    document.querySelector('#tb-trustees tr[data-tru-row="z1"] [onclick^="_truRowMenu("]').click();
    const items = Array.from(document.querySelectorAll('#tru-row-menu button')).map(b => b.textContent.trim());
    const it = Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /לא ליקוי/.test(b.textContent));
    if (it) it.click();
    const M = _truMgrMonth();
    const sc = _truScore('זיו', M);
    const board = Array.from(document.querySelectorAll('#tru-mgr-board .tru-board-row')).map(x => x.dataset.truU + ':' + x.lastElementChild.textContent.trim() + (/לא ליקוי 1/.test(x.textContent) ? ' [1 לא ליקוי]' : ''));
    return { items, upd: window.__upd.slice(-1)[0], toast: window.__toasts.slice(-1)[0], row: _truFind('z1'), sc: { nTasks: sc.nTasks, total: sc.total, open: sc.open, closed: sc.closed, notRel: sc.notRel }, board, pills: Array.from(document.querySelectorAll('#tru-mgr-summary button')).map(b => b.textContent.trim()).join(' '), hazard: _truIsHazard(_truFind('z1')), unver: _truUnverified(M).map(x => x.id), field: _mfTruFindings().map(x => x.id) };
  });
  check('the menu offers «לא ליקוי (לא נחשב לניקוד)» on an open hazard', s2.items.some(t => /לא ליקוי/.test(t)), s2.items);
  check('a reason was asked, with a default the manager can keep', dialogs.length === 1 && dialogs[0].type === 'prompt' && /למה/.test(dialogs[0].msg) && /אין ליקוי/.test(dialogs[0].def), dialogs);
  check('one write: closed, with the reason in front of the earlier routing note', s2.upd && s2.upd.id === 'z1' && s2.upd.s === 'נסגר' && s2.upd.note === 'לא רלוונטי: נבדק במקום, אין ליקוי · נותב לאחזקה' && !!s2.upd.closed_d, s2.upd);
  check('the note is what the server\'s notRelevant() reads (hazard-file.js)', SERVER_NOT_RELEVANT.test(s2.row.mgr_note), s2.row.mgr_note);
  check('the toast says it does not count', /לא נחשב לניקוד/.test(s2.toast || ''), s2.toast);
  check('score: task 3 gone (1 task = 10), no closing points, 1 marked', s2.sc.nTasks === 1 && s2.sc.total === 10 && s2.sc.closed === 0 && s2.sc.open === 0 && s2.sc.notRel === 1, s2.sc);
  check('leaderboard shows the counter on זיו', s2.board.some(x => x.startsWith('זיו:10 [1 לא ליקוי]')), s2.board);
  check('a «לא ליקוי: 1» pill appears; ok stays 2 (d2, z2), open 1 (דנה only)', /לא ליקוי: 1/.test(s2.pills) && /תקינים: 2\b/.test(s2.pills) && /פתוחים: 1\b/.test(s2.pills), s2.pills);
  check('z1 is no hazard any more: not unverified, not on the field screen', !s2.hazard && !s2.unver.includes('z1') && !s2.field.includes('z1'), { hazard: s2.hazard, unver: s2.unver, field: s2.field });

  console.log('\n3. where it shows, and where it does not');
  const s3 = await page.evaluate(() => {
    const rowsOf = () => Array.from(document.querySelectorAll('#tb-trustees tr[data-tru-row]')).map(tr => tr.dataset.truRow);
    const out = {};
    ['open', 'closed', 'unver', 'ok', 'notrel', 'all'].forEach(f => { _truMgrSetFilter(f); out[f] = rowsOf(); });
    _truMgrSetFilter('notrel');
    const tr = document.querySelector('#tb-trustees tr[data-tru-row="z1"]');
    out.badge = tr ? tr.querySelector('.b').textContent.trim() : null;
    out.age = tr ? /ימים|יום/.test(tr.textContent) : null;
    document.querySelector('#tb-trustees tr[data-tru-row="z1"] [onclick^="_truRowMenu("]').click();
    out.items = Array.from(document.querySelectorAll('#tru-row-menu button')).map(b => b.textContent.trim());
    // the outside-click listener is armed after this tick; drop the menu directly
    const mm = document.getElementById('tru-row-menu'); if (mm) mm.remove();
    return out;
  });
  check('only under «לא ליקוי» and «הכל»; not open, closed, unchecked or ok', s3.notrel.join() === 'z1' && s3.all.includes('z1') && !s3.open.includes('z1') && !s3.closed.includes('z1') && !s3.unver.includes('z1') && !s3.ok.includes('z1'), s3);
  check('grey «לא ליקוי» badge, no age chip', s3.badge === 'לא ליקוי' && s3.age === false, { badge: s3.badge, age: s3.age });
  check('its menu: undo and delete only', s3.items.some(t => /החזר לליקוי/.test(t)) && !s3.items.some(t => /סמן נסגר|פעולה מתקנת|שלח לטיפול/.test(t)), s3.items);

  console.log('\n4. undo: back to an open hazard, the routing note kept');
  const s4 = await page.evaluate(() => {
    _truMgrSetFilter('notrel');
    document.querySelector('#tb-trustees tr[data-tru-row="z1"] [onclick^="_truRowMenu("]').click();
    Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /החזר לליקוי/.test(b.textContent)).click();
    const M = _truMgrMonth(), sc = _truScore('זיו', M);
    return { upd: window.__upd.slice(-1)[0], sc: { nTasks: sc.nTasks, total: sc.total, open: sc.open, notRel: sc.notRel }, pills: Array.from(document.querySelectorAll('#tru-mgr-summary button')).map(b => b.textContent.trim()).join(' ') };
  });
  check('write: open again, closed_d cleared, note back to «נותב לאחזקה»', s4.upd && s4.upd.s === 'פתוח' && s4.upd.closed_d === null && s4.upd.note === 'נותב לאחזקה', s4.upd);
  check('score back to 20, pill gone', s4.sc.total === 20 && s4.sc.notRel === 0 && !/לא ליקוי/.test(s4.pills), { sc: s4.sc, pills: s4.pills });

  console.log('\n5. cancel and an empty reason write nothing');
  const before = await page.evaluate(() => window.__upd.length);
  answer = null;
  await page.evaluate(() => { _truMgrSetFilter('open'); document.querySelector('#tb-trustees tr[data-tru-row="z1"] [onclick^="_truRowMenu("]').click(); Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /לא ליקוי/.test(b.textContent)).click(); });
  answer = '   ';
  await page.evaluate(() => { document.querySelector('#tb-trustees tr[data-tru-row="z1"] [onclick^="_truRowMenu("]').click(); Array.from(document.querySelectorAll('#tru-row-menu button')).find(b => /לא ליקוי/.test(b.textContent)).click(); });
  const s5 = await page.evaluate(() => ({ n: window.__upd.length, s: _truFind('z1').s, toast: window.__toasts.slice(-1)[0] }));
  check('no write on cancel or on a blank reason; the row stays open', s5.n === before && s5.s === 'פתוח' && /למה/.test(s5.toast || ''), s5);

  check('no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR', e); process.exit(1); });
