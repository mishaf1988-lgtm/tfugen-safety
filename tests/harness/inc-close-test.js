// BACKLOG 8 (Michael, 01/10/2026): an incident is not closed without an
// investigation (rc or 5-Why) and a linked corrective task; incidents already
// closed are left alone; this year's uninvestigated incidents are a work list.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const Y = String(new Date().getFullYear());
  await page.evaluate((Y) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    DB.inc = [
      { id: 'a', d: 'מעידה במדרגות', dt: Y + '-03-01T08:00:00+00:00', sv: 'קל', s: 'פתוח' },
      { id: 'b', d: 'חתך ביד', dt: Y + '-02-01T08:00:00+00:00', sv: 'קל', s: 'סגור' },
      { id: 'c', d: 'נפילה מסולם', dt: Y + '-04-01T08:00:00+00:00', sv: 'חמור', s: 'פתוח', rc: 'אין נוהל עבודה בגובה' },
      { id: 'old', d: 'מכה בראש', dt: '2024-05-01T08:00:00+00:00', sv: 'קל', s: 'סגור' },
    ];
    DB.tasks = [];
    window.__alerts = []; window.alert = (m) => window.__alerts.push(String(m));
    window.__upd = 0; const o = window.sbUpd; window.sbUpd = function () { window.__upd++; };
    window._currentUser = { username: 'admin' }; _applyRoleGates();
  }, Y);

  const closeVia = (id) => page.evaluate((id) => {
    window.__alerts = []; window.__upd = 0;
    editInc(id); document.getElementById('i-st').value = 'סגור'; svInc();
    const rec = DB.inc.find(r => r.id === id);
    return { s: rec.s, alerts: window.__alerts, upd: window.__upd, open: document.getElementById('m-inc').style.display === 'block' };
  }, id);

  console.log('\n1. closing needs an investigation and a corrective task');
  let r = await closeVia('a');
  check('no investigation, no task: refused, says both, nothing saved, form stays open', r.s === 'פתוח' && r.upd === 0 && r.open && /חקירה/.test(r.alerts[0] || '') && /משימה מתקנת/.test(r.alerts[0] || ''), r);
  r = await closeVia('c');
  check('root cause but no task: refused, asks only for the task', r.s === 'פתוח' && r.upd === 0 && r.alerts.length === 1 && /משימה מתקנת/.test(r.alerts[0]) && !/סיבת שורש/.test(r.alerts[0]), r);
  await page.evaluate(() => { closeModal('m-inc'); DB.tasks.push({ id: 't1', title: 'נוהל עבודה בגובה', source_table: 'inc', source_id: 'c', status: 'פתוח' }); });
  r = await closeVia('c');
  check('root cause and a linked task: closes and saves', r.s === 'סגור' && r.upd === 1 && r.alerts.length === 0, r);
  await page.evaluate(() => { DB.tasks.push({ id: 't2', source_table: 'ncr', source_id: 'a' }); });
  r = await closeVia('a');
  check('a task linked to another table with the same id does not count', r.s === 'פתוח' && r.upd === 0, r);

  console.log('\n2. what is not blocked');
  r = await closeVia('b');
  check('an incident already closed (imported) can still be edited and saved', r.s === 'סגור' && r.upd === 1 && r.alerts.length === 0, r);
  const nw = await page.evaluate(() => {
    window.__alerts = []; window.__upd = 0;
    document.getElementById('i-id').value = ''; document.getElementById('i-d').value = 'אירוע חדש'; document.getElementById('i-st').value = 'סגור'; svInc();
    const refused = window.__alerts.length === 1 && !DB.inc.some(x => x.d === 'אירוע חדש');
    document.getElementById('i-st').value = 'בחקירה'; svInc();
    return { refused, saved: DB.inc.some(x => x.d === 'אירוע חדש' && x.s === 'בחקירה') };
  });
  check('a new incident cannot be born closed, but saves as "בחקירה"', nw.refused && nw.saved, nw);

  console.log('\n3. work list');
  const wl = await page.evaluate(() => {
    goPage('inc'); rInc();
    const pill = document.querySelector('#inc-summary [onclick^="_invOpen("]');
    return { text: pill ? pill.textContent : null, iid: pill ? pill.dataset.iid : null, todo: _incTodo().map(x => x.id) };
  });
  check('this year, no investigation, oldest first; investigated and other years left out', wl.todo[0] === 'b' && wl.todo[1] === 'a' && wl.todo.indexOf('c') < 0 && wl.todo.indexOf('old') < 0, wl.todo);
  check('pill shows the count and opens the oldest', wl.text && new RegExp(Y + ' בלי חקירה: ' + wl.todo.length).test(wl.text) && wl.iid === 'b', wl);
  const rep = await page.evaluate(() => { window._currentUser = { username: 'x', role: 'מדווח' }; document.body.classList.add('role-reporter'); const p = document.querySelector('#inc-summary [onclick^="_invOpen("]'); return p ? getComputedStyle(p).display : 'none'; });
  check('reporter: the pill is hidden', rep === 'none', rep);

  const real = errs.filter(e => !/Supabase|fetch|net::|Failed to load/i.test(e));
  check('no unexpected page errors', real.length === 0, real.slice(0, 5));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
