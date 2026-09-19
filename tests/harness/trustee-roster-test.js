// Roster: the manager keeps the list of trustees in the app; pickers offer it;
// the leaderboard shows every active trustee even with zero reports.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(800);
  const M = new Date().toISOString().substring(0, 7);

  console.log('\n1. wiring + manager roster editor');
  const w = await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','trustee_reports'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window.__toasts = []; window.toast = (m) => { window.__toasts.push(String(m)); };
    window.__ops = []; const oi = window.sbIns, ou = window.sbUpd; window.sbIns = function (t, r) { window.__ops.push(['ins', t, r.n]); return oi(t, r); }; window.sbUpd = function (t, r) { window.__ops.push(['upd', t, r.n, r.active]); return ou(t, r); };
    localStorage.setItem('tfgn2', JSON.stringify({ trustees: [{ id: 'c1', n: 'x', active: true }] })); DB.trustees = undefined; ldb(); const cached = DB.trustees.length === 1; localStorage.removeItem('tfgn2');
    const asked = []; const og = window.sbGet; window.sbGet = (t) => { asked.push(t); return Promise.resolve(null); }; sbSync(true); window.sbGet = og;
    DB.trustees = [{ id: 'tru_01', n: 'לב', dep: 'ייצור ואריזה', active: true }, { id: 'tru_02', n: 'גלינה', dep: 'מעבדה', active: true }, { id: 'tru_09', n: 'עזב', dep: 'אחזקה', active: false }];
    DB.trustee_reports = [{ id: 'r1', u: 'גלינה', t: 1, ok: true, s: 'תקין', d: new Date().toISOString().substring(0, 10), m: new Date().toISOString().substring(0, 7) }];
    window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('trustees');
    const board = _truBoard(new Date().toISOString().substring(0, 7)).map(x => x.u + ':' + x.total);
    _truRosterOpen();
    const rows = Array.from(document.querySelectorAll('#tru-roster-list [data-tru-roster]')).map(r => ({ id: r.dataset.truRoster, struck: !!r.querySelector('strong[style*="line-through"]'), btn: r.querySelector('button').textContent.trim() }));
    return { cached, asked: asked.includes('trustees'), ts: _sbTsCol.trustees, backup: _BACKUP_TABLES.includes('trustees'), board, open: document.getElementById('m-tru-roster').style.display === 'block', rows };
  });
  check('trustees in ldb / sbSync / ts / backup', w.cached && w.asked && w.ts === 'ts' && w.backup, w);
  check('leaderboard lists every active trustee even with 0 reports (גלינה 10, לב 0), not the inactive one', w.board.join(' ') === 'גלינה:10 לב:0', w.board);
  check('roster editor opens with 3 rows, inactive one struck through with "הפעל"', w.open && w.rows.length === 3 && w.rows[2].id === 'tru_09' && w.rows[2].struck && w.rows[2].btn === 'הפעל' && w.rows[0].btn === 'השבת', w.rows);
  const a = await page.evaluate(() => {
    document.getElementById('tru-roster-n').value = ''; _truRosterAdd(); const t1 = window.__toasts.slice(-1)[0];
    document.getElementById('tru-roster-n').value = 'לב'; _truRosterAdd(); const t2 = window.__toasts.slice(-1)[0];
    document.getElementById('tru-roster-n').value = 'מוסא'; document.getElementById('tru-roster-dep').value = 'חומר גלם'; _truRosterAdd();
    const added = DB.trustees.find(t => t.n === 'מוסא');
    _truRosterToggle('tru_01'); const lev = DB.trustees.find(t => t.id === 'tru_01');
    const rows = Array.from(document.querySelectorAll('#tru-roster-list [data-tru-roster]')).map(r => r.dataset.truRoster);
    const board = _truBoard(new Date().toISOString().substring(0, 7)).map(x => x.u + ':' + x.total);
    return { t1, t2, added: added && added.dep === 'חומר גלם' && added.active === true, ops: window.__ops, lev: lev.active, rows, board, cleared: document.getElementById('tru-roster-n').value === '' };
  });
  check('add: empty name refused, duplicate refused, new trustee saved (sbIns) with department, inputs cleared', /חובה/.test(a.t1) && /כבר/.test(a.t2) && a.added && a.ops.some(o => o[0] === 'ins' && o[1] === 'trustees' && o[2] === 'מוסא') && a.cleared, a);
  check('toggle: לב deactivated (sbUpd active=false), sinks to the bottom, leaves the board', a.lev === false && a.ops.some(o => o[0] === 'upd' && o[2] === 'לב' && o[3] === false) && a.rows.slice(-2).includes('tru_01') && a.rows.slice(-2).includes('tru_09') && a.board.join(' ') === 'גלינה:10 מוסא:0', a);
  const dl = await page.evaluate(() => { closeModal('m-tru-roster'); return !!document.querySelector('#tru-roster-list [onclick^="askDel(\'trustees\'"]'); });
  check('delete goes through the password-protected askDel', dl);

  console.log('\n2. pickers');
  const p = await page.evaluate(() => {
    _truReport(3);
    const opts = Array.from(document.querySelectorAll('#tru-u option')).map(o => o.value);
    document.getElementById('tru-u').value = 'מוסא'; _truUChanged('מוסא'); const otherHidden = getComputedStyle(document.getElementById('tru-u-other')).display === 'none';
    document.getElementById('tru-u').value = '__other__'; _truUChanged('__other__'); const otherShown = getComputedStyle(document.getElementById('tru-u-other')).display !== 'none';
    document.getElementById('tru-u-other').value = 'אורח'; const val = _truNameVal('tru-u', 'tru-u-other');
    closeModal('m-tru');
    return { opts, otherHidden, otherShown, val };
  });
  check('report form picker: active roster (גלינה, מוסא), not the deactivated לב/עזב, past reporters, then "אחר" with a free-text input', p.opts.includes('גלינה') && p.opts.includes('מוסא') && !p.opts.includes('לב') && !p.opts.includes('עזב') && p.opts[p.opts.length - 1] === '__other__' && p.otherHidden && p.otherShown && p.val === 'אורח', p);
  const e = await page.evaluate(() => {
    localStorage.removeItem('tfgn_trustee_name'); window.sbGet = () => Promise.resolve(null);
    document.body.classList.remove('emp-mode'); doEmpLogin();
    const opts = Array.from(document.querySelectorAll('#tru-me option')).map(o => o.value);
    document.getElementById('tru-me').value = 'גלינה'; _truMeChanged('גלינה');
    const stored = localStorage.getItem('tfgn_trustee_name'); const score = document.querySelector('#tru-score .n').textContent;
    _truMeChanged('__other__'); const otherShown = getComputedStyle(document.getElementById('tru-me-other')).display !== 'none';
    document.getElementById('tru-me-other').value = 'אורחת'; _truSetMe('אורחת');
    return { opts, stored, score, otherShown, stored2: localStorage.getItem('tfgn_trustee_name'), sel: document.getElementById('tru-me').value };
  });
  check('trustee screen picker: same roster; picking גלינה stores the name and shows her 10 points; "אחר" reveals the text input and keeps the typed name', e.opts.includes('גלינה') && !e.opts.includes('לב') && e.stored === 'גלינה' && e.score === '10/100' && e.otherShown && e.stored2 === 'אורחת' && e.sel === '__other__', e);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
