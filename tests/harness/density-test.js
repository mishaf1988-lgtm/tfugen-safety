// A3 check: laws list rows carry 👁 + ⋯ only; NCR-type tree nodes carry ⋯
// only; the menus reach the original edit / delete / add-child functions;
// reporters get no menu (Phase B).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','issue_types'].forEach(k => { if (!DB[k]) DB[k] = []; });
    DB.leg = [
      { id: 'L1', s: 'פקודת הבטיחות בעבודה', law_num: 'תש"ל-1970', a: 'בטיחות', c: 'מציית', u: '2026-01-01', src_url: 'https://www.nevo.co.il/law' },
      { id: 'L2', s: 'תקנות רעש', a: 'בריאות', c: 'חלקית', u: '2026-02-01' },
    ];
    DB.issue_types = [
      { id: 'C1', name: 'בטיחות', level: 1, parent_id: null },
      { id: 'S1', name: 'ציוד', level: 2, parent_id: 'C1' },
      { id: 'V1', name: 'מלגזה', level: 3, parent_id: 'S1' },
    ];
    window.__calls = [];
    ['editLeg', 'editItype', '_itypeOpenAdd', 'askDel', 'showView'].forEach(n => { const o = window[n]; window[n] = function () { window.__calls.push([n].concat(Array.from(arguments).map(String))); }; });
    window._currentUser = { username: 'admin' }; _applyRoleGates();
  });

  console.log('\n1. laws list (admin)');
  const leg = await page.evaluate(() => { goPage('leg'); rLeg(); return Array.from(document.querySelectorAll('#tb-leg tr')).map(tr => Array.from(tr.querySelectorAll('td:last-child button')).map(b => b.textContent.trim())); });
  check('each law row has exactly 2 action buttons: 👁 + ⋯', leg.length === 2 && leg.every(r => r.length === 2 && r[1] === '⋯'), leg);
  await page.evaluate(() => document.querySelector('#tb-leg tr td:last-child button[onclick^="_legRowMenu("]').click());
  await page.waitForTimeout(100);
  let m = await page.evaluate(() => Array.from(document.querySelectorAll('#leg-row-menu button')).map(b => b.textContent.trim()));
  check('⋯ menu: view / edit / delete', m.length === 3 && /צפייה/.test(m[0]) && /עריכה/.test(m[1]) && /מחיקה/.test(m[2]), m);
  await page.evaluate(() => document.querySelectorAll('#leg-row-menu button')[1].click());
  await page.evaluate(() => document.querySelector('#tb-leg tr td:last-child button[onclick^="_legRowMenu("]').click());
  await page.waitForTimeout(60);
  await page.evaluate(() => document.querySelectorAll('#leg-row-menu button')[2].click());
  let calls = await page.evaluate(() => window.__calls);
  check('edit → editLeg(L1); delete → askDel(leg, L1)', JSON.stringify(calls) === JSON.stringify([['editLeg', 'L1'], ['askDel', 'leg', 'L1']]), calls);
  await page.evaluate(() => document.querySelector('#tb-leg tr td:last-child button[onclick^="_legRowMenu("]').click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/density-leg-375.png' });
  await page.keyboard.press('Escape');

  console.log('\n2. NCR-types tree (admin)');
  const tree = await page.evaluate(() => { window.__calls = []; goPage('itype'); rItype(); return Array.from(document.querySelectorAll('#itype-tree > div')).map(d => Array.from(d.querySelectorAll('button')).map(b => b.textContent.trim())); });
  check('each node has exactly 1 button: ⋯', tree.length === 3 && tree.every(r => r.length === 1 && r[0] === '⋯'), tree);
  const openNode = (i) => page.evaluate((i) => { document.querySelectorAll('#itype-tree button[onclick^="_itypeRowMenu("]')[i].click(); }, i);
  await openNode(0); await page.waitForTimeout(80);
  m = await page.evaluate(() => Array.from(document.querySelectorAll('#itype-row-menu button')).map(b => b.textContent.trim()));
  check('level-1 node menu: add sub-type / edit / delete', m.length === 3 && /תת-סוג/.test(m[0]) && /עריכה/.test(m[1]) && /מחיקה/.test(m[2]), m);
  await page.evaluate(() => document.querySelectorAll('#itype-row-menu button')[0].click());
  await openNode(2); await page.waitForTimeout(80);
  m = await page.evaluate(() => Array.from(document.querySelectorAll('#itype-row-menu button')).map(b => b.textContent.trim()));
  check('level-3 node menu has no add-child: edit / delete', m.length === 2 && /עריכה/.test(m[0]) && /מחיקה/.test(m[1]), m);
  await page.evaluate(() => document.querySelectorAll('#itype-row-menu button')[1].click());
  calls = await page.evaluate(() => window.__calls);
  check('add-child → _itypeOpenAdd(2, C1); delete on V1 → askDel(issue_types, V1)', JSON.stringify(calls) === JSON.stringify([['_itypeOpenAdd', '2', 'C1'], ['askDel', 'issue_types', 'V1']]), calls);

  console.log('\n3. reporter (Phase B)');
  const rep = await page.evaluate(() => {
    window._currentUser = null; _applyRoleGates();
    goPage('leg'); rLeg();
    const vis = (el) => getComputedStyle(el).display !== 'none';
    const legMore = Array.from(document.querySelectorAll('#tb-leg button[onclick^="_legRowMenu("]')).filter(vis).length;
    const legView = Array.from(document.querySelectorAll('#tb-leg button[onclick^="showView("]')).filter(vis).length;
    rItype();
    const itMore = Array.from(document.querySelectorAll('#itype-tree button[onclick^="_itypeRowMenu("]')).filter(vis).length;
    // even if a reporter somehow triggers the menu, it carries no edit/delete
    _legRowMenu('L1', document.querySelector('#tb-leg button'));
    const items = Array.from(document.querySelectorAll('#leg-row-menu button')).map(b => b.textContent.trim());
    return { legMore, legView, itMore, items };
  });
  check('reporter: ⋯ hidden on laws and types, 👁 stays, forced menu has view only', rep.legMore === 0 && rep.legView === 2 && rep.itMore === 0 && rep.items.length === 1, rep);

  console.log('\n4. tasks rows on a phone (QA 2026-09-19): every cell on-screen, no sideways scroll, debug line hidden');
  const tk = await page.evaluate(() => {
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    const today = new Date().toISOString().substring(0, 10);
    DB.tasks = [{ id: 't1', title: 'משימת בדיקה', status: 'פתוח', due: today, assignee: 'דנה', priority: 'גבוה' }];
    goPage('tasks'); rTasks();
    const row = document.querySelector('#tb-tasks-cards .tsk-row');
    if (!row) return { row: false };
    const cells = Array.from(row.children).map(c => { const b = c.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) }; });
    const act = row.querySelector('.tsk-act'); const ab = act ? act.getBoundingClientRect() : null;
    const diag = document.getElementById('tsk-render-diag');
    return { row: true, n: cells.length, cells, actOn: !!ab && ab.left >= 0 && ab.right <= 376 && ab.width > 0, btns: act ? act.querySelectorAll('button').length : 0, mainW: document.getElementById('main').scrollWidth, docW: document.documentElement.scrollWidth, diagHidden: !diag || getComputedStyle(diag).display === 'none' };
  });
  check('task row renders 8 cells and every cell sits inside the 375px viewport', tk.row && tk.n === 8 && tk.cells.every(c => c.l >= 0 && c.r <= 376), tk);
  check('action buttons are on-screen (they sat at x<0 before) and the page has no sideways scroll', tk.actOn && tk.btns >= 2 && tk.mainW <= 375 && tk.docW <= 375, tk);
  check('the «מתרנדר N משימות» debug line is not visible to users', tk.diagHidden, tk);
  const sync = await page.evaluate(() => ((document.getElementById('emp-sync') || {}).textContent || '').replace(/\s+/g, ' ').trim());
  check('offline banner reads «כשיהיה חיבור», not the garbled «כשגליכה הוה»', /כשיהיה חיבור/.test(sync) && !/כשגליכה/.test(sync), sync);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
