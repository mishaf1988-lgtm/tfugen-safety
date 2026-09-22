// Roles Phase B (A4) check: on every page a reporter can reach, no edit /
// delete affordance is visible; managers still see them; creation stays.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const EDIT_DEL = /^(askDel\(|delById\(|delAll|editTsk\(|editNcr\(|editInc\(|_roundEdit\(|eqiEdit\(|editLeg\(|editEasp\(|editUser\(|editPrj\(|editLoc\(|editItype\(|editItp\(|_eqiClone\(|_eqiRemoveFile\(|_tskMenu\()/;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().split('T')[0];
  await page.evaluate((today) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    DB.tasks = [{ id: 't1', title: 'משימה', status: 'פתוח', due: today, ts: today }];
    DB.near_miss = [{ id: 'm1', descr: 'כמעט', d: today, s: 'פתוח', ts: today }];
    DB.inc = [{ id: 'i1', d: 'תקרית', dt: today + 'T08:00', sv: 'קל', s: 'פתוח' }];
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', s: 'פתוח', p: 'גבוה', d: 'x', ts: today }];
    DB.rounds = [{ id: 'r1', d: today, by: 'x', ts: today }];
    DB.toolbox = [{ id: 'b1', d: today, topic: 'שיחה', ts: today }];
  }, iso(today));

  const scan = (pageId) => page.evaluate((pageId) => {
    goPage(pageId);
    const pg = document.getElementById('pg-' + pageId);
    const all = Array.from(pg.querySelectorAll('[onclick]'));
    const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; let p = el.parentElement; while (p && p !== document.body) { if (getComputedStyle(p).display === 'none') return false; p = p.parentElement; } return true; };
    const re = /^(askDel\(|delById\(|delAll|editTsk\(|editNcr\(|editInc\(|_roundEdit\(|eqiEdit\(|editLeg\(|editEasp\(|editUser\(|editPrj\(|editLoc\(|editItype\(|editItp\(|_eqiClone\(|_eqiRemoveFile\(|_tskMenu\()/;
    const ed = all.filter(el => re.test(el.getAttribute('onclick') || ''));
    // "add" = any primary (btn-p) button on the page — creation must survive for reporters.
    const add = Array.from(pg.querySelectorAll('button.btn-p'));
    return { cur: window.CUR, editDelTotal: ed.length, editDelVisible: ed.filter(vis).length, addVisible: add.filter(vis).length, roleClass: document.body.className.split(' ').filter(c => /^role-/.test(c)).join(',') };
  }, pageId);
  // Since 2026-09-22 a reporter reaches only the pages the database will
  // actually accept work on, so the five creation flows below are a
  // manager-and-up set. What a reporter sees is checked in its own section.
  const PAGES = ['tasks', 'nm', 'inc', 'ncr', 'round', 'toolbox'];
  const REPORTER_PAGES = ['tasks'];

  console.log('\n1. reporter');
  await page.evaluate(() => { window._currentUser = null; _applyRoleGates(); });
  for (const p of REPORTER_PAGES) {
    const r = await scan(p);
    check(p + ': ' + r.editDelTotal + ' edit/delete affordances rendered, 0 visible; add stays (' + r.addVisible + ')', r.cur === p && r.editDelTotal > 0 && r.editDelVisible === 0 && (p === 'tasks' || p === 'toolbox' || r.addVisible > 0), r);
  }
  // And the five that were taken away really are refused, not merely hidden:
  // goPage sends a reporter back to the dashboard.
  for (const p of PAGES.filter((x) => REPORTER_PAGES.indexOf(x) < 0)) {
    const r = await scan(p);
    check(p + ': a reporter is sent back to the dashboard', r.cur === 'dash', r);
  }
  check('body carries role-reporter only', (await page.evaluate(() => document.body.className.split(' ').filter(c => /^role-/.test(c)).join(','))) === 'role-reporter');
  await page.evaluate(() => goPage('tasks'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/roles-reporter-tasks-375.png' });

  console.log('\n2. manager');
  await page.evaluate(() => { window._currentUser = { username: 'mgr', role: 'מנהל' }; _applyRoleGates(); });
  for (const p of PAGES) {
    const r = await scan(p);
    check(p + ': manager sees the edit/delete buttons again (' + r.editDelVisible + '/' + r.editDelTotal + ')', r.editDelVisible === r.editDelTotal && r.editDelTotal > 0, r);
  }
  check('body carries role-manager only', (await page.evaluate(() => document.body.className.split(' ').filter(c => /^role-/.test(c)).join(','))) === 'role-manager');
  await page.evaluate(() => goPage('nm'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/roles-manager-nm-375.png' });

  console.log('\n3. admin');
  await page.evaluate(() => { window._currentUser = { username: 'admin' }; _applyRoleGates(); });
  const a = await scan('ncr');
  check('admin sees everything on NCR', a.editDelVisible === a.editDelTotal && a.editDelTotal > 0, a);
  check('body carries role-admin only', (await page.evaluate(() => document.body.className.split(' ').filter(c => /^role-/.test(c)).join(','))) === 'role-admin');

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  // Michael, 2026-09-22, asked whether an ordinary user should reach the whole
  // system. The answer that mattered was not about seeing too much: a reporter
  // was offered five creation forms whose tables the database had closed to
  // them in April, so they could fill one in and have the write refused.
  //
  // This is the pair that has to hold. A page in the reporter's list whose
  // table is admin/manager-only in the migrations is a form that fails, and
  // the repo can prove that much on its own.
  console.log('\nreporter pages and database rules agree');
  {
    const fsx = require('fs'), px = require('path');
    const MIG = px.resolve(__dirname, '../../migrations');
    const sql = fsx.readdirSync(MIG).filter((f) => f.endsWith('.sql'))
      .map((f) => fsx.readFileSync(px.join(MIG, f), 'utf8')).join('\n');
    // Tables whose access was handed to is_admin_manager(). Stage 2 wrote one
    // DROP per table before each CREATE, which is the complete list.
    const locked = new Set((sql.match(/DROP POLICY IF EXISTS admin_all ON ([a-z_]+)/g) || [])
      .map((m) => m.split(' ON ')[1]).filter((t) => t !== 'public'));
    const r = await page.evaluate(() => ({
      pages: Object.keys(window._REPORTER_PAGES || {}),
      primary: window._PAGE_PRIMARY || {},
    }));
    const clash = r.pages.filter((pg) => r.primary[pg] && locked.has(r.primary[pg]))
      .map((pg) => pg + ' -> ' + r.primary[pg]);
    check('no reporter page writes to a table the database closed to them', clash.length === 0, clash);
    // And the narrowing really happened: these five were the ones that failed.
    ['nm', 'inc', 'round', 'toolbox', 'ncr'].forEach((pg) => {
      check('...' + pg + ' is no longer offered to a reporter', r.pages.indexOf(pg) < 0, r.pages);
    });
    check('what is left is what works', r.pages.sort().join(',') === 'dash,emp-home,menu,tasks,view', r.pages);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
