// A1 modules-sheet check: renders the REAL index.html in headless Chromium at
// phone width with the network blocked and verifies grouping, the frequent
// row, dedupe in prefs, search (synonyms, empty state, Enter), role gating and
// the reset-on-open behaviour.
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
    try { localStorage.removeItem('tfgn_app_prefs'); } catch (e) {}
  });
  const setRole = (u) => page.evaluate((u) => { window._currentUser = u; _applyRoleGates(); }, u);
  const state = () => page.evaluate(() => {
    const sheet = document.getElementById('m-modules-sheet');
    const vis = (el) => el.style.display !== 'none';
    const btns = Array.from(sheet.querySelectorAll('.sheet-btn'));
    const titles = Array.from(sheet.querySelectorAll('.sheet-group-title'));
    const key = (b) => ((b.getAttribute('onclick') || '').match(/_goFromSheet\('m-modules-sheet','([^']+)'\)/) || [])[1] || null;
    // frequent row = buttons between the first and second group titles
    const freq = []; let el = titles[0].nextElementSibling; while (el && !el.classList.contains('sheet-group-title')) { freq.push({ key: key(el), text: el.textContent.trim() }); el = el.nextElementSibling; }
    return {
      open: sheet.style.display === 'block',
      titles: titles.map(t => ({ text: t.textContent.trim(), visible: vis(t) })),
      freq,
      visibleKeys: btns.filter(vis).map(key).filter(Boolean),
      visibleTexts: btns.filter(vis).map(b => b.textContent.trim()),
      hiddenIds: btns.filter(b => !vis(b) && b.id).map(b => b.id),
      empty: document.getElementById('m-modules-empty').style.display !== 'none',
      q: document.getElementById('m-modules-search').value,
      modList: _modList().map(it => ({ key: it.key, n: it.btns.length })),
      cur: window.CUR,
    };
  });

  console.log('\n1. structure (admin)');
  await setRole({ username: 'admin' });
  await page.evaluate(() => _menuOpen());
  let s = await state();
  check('sheet opens with an empty search', s.open && s.q === '', { open: s.open, q: s.q });
  check('7 group titles: frequent + 6 groups', s.titles.length === 7 && /נפוצים/.test(s.titles[0].text), s.titles.map(t => t.text));
  check('group names: בטיחות · איכות/NCR · HR · סביבה · ניהול · AI/הגדרות', ['בטיחות', 'איכות / NCR', 'HR', 'סביבה', 'ניהול', 'AI / הגדרות'].every((n, i) => s.titles[i + 1].text.includes(n)), s.titles.map(t => t.text));
  check('frequent row: reports + 8 modules', s.freq.length === 9 && s.freq[0].key === null && s.freq.slice(1).map(f => f.key).join() === 'ncr,eqi,exp,tasks,nm,inc,round,docs', s.freq);
  const dup = s.modList.filter(m => m.n > 1).map(m => m.key + ':' + m.n).sort().join();
  check('_modList: unique keys; ncr/eqi/docs carry 2 buttons each', new Set(s.modList.map(m => m.key)).size === s.modList.length && dup === 'docs:2,eqi:2,ncr:2', dup);
  check('admin sees the gated entries (users / audit / agents / mr)', ['users', 'audit', 'agents', 'mr'].every(k => s.visibleKeys.includes(k)), s.hiddenIds);
  check('settings button lives in the AI/settings group', s.visibleTexts.some(t => /הגדרות תצוגה/.test(t)) && !document_has_standalone(s), s.visibleTexts.filter(t => /הגדרות/.test(t)));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/modules-sheet-375.png' });

  console.log('\n2. search');
  const type = (q) => page.evaluate((q) => { const i = document.getElementById('m-modules-search'); i.value = q; _modulesSheetFilter(q); }, q);
  await type('ציוד');
  s = await state();
  check('"ציוד": only equipment-related buttons visible, groups without matches hidden', s.visibleTexts.length > 0 && s.visibleTexts.every(t => /ציוד|PPE/.test(t)) && s.titles.filter(t => t.visible).length < 7 && !s.empty, s.visibleTexts);
  await type('NCR');
  s = await state();
  check('"NCR" (Latin) finds אי התאמות via data-kw', s.visibleKeys.includes('ncr') && s.visibleTexts.every(t => /אי התאמ|NCR/i.test(t)), s.visibleTexts);
  await type('zzz');
  s = await state();
  check('no match → empty state shown, nothing visible', s.empty && s.visibleKeys.length === 0, { empty: s.empty, n: s.visibleKeys.length });
  await type('תוקפים');
  await page.evaluate(() => document.getElementById('m-modules-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  s = await state();
  check('Enter opens the first match (exp page) and closes the sheet', s.cur === 'exp' && !s.open, { cur: s.cur, open: s.open });

  console.log('\n3. role gating survives search clearing');
  await setRole({ username: 'mgr', role: 'מנהל' });
  await page.evaluate(() => _menuOpen());
  await type('x'); await type('');
  s = await state();
  check('manager: users/audit/agents stay hidden after a search is cleared', ['sheet-btn-users', 'sheet-btn-audit', 'sheet-btn-agents'].every(id => s.hiddenIds.includes(id)), s.hiddenIds);
  check('manager: regular modules visible', ['docs', 'eqi', 'rsk', 'emp', 'wst', 'cal'].every(k => s.visibleKeys.includes(k)), s.visibleKeys);
  await setRole(null);  // reporter
  s = await state();
  check('reporter: non-reporter modules hidden, reporter pages remain', !s.visibleKeys.includes('docs') && !s.visibleKeys.includes('eqi') && ['ncr', 'nm', 'inc', 'round', 'tasks'].every(k => s.visibleKeys.includes(k)), s.visibleKeys);
  await setRole({ username: 'admin' });
  s = await state();
  check('back to admin: everything restored', ['docs', 'eqi', 'users', 'audit'].every(k => s.visibleKeys.includes(k)), s.hiddenIds);

  console.log('\n4. visibility prefs hide every copy');
  await page.evaluate(() => _appPrefsSet({ modulesHidden: { eqi: true } }));
  s = await state();
  check('hiding "eqi" in prefs hides both copies', !s.visibleKeys.includes('eqi') && s.modList.some(m => m.key === 'eqi'), s.visibleKeys.filter(k => k === 'eqi'));
  await type('ציוד'); s = await state();
  check('search cannot re-show a prefs-hidden module', !s.visibleKeys.includes('eqi'), s.visibleKeys);
  await page.evaluate(() => _appPrefsSet({ modulesHidden: {} }));
  await type(''); s = await state();
  check('un-hiding restores both copies', s.visibleKeys.filter(k => k === 'eqi').length === 2, s.visibleKeys.filter(k => k === 'eqi'));

  console.log('\n5. reset on open');
  await type('ציוד');
  await page.evaluate(() => { closeModal('m-modules-sheet'); _menuOpen(); });
  s = await state();
  check('reopening via ☰ clears the search and shows all groups', s.q === '' && s.titles.every(t => t.visible) && s.visibleKeys.length > 20, { q: s.q, n: s.visibleKeys.length });

  const realErrs = errs.filter(e => !/net::ERR|Failed to load|supabase|web-vitals/i.test(e));
  check('no unexpected page errors', realErrs.length === 0, realErrs.slice(0, 5));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);

  function document_has_standalone(st) { return false; }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
