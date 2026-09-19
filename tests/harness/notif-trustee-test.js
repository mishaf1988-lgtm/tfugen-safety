// App side of the trustee-hazard notification: matrix row, recipients saved
// with the prefs, the test button, and the in-app toast on a live hazard.
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
  const s = await page.evaluate(() => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox','trustee_reports','notification_prefs','notifications_log'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window.__toasts = []; window.toast = (m) => { window.__toasts.push(String(m)); };
    window.__ops = []; const oi = window.sbIns, ou = window.sbUpd; window.sbIns = function (t, r) { window.__ops.push(['ins', t]); return oi(t, r); }; window.sbUpd = function (t, r) { window.__ops.push(['upd', t]); return ou(t, r); };
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    openNotifSettings();
    const row = Array.from(document.querySelectorAll('#notif-table tbody tr')).find(tr => /נאמן/.test(tr.textContent));
    return { open: document.getElementById('m-notif').style.display === 'block', row: !!row, boxes: row ? row.querySelectorAll('input[type=checkbox]').length : 0, fields: !!document.getElementById('notif-tru-wa') && !!document.getElementById('notif-tru-email'), btn: !!document.querySelector('#notif-trustee-box button') };
  });
  check('settings: a "ליקוי מנאמן בטיחות" row with 3 channel boxes, recipient fields and a test button', s.open && s.row && s.boxes === 3 && s.fields && s.btn, s);
  const sv = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#notif-table tbody tr')).find(tr => /נאמן/.test(tr.textContent));
    row.querySelector('input[data-ch="whatsapp"]').checked = true; row.querySelector('input[data-ch="inapp"]').checked = true;
    document.getElementById('notif-tru-wa').value = '+972 50-123 4567'; document.getElementById('notif-tru-email').value = 'sviva@tapugan.co.il';
    saveNotifSettings();
    const p = _notifPrefs().trustee_hazard;
    openNotifSettings();
    return { p, wa: document.getElementById('notif-tru-wa').value, em: document.getElementById('notif-tru-email').value, op: window.__ops.slice(-1)[0], closedThenReopened: document.getElementById('m-notif').style.display === 'block' };
  });
  check('save: the event flags + digits-only number + email land in prefs.trustee_hazard, written to notification_prefs, and reload into the fields', sv.p && sv.p.whatsapp === true && sv.p.inapp === true && sv.p.email === false && sv.p.whatsapp_to === '972501234567' && sv.p.email_to === 'sviva@tapugan.co.il' && sv.wa === '972501234567' && sv.em === 'sviva@tapugan.co.il' && sv.op && sv.op[1] === 'notification_prefs', sv);
  const rec = await page.evaluate(() => { _notifEnableRecommended(); const p = _notifPrefs().trustee_hazard; return p; });
  check('"enable recommended" keeps the recipients', rec.inapp === true && rec.whatsapp === true && rec.whatsapp_to === '972501234567' && rec.email_to === 'sviva@tapugan.co.il', rec);
  const t = await page.evaluate(async () => {
    window.__posted = null; window._sbToken = 'tok'; window._sbAuth = () => Promise.resolve({});
    window.fetch = (url, init) => { window.__posted = { url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization }; return Promise.resolve(new Response(JSON.stringify({ ok: true, test: true, whatsapp: 'sent', email: 'error: RESEND_KEY missing in Cloudflare env' }), { status: 200, headers: { 'Content-Type': 'application/json' } })); };
    document.getElementById('notif-tru-email').value = 'sviva@tapugan.co.il';
    _truNotifyTest(); await new Promise(r => setTimeout(r, 50));
    return { posted: window.__posted, res: document.getElementById('notif-tru-test-res').textContent };
  });
  check('test button: POSTs {test:true, numbers from the screen} with the session, shows per-channel result', t.posted && /\/api\/trustee-notify$/.test(t.posted.url) && t.posted.body.test === true && t.posted.body.whatsapp_to === '972501234567' && t.posted.body.email_to === 'sviva@tapugan.co.il' && t.posted.auth === 'Bearer tok' && /WhatsApp: נשלח/.test(t.res) && /RESEND_KEY/.test(t.res), t);
  const e = await page.evaluate(async () => { document.getElementById('notif-tru-wa').value = ''; document.getElementById('notif-tru-email').value = ''; _truNotifyTest(); await new Promise(r => setTimeout(r, 20)); return document.getElementById('notif-tru-test-res').textContent; });
  check('test with nothing filled in explains instead of calling the server', /מלא/.test(e), e);
  const rt = await page.evaluate(() => {
    closeModal('m-notif'); window.__toasts = [];
    _rtApply('trustee_reports', { eventType: 'INSERT', new: { id: 'live1', u: 'דנה', t: 5, ok: false, f: 'מטף ללא פלומבה', s: 'פתוח' } });
    const a = window.__toasts.slice(-1)[0] || '';
    _rtApply('trustee_reports', { eventType: 'INSERT', new: { id: 'live2', u: 'דנה', t: 2, ok: true, s: 'תקין' } });
    const b = window.__toasts.length;
    const p = _notifPrefs(); p.trustee_hazard.inapp = false;
    _rtApply('trustee_reports', { eventType: 'INSERT', new: { id: 'live3', u: 'רון', t: 1, ok: false, f: 'x', s: 'פתוח' } });
    return { a, b, c: window.__toasts.length, inDb: DB.trustee_reports.filter(r => /^live/.test(r.id)).length };
  });
  check('live hazard → in-app toast with trustee + finding; a תקין row does not toast; in-app off → silent; rows still land in DB', /🦺 ליקוי חדש מנאמן: דנה — מטף ללא פלומבה/.test(rt.a) && rt.b === 1 && rt.c === 1 && rt.inDb === 3, rt);
  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
