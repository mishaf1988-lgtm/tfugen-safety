// Hazardous materials: the SDS file and the imported permit rows (04/10/2026, Michael: "find the
// SDS and attach it"). The 32 rows imported from poisons permit 70011 carry no stock quantity and
// no risk level on purpose (the permit gives a maximum, not stock). Proves: editing such a row does
// not invent "0 in stock" or "low risk"; the SDS attachment is saved, restored on edit and shown;
// a missing SDS is counted and shown in red; the SDS date is a plain date, not an expiry badge.
// Also the phone speed numbers (web vitals): sent to audit_log once per page load, never by a viewer.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };
(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' }); await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window._role = () => 'admin'; window._isAdminUser = () => true;
    window.__ins = []; window.__upd = []; window.__ob = [];
    window.sbIns = (t, r) => window.__ins.push({ t, r: JSON.parse(JSON.stringify(r)) });
    window.sbUpd = (t, r) => window.__upd.push({ t, r: JSON.parse(JSON.stringify(r)) });
    window._obPush = (op) => window.__ob.push(JSON.parse(JSON.stringify(op)));
    window.sdb = () => {}; window.addLog = () => {}; window.toast = () => {};
    DB.hzm = [
      { id: 'z1', n: 'אמוניה נטולת מים (ammonia, anhydrous)', un: 'UN 1005', loc: 'מערכת סגורה', q: null, hs: null, em: 'אחסון: מערכת סגורה. מרבי מאושר בהיתר רעלים 70011 (03/09/2026): 12.71 טון.' },
      { id: 'z2', n: 'Proseptyl XT (Diversey)', un: 'UN 3082', loc: 'מחסן', q: null, hs: null, ms: '2023-04-03', file_url: 'https://example.com/proseptyl-sds.pdf' },
    ];
  });

  // The page: missing SDS counted, link shown, no invented quantity or risk, no expiry badge.
  let r = await page.evaluate(() => { goPage('hzm'); rHzm(); const t = g('tb-hzm'); const rows = [...t.querySelectorAll('tr')].map((x) => [...x.children].map((c) => c.textContent.trim()));
    const a = t.querySelector('a[href]'); return { rows, sum: g('hzm-summary').textContent, href: a && a.getAttribute('href'), badge: !!t.querySelector('.b.bR, .b.bY, .b.bG') }; });
  check('summary: "חסר SDS: 1"', /חסר SDS:\s*1/.test(r.sum), r.sum);
  const amm = r.rows.find((x) => /אמוניה/.test(x[0])) || [], pro = r.rows.find((x) => /Proseptyl/.test(x[0])) || [];
  check('imported row: risk "-", quantity "-" (not " ל"), SDS "חסר"', amm[2] === '-' && amm[3] === '-' && /חסר/.test(amm[5]), amm);
  check('row with SDS: plain date 03/04/2023 and "📄 SDS" link to the file', /03\/04\/2023/.test(pro[5]) && /SDS/.test(pro[5]) && r.href === 'https://example.com/proseptyl-sds.pdf', [pro[5], r.href]);
  check('the SDS date is not an expiry badge (no "פג")', !/פג/.test(pro[5]) && !r.badge, pro[5]);

  // Editing the imported ammonia row: nothing invented.
  r = await page.evaluate(() => { _genEdit('hzm', 'z1'); const o = { hs: g('hzm-hs').value, q: g('hzm-q').value, area: !!g('hzm-attach-area') }; svHzm(); return Object.assign(o, { upd: window.__upd.slice(-1)[0] }); });
  check('edit form opens with an empty risk (not "נמוך") and an empty quantity', r.hs === '' && r.q === '', r);
  check('the form has the SDS attach area', r.area);
  check('saving the edit keeps quantity null and the permit text', r.upd && r.upd.t === 'hzm' && r.upd.r.q === null && /12\.71 טון/.test(r.upd.r.em), r.upd);
  check('saving the edit does not write a risk level', r.upd && !r.upd.r.hs, r.upd && r.upd.r.hs);

  // Editing the row that has an SDS keeps the file (the edit restores _attachUrls).
  r = await page.evaluate(() => { _genEdit('hzm', 'z2'); svHzm(); return window.__upd.slice(-1)[0]; });
  check('editing a row with an SDS keeps file_url', r && r.r.file_url === 'https://example.com/proseptyl-sds.pdf', r && r.r);

  // A new material with an SDS attached.
  r = await page.evaluate(() => { openModal('m-hzm'); g('hzm-n').value = 'חומר חדש'; _attachUrls['hzm-attach-area'] = 'https://x.supabase.co/storage/v1/object/public/incidents-photos/hzm/sds.pdf'; svHzm(); const i = window.__ins.slice(-1)[0]; return { i, after: _attachUrls['hzm-attach-area'] }; });
  check('new material saves its SDS file_url', r.i && r.i.t === 'hzm' && /sds\.pdf$/.test(r.i.r.file_url), r.i);
  check('new material with an empty quantity saves null, not 0', r.i && r.i.r.q === null, r.i && r.i.r.q);
  check('the attach area is cleared after save (next new form starts empty)', !r.after, r.after);
  check('a new material starts with no risk level (not "נמוך" by default)', r.i && r.i.r.hs === '', r.i && r.i.r.hs);

  // Web vitals: once per page load, only when synced, never by a viewer.
  r = await page.evaluate(() => {
    window.__ob = []; window._wvSent = false; window._wv = { LCP: 900, FCP: 500 };
    SB_ON = false; _wvFlush(); const off = window.__ob.length;
    SB_ON = true; window._role = () => 'viewer'; _wvFlush(); const viewer = window.__ob.length;
    window._role = () => 'admin'; _wvFlush(); _wvFlush(); const sent = window.__ob.slice();
    return { off, viewer, sent };
  });
  check('vitals: nothing before sync, nothing from a viewer', r.off === 0 && r.viewer === 0, r);
  const v = r.sent[0];
  check('vitals: sent once to audit_log as op "vitals" with the numbers', r.sent.length === 1 && v.tbl === 'audit_log' && v.row.op === 'vitals' && v.row.table_name === 'web_vitals' && JSON.parse(v.row.title).LCP === 900, r.sent);
  check('vitals: the page hide event sends them', /addEventListener\('visibilitychange',function\(\)\{if\(document\.visibilityState==='hidden'\)_wvFlush\(\);\}\)/.test(require('fs').readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')));

  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
