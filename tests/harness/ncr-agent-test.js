// B3 check: NCR Agent modal — status chips filter the list; "analyze all"
// covers ALL open NCRs (single call for small sets, chunked + merged for
// large sets), renders the final text and never touches closed NCRs.
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
  const seed = (nOpen, nClosed) => page.evaluate(({ nOpen, nClosed }) => {
    const lg = document.getElementById('login'); if (lg) lg.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    const rows = [];
    for (let i = 1; i <= nOpen; i++) rows.push({ id: 'o' + i, num: 'NCR-' + String(i).padStart(4, '0'), s: i % 3 ? 'פתוח' : 'בטיפול', p: ['קריטי', 'גבוה', 'בינוני'][i % 3], a: ['ייצור', 'מחסן', 'מעבדה'][i % 3], d: 'תיאור אי-התאמה מספר ' + i, ts: '2026-09-0' + ((i % 9) + 1) });
    for (let i = 1; i <= nClosed; i++) rows.push({ id: 'c' + i, num: 'NCR-9' + String(i).padStart(3, '0'), s: 'סגור', p: 'נמוך', a: 'ייצור', d: 'סגור ' + i, ts: '2026-08-01' });
    DB.ncr = rows;
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    // Mock the AI endpoint: record every prompt, answer with a marker.
    window.__ai = [];
    const realFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (String(url).indexOf('/api/claude') >= 0) {
        const body = JSON.parse(opts.body); const prompt = body.messages[0].content;
        window.__ai.push({ len: prompt.length, part: (prompt.match(/part (\d+) of (\d+)/) || [])[0] || null, merge: /partial analyses/.test(prompt), ncrs: (prompt.match(/NCR-\d{4}/g) || []).length, max: body.max_tokens });
        return Promise.resolve(new Response(JSON.stringify({ content: [{ text: 'תוצאה #' + window.__ai.length + (window.__ai[window.__ai.length - 1].merge ? ' (מיזוג)' : '') }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return realFetch.apply(this, arguments);
    };
    // No Supabase in the harness: the modal's loaders read the seeded DB instead.
    window._ncrLoad = function () { _nad = DB.ncr.slice(); _naf = {}; _ncrRender(); };
    window._ncrLoadAI = function () {};
    window._ncrPatternsLoad = function () {};
    openNCRAgent();
  }, { nOpen, nClosed });
  const listState = () => page.evaluate(() => ({ rows: document.querySelectorAll('#ncr-agent-list [data-nid]').length, filter: window._naFilter || 'open', chips: Array.from(document.querySelectorAll('#ncr-agent-list button')).map(b => b.textContent.trim()) }));
  const waitPanel = async () => { for (let i = 0; i < 60; i++) { const t = await page.evaluate(() => document.getElementById('ncr-agent-panel').textContent); if (/תוצאה #/.test(t) || /API|Network|Parse/.test(t)) return t; await page.waitForTimeout(50); } return await page.evaluate(() => document.getElementById('ncr-agent-panel').textContent); };

  console.log('\n1. status filter in the modal list (existing chips)');
  await seed(20, 5);
  let s = await listState();
  check('default shows open only (20), chips: open / closed / all with counts', s.rows === 20 && s.filter === 'open' && /פתוחים.*20/.test(s.chips.join(' ')) && /סגורים.*5/.test(s.chips.join(' ')), s);
  await page.evaluate(() => _naSetFilter('closed')); s = await listState();
  check('closed chip → 5 closed rows', s.rows === 5 && s.filter === 'closed', s);
  await page.evaluate(() => _naSetFilter('all')); s = await listState();
  check('all chip → 25 rows', s.rows === 25, s);
  await page.evaluate(() => _naSetFilter('open'));

  console.log('\n2. analyze all — small set: one call covering every open NCR');
  await page.evaluate(() => ncrAgentAnalyzeAll());
  let panel = await waitPanel();
  let ai = await page.evaluate(() => window.__ai);
  check('single call, all 20 open NCRs in the prompt, none of the closed ones', ai.length === 1 && ai[0].ncrs === 20 && !ai[0].merge, ai);
  check('panel shows the analysis', /תוצאה #1/.test(panel), panel.slice(0, 80));

  console.log('\n3. analyze all — large set: chunked + merged');
  await seed(130, 10);
  await page.evaluate(() => ncrAgentAnalyzeAll());
  panel = await waitPanel();
  ai = await page.evaluate(() => window.__ai);
  const parts = ai.filter(a => a.part), merge = ai.filter(a => a.merge);
  check('130 open → 3 part calls (60/60/10) + 1 merge call', ai.length === 4 && parts.length === 3 && merge.length === 1 && parts.map(p => p.ncrs).join() === '60,60,10', ai.map(a => ({ part: a.part, ncrs: a.ncrs, merge: a.merge })));
  check('every open NCR appears exactly once across the parts (130), closed ones never', parts.reduce((n, p) => n + p.ncrs, 0) === 130, parts.map(p => p.ncrs));
  check('merge prompt carries the 3 partial results and is what gets rendered', merge[0].ncrs === 0 && /תוצאה #4 \(מיזוג\)/.test(panel), panel.slice(0, 80));
  check('the merge call is the last one and no prompt exceeds ~12k chars', ai[3].merge && ai.every(a => a.len < 12000), ai.map(a => a.len));
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/ncr-agent-375.png' });

  console.log('\n4. error path');
  await page.evaluate(() => { const f = window.fetch; window.fetch = function (url) { if (String(url).indexOf('/api/claude') >= 0) return Promise.resolve(new Response('boom', { status: 500 })); return f.apply(this, arguments); }; ncrAgentAnalyzeAll(); });
  panel = await waitPanel();
  check('API failure is shown, not swallowed', /API 500/.test(panel), panel.slice(0, 80));

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
