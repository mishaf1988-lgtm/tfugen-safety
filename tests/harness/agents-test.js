// B2 check: the agents page is the single AI hub — every capability listed
// with a working launcher, an Investigation slot present, reporters kept out.
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
    ['docs','auds','ncr','inc','tr','rsk','emp','ptw','ppe','ctr','equip_inspections','near_miss','rounds','tasks','locations','projects','inspection_types','env_aspects','leg','hzm','wst','env','ins','drl','med','hearing_tests','toolbox'].forEach(k => { if (!DB[k]) DB[k] = []; });
    DB.inc = [{ id: 'i1', d: 'x', dt: '2026-09-01T08:00', five_why: 'why1' }, { id: 'i2', d: 'y', dt: '2026-09-02T08:00' }];
  });

  console.log('\n1. admin hub');
  const hub = await page.evaluate(() => {
    window._currentUser = { username: 'admin' }; _applyRoleGates();
    goPage('agents');
    const box = document.getElementById('agents-cards');
    const cards = Array.from(box.querySelectorAll('.card')).map(c => ({
      title: c.querySelector('div[style*="font-weight:700;font-size:15px"]').textContent.trim(),
      actions: Array.from(c.querySelectorAll('button')).map(b => (b.getAttribute('onclick') || '').trim()),
      soon: /בבנייה/.test(c.textContent),
    }));
    const sections = Array.from(box.children).filter(el => !el.classList.contains('card')).map(el => el.textContent.trim());
    const fnOk = cards.every(c => c.actions.every(oc => { const m = oc.match(/^([A-Za-z_$][\w$]*)\(/); return m && typeof window[m[1]] === 'function'; }));
    const summaries = !!document.querySelector('#pg-agents #dash-ai-weekly-card') && !!document.querySelector('#pg-agents #dash-ai-today-card');
    return { cur: window.CUR, cards, sections, fnOk, summaries };
  });
  check('agents page opens for admin', hub.cur === 'agents');
  check('3 sections: dedicated agents · AI reports · modal helpers', hub.sections.length === 3 && /ממשק ייעודי/.test(hub.sections[0]) && /דוחות AI/.test(hub.sections[1]) && /במודאלים/.test(hub.sections[2]), hub.sections);
  const titles = hub.cards.map(c => c.title);
  check('dedicated agents: NCR/CAPA · Smart Capture · Legal · Investigation · Ask', ['NCR/CAPA Agent', 'Smart Capture', 'Legal AI Q&A', 'Incident Investigation Agent', 'שאל את העוזר'].every(t => titles.includes(t)), titles);
  check('AI reports: management review + AI tasks', titles.some(t => /סקירת הנהלה/.test(t)) && titles.some(t => /יצירת משימות AI/.test(t)), titles);
  check('modal helpers still listed (4)', ['5-Why Investigation (NCR + Inc)', 'NCR Root Cause + Action', 'Environmental Aspects Suggest', 'Risk Register Suggest'].every(t => titles.includes(t)), titles);
  check('11 cards total, every launcher points at a defined function', hub.cards.length === 11 && hub.fnOk, { n: hub.cards.length, fnOk: hub.fnOk });
  const inv = hub.cards.find(c => c.title === 'Incident Investigation Agent');
  check('Investigation card is live (PR-7): launches _invOpen, links to incidents, no placeholder badge', inv && !inv.soon && inv.actions.some(a => /_invOpen\(\)/.test(a)) && inv.actions.some(a => /goPage\('inc'\)/.test(a)), inv);
  check('on-demand summaries (weekly / today) still live here', hub.summaries === true);
  const ask = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#agents-cards button')).find(b => /m-ask/.test(b.getAttribute('onclick') || '')); b.click(); const m = document.getElementById('m-ask'); const open = m && m.style.display === 'block'; if (open) closeModal('m-ask'); return open; });
  check('"ask the assistant" launcher opens the m-ask modal', ask === true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/agents-hub-375.png', fullPage: false });

  console.log('\n2. reporter');
  const rep = await page.evaluate(() => { window._currentUser = null; _applyRoleGates(); goPage('agents'); return window.CUR; });
  check('reporter trying the agents page is sent home (unchanged gate)', rep === 'dash', rep);
  const home = await page.evaluate(() => { window._currentUser = { username: 'admin' }; _applyRoleGates(); goPage('dash'); rDash(); return { aiOnHome: !!document.querySelector('#pg-dash #dash-ai-weekly-card'), qa: document.querySelectorAll('#dash-qa .qa-btn').length }; });
  check('home still AI-free (#544 intact)', home.aiOnHome === false && home.qa === 6, home);

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
