// Viewer («צופה», 2026-09-24): reads what a manager reads, changes nothing.
//
// The database is what refuses a viewer's writes (viewer_no_* policies,
// migrations/2026-09-24_viewer_mfa_active.sql, verified on the live DB). This
// checks the browser half: the viewer reaches the manager's pages, sees no way
// to start, edit or delete a record, and nothing a viewer does -- or anything
// the app does on its own while a viewer walks every page -- lands in the
// outbox. The manager is checked the same way, so a selector that matches
// nothing cannot pass for "hidden".
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const SRC = path.resolve(__dirname, '../../index.html');
const HTML = 'file://' + SRC;
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const VIEWER = 'צופה';

(async () => {
  console.log('\n0. one spelling of the role, in the app and in the database');
  const src = fs.readFileSync(SRC, 'utf8');
  const mig = fs.readFileSync(path.resolve(__dirname, '../../migrations/2026-09-24_viewer_mfa_active.sql'), 'utf8');
  const dec = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const ent = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  const roleLine = dec((src.match(/if\(r==='([^']+)'\)return 'viewer';/) || [])[1] || '');
  check('_role() maps «' + VIEWER + '» to viewer', roleLine === VIEWER, roleLine);
  check('is_viewer() in the migration reads the same word', mig.includes("u.role = '" + VIEWER + "'"));
  for (const sel of ['nu-role', 'u-role']) {
    const m = src.match(new RegExp('<select id="' + sel + '"[\\s\\S]*?</select>'));
    const vals = m ? [...m[0].matchAll(/<option value="([^"]+)"/g)].map((x) => ent(x[1])) : [];
    check(sel + ' offers ' + VIEWER + ' (' + vals.join(', ') + ')', vals.includes(VIEWER) && vals.length === 4, vals);
  }

  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','itp'].forEach((k) => { if (!DB[k]) DB[k] = []; });
    DB.tasks = [{ id: 't1', title: 'משימה', status: 'פתוח', due: today, ts: today }];
    DB.near_miss = [{ id: 'm1', descr: 'כמעט', d: today, s: 'פתוח', ts: today }];
    DB.inc = [{ id: 'i1', d: 'תקרית', dt: today + 'T08:00', sv: 'קל', s: 'פתוח' }];
    DB.ncr = [{ id: 'n1', num: 'NCR-0001', s: 'פתוח', p: 'גבוה', d: 'x', ts: today }];
    DB.rounds = [{ id: 'r1', d: today, by: 'x', ts: today }];
    DB.toolbox = [{ id: 'b1', d: today, topic: 'שיחה', ts: today }];
    DB.leg = [{ id: 'l1', n: 'חוק', t: 'חוק', a: 'כללי' }];
    DB.locations = [{ id: 'loc1', name: 'אולם', level: 1 }];
    DB.projects = [{ id: 'p1', name: 'פרויקט', status: 'פעיל' }];
    DB.equip_inspections = [{ id: 'e1', name: 'מלגזה', e: today }];
    DB.env_aspects = [{ id: 'ea1', aspect: 'פסולת', activity: 'x' }];
    DB.inspection_types = [{ id: 'it1', name: 'בדיקה', level: 1 }];
    DB.docs = [{ id: 'd1', n: 'נוהל', e: today }];
  });

  // What the viewer must not see: every way to delete, edit, or start a record.
  const scan = () => page.evaluate(() => {
    const re = /^(askDel\(|delById\(|delAll|edit|eqiEdit\(|_roundEdit\(|_eqiClone\(|_eqiRemoveFile\(|_tskMenu\(|_legRowMenu\(|_itypeRowMenu\(|_invOpen\(|_itpDone\(|_truCloseReport\(|_truRosterEdit\(|_truTasksEdit\(|_truTasksDel\(|_ncrCommentAdd\(|_ncrFb\(|openNew|openTskModal\(|_roundOpenNew\(|capOpen\()|OpenAdd\(|^openModal\((?![^)]*-sheet)/;
    const vis = (el) => { if (!el.isConnected) return false; for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
    const pg = document.getElementById('pg-' + CUR);
    const all = Array.from((pg || document).querySelectorAll('[onclick]')).concat(Array.from(document.querySelectorAll('#cap-fab')));
    const hits = all.filter((el) => re.test(el.getAttribute('onclick') || '') || el.id === 'cap-fab');
    return { cur: CUR, total: hits.length, visible: hits.filter(vis).map((el) => (el.getAttribute('onclick') || el.id).slice(0, 40)) };
  });
  const pagesOf = () => page.evaluate(() => Object.keys(_MANAGER_PAGES).filter((p) => !_ADMIN_ONLY_PAGES[p] && document.getElementById('pg-' + p)));

  console.log('\n1. manager: the same scan finds the buttons (so "0 visible" below means hidden, not absent)');
  await page.evaluate(() => { window._currentUser = { username: 'mgr', role: 'מנהל' }; _applyRoleGates(); });
  const PAGES = await pagesOf();
  let mgrVisible = 0;
  const mgrPages = [];
  for (const p of PAGES) {
    await page.evaluate((p) => goPage(p), p);
    const r = await scan();
    mgrVisible += r.visible.length;
    if (r.visible.length) mgrPages.push(p);
  }
  check('a manager sees ' + mgrVisible + ' edit/delete/new buttons across ' + mgrPages.length + ' pages', mgrVisible >= 20 && mgrPages.length >= 8, mgrPages);
  check('no view-only banner for a manager', await page.evaluate(() => getComputedStyle(document.getElementById('view-only-bar')).display === 'none'));

  console.log('\n2. viewer: every manager page, none of the buttons');
  await page.evaluate(() => {
    localStorage.setItem('tfgn_outbox', '[]');
    window._currentUser = { username: 'qwer', role: 'צופה' };
    window.__toasts = [];
    const t = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return t.apply(this, arguments); };
    _applyRoleGates();
  });
  check('body carries role-viewer only', (await page.evaluate(() => document.body.className.split(' ').filter((c) => /^role-/.test(c)).join(','))) === 'role-viewer');
  const bar = await page.evaluate(() => { const b = document.getElementById('view-only-bar'); return { h: b.offsetHeight, t: b.textContent }; });
  check('the view-only banner shows (' + bar.t + ')', bar.h > 0 && /צפייה/.test(bar.t), bar);
  check('the modules entry in the bottom bar is there, as for a manager', await page.evaluate(() => { const b = document.getElementById('bn-modules'); return !b || b.style.display !== 'none'; }));
  const leaks = [];
  let reached = 0;
  for (const p of PAGES) {
    await page.evaluate((p) => goPage(p), p);
    const r = await scan();
    if (r.cur === p) reached++;
    if (r.visible.length) leaks.push(p + ': ' + r.visible.join(' | '));
  }
  check('the viewer reaches all ' + PAGES.length + ' manager pages (' + reached + ')', reached === PAGES.length);
  check('no edit/delete/new button visible on any of them', leaks.length === 0, leaks.slice(0, 6));
  const walk = await page.evaluate(() => ({ ob: JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').length, toasts: window.__toasts.filter((t) => /צפייה/.test(t)) }));
  check('walking every page wrote nothing on its own (outbox ' + walk.ob + ')', walk.ob === 0, walk);
  check('and raised no view-only toast on its own', walk.toasts.length === 0, walk.toasts);
  const adm = await page.evaluate(() => { const p = Object.keys(_ADMIN_ONLY_PAGES)[0]; goPage(p); return { p, cur: CUR }; });
  check('an admin-only page (' + adm.p + ') still sends the viewer home', adm.cur === 'dash', adm);

  console.log('\n3. viewer: every way a change starts is stopped, and says why');
  const w = await page.evaluate(() => {
    window.__toasts = [];
    const shown = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    sbIns('near_miss', { id: 'x1', descr: 'x' });
    sbUpd('near_miss', { id: 'm1', s: 'סגור' });
    sbDel('near_miss', 'm1');
    askDel('near_miss', 'm1');
    const delOpen = shown('m-del') || shown('del-modal') || !!(window._delPending && window._delPending.id === 'm1');
    _aud('ins', 'near_miss', { id: 'x2' });
    openModal('m-nm');
    const formOpen = shown('m-nm');
    openModal('m-modules-sheet');
    const sheetOpen = shown('m-modules-sheet');
    closeModal('m-modules-sheet');
    // Legacy direct-REST write paths that do not pass through sbIns (the DB
    // refuses them too; the client should still stop them cleanly).
    _ncrCommentAdd('n1');
    _ncrFb('n1', 'up');
    return { ob: JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').length, near: DB.near_miss.length, toasts: window.__toasts.filter((t) => /צפייה/.test(t)).length, delOpen, formOpen, sheetOpen };
  });
  check('sbIns / sbUpd / sbDel / _aud put nothing in the outbox', w.ob === 0, w);
  check('the delete confirmation never opens', !w.delOpen, w);
  check('a new-record form does not open', !w.formOpen, w);
  check('the legacy NCR-comment and AI-feedback writes are stopped too (7 toasts)', w.toasts === 7, w);
  check('navigation sheets still open', w.sheetOpen, w);

  console.log('\n4. the role hint an admin reads when choosing it');
  const hint = await page.evaluate(() => { const s = document.getElementById('nu-role'); s.value = 'צופה'; _roleHint('nu-role', 'nu-role-hint'); return document.getElementById('nu-role-hint').textContent; });
  check('choosing צופה explains it (' + hint.slice(0, 40) + '...)', /לא עורך/.test(hint) && /מנהל/.test(hint), hint);
  check('the hint uses keyboard characters only', !/[—–־«»“”„‘’←→↔·…]/.test(hint), hint);

  console.log('\n5. back to manager: everything returns');
  const back = await page.evaluate(() => {
    window._currentUser = { username: 'mgr', role: 'מנהל' }; _applyRoleGates();
    localStorage.setItem('tfgn_outbox', '[]');
    sbIns('near_miss', { id: 'x3', descr: 'x' });
    openModal('m-nm');
    const formOpen = getComputedStyle(document.getElementById('m-nm')).display !== 'none';
    closeModal('m-nm');
    return { ob: JSON.parse(localStorage.getItem('tfgn_outbox') || '[]').length, formOpen, bar: getComputedStyle(document.getElementById('view-only-bar')).display, cls: document.body.classList.contains('role-viewer') };
  });
  check('a manager writes again (outbox ' + back.ob + ')', back.ob >= 1, back);
  check('a manager opens the form', back.formOpen, back);
  check('banner and role-viewer are gone', back.bar === 'none' && !back.cls, back);

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
