// E1 + E2 check: an empty NCR cannot be inserted from the form; the NCR
// agent handles 0 open NCRs, prose-wrapped JSON, garbage replies (with a
// retry) and repeated clicks.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const GOOD = 'בטח, הנה הניתוח:\n```json\n{"risk":"high","root_cause":"אין נוהל","immediate_action":"עצור","corrective_actions":["א","ב"],"preventive":"נוהל","owner_suggested":"בטיחות","due_days":7}\n```\nבהצלחה!';

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.evaluate((GOOD) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    window.__ins = []; window.__toasts = [];
    const oi = window.sbIns; window.sbIns = function (t, r) { window.__ins.push([t, r && r.id]); };
    const ot = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); };
    window.confirm = () => false;
    window.__aiReply = GOOD; window.__aiCalls = 0;
    const realFetch = window.fetch;
    window.fetch = function (url) {
      if (String(url).indexOf('/api/claude') >= 0) { window.__aiCalls++; return Promise.resolve(new Response(JSON.stringify({ content: [{ text: window.__aiReply }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })); }
      return realFetch.apply(this, arguments);
    };
    window._ncrLoad = function () { _nad = DB.ncr.slice(); _naf = {}; _naVer = {}; _ncrRender(); };
    window._ncrLoadAI = function () {}; window._ncrPatternsLoad = function () {};
  }, GOOD);

  console.log('\nE1. empty NCR insert');
  const e1 = await page.evaluate(() => { DB.ncr = []; goPage('ncr'); openNewNcrModal(); document.getElementById('ncr-d').value = ''; const before = DB.ncr.length; svNcr(); return { before, after: DB.ncr.length, ins: window.__ins.length, toast: window.__toasts.slice(-1)[0] || '', modalOpen: document.getElementById('m-ncr').style.display === 'block' }; });
  check('saving with an empty description inserts nothing, keeps the modal open, and explains why', e1.after === 0 && e1.ins === 0 && /תיאור/.test(e1.toast) && e1.modalOpen, e1);
  const e1b = await page.evaluate(() => { document.getElementById('ncr-d').value = 'תיאור אמיתי'; svNcr(); return { after: DB.ncr.length, ins: window.__ins.length, hasNum: /^NCR-\d{4}$/.test((DB.ncr[0] || {}).num || '') }; });
  check('with a description the insert goes through once with a proper number', e1b.after === 1 && e1b.ins === 1 && e1b.hasNum, e1b);

  console.log('\nE2. agent edge cases');
  const z = await page.evaluate(() => { DB.ncr = [{ id: 'c1', num: 'NCR-0001', s: 'סגור', d: 'x' }]; window.__aiCalls = 0; openNCRAgent(); ncrAgentAnalyzeAll(); return { calls: window.__aiCalls, panel: document.getElementById('ncr-agent-panel').textContent.trim() }; });
  check('analyze-all with 0 open NCRs: no AI call, clear message with the closed count', z.calls === 0 && /אין NCR פתוחים/.test(z.panel) && /1/.test(z.panel), z);
  await page.evaluate(() => { DB.ncr = [{ id: 'o1', num: 'NCR-0002', s: 'פתוח', p: 'גבוה', a: 'ייצור', d: 'תיאור' }]; _ncrLoad(); _ncrSel('o1'); window.__aiReply = window.__aiReplyGood = 'בטח, הנה הניתוח:\n```json\n{"risk":"high","root_cause":"אין נוהל","immediate_action":"עצור","corrective_actions":["א","ב"],"preventive":"נוהל","owner_suggested":"בטיחות","due_days":7}\n```\nבהצלחה!'; _ncrAI('o1'); });
  await page.waitForTimeout(250);
  const good = await page.evaluate(() => ({ an: _naf.o1, busy: document.querySelectorAll('#ncr-ai-busy').length, panel: document.getElementById('ncr-agent-panel').textContent }));
  check('prose + fenced JSON reply is parsed (risk=high, 2 corrective actions, due date computed)', good.an && good.an.risk === 'high' && good.an.corrective_actions.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(good.an.due_suggested) && !good.an.err, good.an);
  await page.evaluate(() => { delete _naf.o1; window.__aiReply = 'מצטער, לא הצלחתי לנתח.'; _ncrAI('o1'); });
  await page.waitForTimeout(250);
  const bad = await page.evaluate(() => ({ an: _naf.o1, panel: document.getElementById('ncr-agent-panel').innerHTML, retry: !!Array.from(document.querySelectorAll('#ncr-agent-panel button')).find(b => /נסה שוב/.test(b.textContent)) }));
  check('a reply without JSON becomes a visible AI error with a retry button', bad.an && bad.an.err && /AI Error/.test(bad.panel) && /no JSON/.test(bad.an.msg) && bad.retry, { msg: bad.an && bad.an.msg, retry: bad.retry });
  await page.evaluate(() => { window.__aiReply = window.__aiReplyGood; Array.from(document.querySelectorAll('#ncr-agent-panel button')).find(b => /נסה שוב/.test(b.textContent)).click(); });
  await page.waitForTimeout(250);
  const retried = await page.evaluate(() => ({ ok: _naf.o1 && !_naf.o1.err && _naf.o1.risk === 'high', ver: _naVer.o1 }));
  check('retry succeeds and keeps versioning', retried.ok && retried.ver === 2, retried);
  const dbl = await page.evaluate(() => { delete _naf.o1; _ncrSel('o1'); _ncrAI('o1'); _ncrAI('o1'); return document.querySelectorAll('#ncr-ai-busy').length; });
  check('two rapid clicks show a single "Analyzing…" marker', dbl === 1, dbl);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
