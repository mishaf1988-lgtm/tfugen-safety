// B1 check: Incident Investigation Agent — intake → 5-Why (AI mocked) → save
// to inc.five_why / inc.r → CAPA task / NCR prefill; hub + view launchers;
// reporters get no launcher.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const OUT = require('os').tmpdir();
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const FIVE_WHY = '1. למה זה קרה?\n   המלגזה נסעה מהר\n2. למה המלגזה נסעה מהר?\n   אין הגבלת מהירות\n3. למה אין הגבלה?\n   לא הוגדרה\n4. למה לא הוגדרה?\n   אין נוהל\n5. למה אין נוהל?\n   [אין בעלים לנהלי ציוד נייד]';

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate((FIVE_WHY) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    DB.inc = [
      { id: 'i1', d: 'פועל נפגע ממלגזה במחסן', dt: '2026-09-10T08:30', ty: 'בטיחותי', sv: 'חמור', l: 'מחסן', s: 'פתוח' },
      { id: 'i2', d: 'החלקה ברצפה רטובה', dt: '2026-09-15T11:00', ty: 'בטיחותי', sv: 'קל', s: 'פתוח' },
    ];
    window.__calls = [];
    const spy = (n) => { const o = window[n]; window[n] = function () { window.__calls.push([n].concat(Array.from(arguments).map(a => (a && a.id) ? 'rec:' + a.id : String(a)))); return o ? o.apply(this, arguments) : undefined; }; };
    spy('sbUpd'); spy('openTskModal');
    window.confirm = () => false;
    // Mock the AI endpoint (relative /api/claude on a file:// page).
    const realFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/api/claude') >= 0) { window.__aiCalls = (window.__aiCalls || 0) + 1; return Promise.resolve(new Response(JSON.stringify({ content: [{ text: FIVE_WHY }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })); }
      return realFetch.apply(this, arguments);
    };
    window._currentUser = { username: 'admin' }; _applyRoleGates();
  }, FIVE_WHY);

  console.log('\n1. intake');
  const intake = await page.evaluate(() => { _invOpen('i1'); const sel = document.getElementById('inv-inc'); return { open: document.getElementById('m-inv').style.display === 'block', opts: sel.options.length, picked: sel.value, facts: document.getElementById('inv-facts').textContent, fw: document.getElementById('inv-fw').value, rc: document.getElementById('inv-rc').value }; });
  check('modal opens on the given incident with its facts', intake.open && intake.picked === 'i1' && /מלגזה/.test(intake.facts) && /חמור/.test(intake.facts), intake);
  check('incident select lists both incidents (+ placeholder)', intake.opts === 3, intake.opts);
  check('5-Why and root-cause start empty for a fresh incident', intake.fw === '' && intake.rc === '', intake);

  console.log('\n2. AI 5-Why');
  await page.evaluate(() => _invAI());
  await page.waitForTimeout(200);
  const ai = await page.evaluate(() => ({ fw: document.getElementById('inv-fw').value, rc: document.getElementById('inv-rc').value, calls: window.__aiCalls, btn: document.getElementById('inv-ai-btn').disabled }));
  check('AI suggestion fills the 5-Why textarea (endpoint called once)', ai.calls === 1 && /5\. למה אין נוהל/.test(ai.fw), { calls: ai.calls, fw: ai.fw.slice(0, 40) });
  check('root cause pre-filled from the last "why" (brackets stripped)', ai.rc === 'אין בעלים לנהלי ציוד נייד', ai.rc);
  check('AI button re-enabled', ai.btn === false);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/inv-modal-375.png' });

  console.log('\n3. save');
  const saved = await page.evaluate(() => { document.getElementById('inv-rc').value = 'אין בעלים לנהלי ציוד נייד'; _invSave(); const rec = DB.inc.find(r => r.id === 'i1'); return { fw: rec.five_why, r: rec.r, calls: window.__calls.filter(c => c[0] === 'sbUpd') }; });
  check('saved to the existing fields inc.five_why and inc.r', /5\. למה/.test(saved.fw) && saved.r === 'אין בעלים לנהלי ציוד נייד', { r: saved.r });
  check('sbUpd("inc", rec) called once', saved.calls.length === 1 && saved.calls[0][1] === 'inc' && saved.calls[0][2] === 'rec:i1', saved.calls);

  console.log('\n4. follow-ups');
  const capa = await page.evaluate(() => { window.__calls = []; _invCapa(); return { calls: window.__calls, invClosed: document.getElementById('m-inv').style.display !== 'block' }; });
  check('CAPA task → openTskModal("inc","i1"), investigation modal closed', capa.calls.length === 1 && capa.calls[0].join() === 'openTskModal,inc,i1' && capa.invClosed, capa);
  const ncr = await page.evaluate(() => { closeModal('m-tsk'); _invOpen('i1'); _invNcr(); return { ncrOpen: document.getElementById('m-ncr').style.display === 'block', d: document.getElementById('ncr-d').value, rc: document.getElementById('ncr-rc').value, sd: document.getElementById('ncr-sd').value, notes: document.getElementById('ncr-notes').value }; });
  check('open NCR → NCR modal prefilled with description, root cause, date and the 5-Why in notes', ncr.ncrOpen && /מלגזה/.test(ncr.d) && ncr.rc === 'אין בעלים לנהלי ציוד נייד' && ncr.sd === '2026-09-10' && /5-Why/.test(ncr.notes), ncr);
  await page.evaluate(() => closeModal('m-ncr'));

  console.log('\n5. launchers');
  const launch = await page.evaluate(() => {
    goPage('agents');
    const card = Array.from(document.querySelectorAll('#agents-cards .card')).find(c => /Incident Investigation/.test(c.textContent));
    const hub = { soon: /בבנייה/.test(card.textContent), launcher: Array.from(card.querySelectorAll('button')).map(b => b.getAttribute('onclick')) };
    showView('inc', 'i2');
    const btn = Array.from(document.querySelectorAll('#view-body button')).find(b => /_invOpen\(/.test(b.getAttribute('onclick') || ''));
    return { hub, viewBtn: !!btn, viewBtnVisible: btn ? getComputedStyle(btn).display !== 'none' : null };
  });
  check('hub card is no longer a placeholder and launches the agent', !launch.hub.soon && launch.hub.launcher.some(o => /_invOpen\(\)/.test(o)), launch.hub);
  check('incident view has a "full investigation" launcher', launch.viewBtn && launch.viewBtnVisible, launch);
  const noId = await page.evaluate(() => { _invOpen(); const v = document.getElementById('inv-inc').value; closeModal('m-inv'); return v; });
  check('hub launcher without an id preselects the newest incident', noId === 'i2', noId);
  const rep = await page.evaluate(() => { window._currentUser = null; _applyRoleGates(); showView('inc', 'i2'); const btn = Array.from(document.querySelectorAll('#view-body button')).find(b => /_invOpen\(/.test(b.getAttribute('onclick') || '')); return btn ? getComputedStyle(btn).display : 'missing'; });
  check('reporter: the launcher is hidden (Phase B)', rep === 'none', rep);
  const empty = await page.evaluate(() => { window._currentUser = { username: 'admin' }; _applyRoleGates(); DB.inc = []; _invOpen(); const facts = document.getElementById('inv-facts').textContent; document.getElementById('inv-fw').value = 'x'; _invSave(); return { facts, err: document.getElementById('inv-err').textContent, t: document.querySelector('#toast') ? 1 : 0 }; });
  check('no incidents: clear message and save refused', /אין תקריות/.test(empty.facts), empty);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
