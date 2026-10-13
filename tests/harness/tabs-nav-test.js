// Redesign phase 4 (13/10/2026): four tabs by kind of work (today, field, registers, management).
// Every button of the modules sheet belongs to exactly one tab, each tab opens the sheet with
// only its own screens and no duplicates, the tab of the current page is marked, the menu
// button still opens the full sheet, and the strip is gone for trustees and reporters.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const PAGES = ['dash', 'tasks', 'cal', 'mr', 'exp', 'nm', 'inc', 'round', 'ncr', 'eqi', 'toolbox', 'docs', 'aud', 'tr',
  'hearing', 'leg', 'rsk', 'ptw', 'ppe', 'ctr', 'wst', 'hzm', 'env', 'easp', 'emp', 'drl', 'ins', 'lg', 'users', 'audit',
  'agents', 'loc', 'prj', 'itp', 'itype', 'trustees', 'thz'];

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'he-IL' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate((PAGES) => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window._currentUser = { username: 'admin', role: 'אדמין' }; _isAdmin = true;
    document.body.classList.add('role-admin');
    const sheet = document.getElementById('m-modules-sheet');
    const btns = [...sheet.querySelectorAll('.sheet-btn')];
    const untabbed = btns.filter((b) => !_sheetBtnTab(b)).map((b) => b.textContent.trim());
    const noTab = PAGES.filter((p) => !_TAB_OF[p]);
    const vis = () => [...sheet.querySelectorAll('.sheet-btn')].filter((b) => b.style.display !== 'none' && getComputedStyle(b).display !== 'none');
    const per = {};
    for (const t of ['field', 'reg', 'mgmt']) {
      _tabOpen(t);
      const v = vis();
      per[t] = { n: v.length, wrong: v.filter((b) => _sheetBtnTab(b) !== t).length,
        dup: v.length - new Set(v.map((b) => b.id + '|' + b.getAttribute('onclick'))).size,
        title: sheet.querySelector('.modal-title').textContent,
        emptyGroup: [...sheet.querySelectorAll('.sheet-group-title')].filter((gt) => gt.style.display !== 'none').length };
      closeModal('m-modules-sheet');
    }
    // Every available module shows in some tab (the "frequent"-only ones too: near miss, expiries).
    const avail = new Set(btns.filter((b) => b.dataset.modUserHidden !== '1' && (!b.dataset.roleGated || b.dataset.roleAllowed === '1')).map((b) => b.id + '|' + b.getAttribute('onclick')));
    const shown = new Set();
    for (const t of ['field', 'reg', 'mgmt']) { _tabOpen(t); vis().forEach((b) => shown.add(b.id + '|' + b.getAttribute('onclick'))); closeModal('m-modules-sheet'); }
    const lost = [...avail].filter((k) => !shown.has(k) && !/_tabOpen|goPage\('dash'\)/.test(k));
    _menuOpen();
    const full = { n: vis().length, groups: [...sheet.querySelectorAll('.sheet-group-title')].filter((gt) => gt.style.display !== 'none').length,
      title: sheet.querySelector('.modal-title').textContent };
    closeModal('m-modules-sheet');
    goPage('ppe');
    const onPpe = document.querySelector('.tab.on') && document.querySelector('.tab.on').id;
    goPage('ncr');
    const onNcr = document.querySelector('.tab.on') && document.querySelector('.tab.on').id;
    _tabOpen('today');
    const today = CUR;
    const tb = getComputedStyle(document.getElementById('tabbar'));
    const mainPad = getComputedStyle(document.querySelector('.main')).paddingTop;
    document.body.classList.add('role-reporter');
    const repHidden = getComputedStyle(document.getElementById('tabbar')).display;
    const repPad = getComputedStyle(document.querySelector('.main')).paddingTop;
    document.body.classList.remove('role-reporter'); document.body.classList.add('emp-mode');
    const empHidden = getComputedStyle(document.getElementById('tabbar')).display;
    return { lost, untabbed, noTab, per, full, onPpe, onNcr, today, tbPos: tb.position, tbTop: tb.top, mainPad, repHidden, repPad, empHidden, total: btns.length };
  }, PAGES);
  check('every button of the modules sheet has a tab', r.untabbed.length === 0, r.untabbed);
  check('every module the sheet offers is reachable from some tab', r.lost.length === 0, r.lost);
  check('every page the app has belongs to a tab', r.noTab.length === 0, r.noTab);
  for (const t of ['field', 'reg', 'mgmt']) {
    const p = r.per[t];
    check(t + ': opens with its own screens only, no duplicates, titled', p.n > 2 && p.wrong === 0 && p.dup === 0 && p.title.length > 1 && p.emptyGroup > 0, p);
  }
  check('the menu button still opens the full sheet with its own title', r.full.n > r.per.reg.n && r.full.groups >= 6 && r.full.title !== r.per.mgmt.title, r.full);
  check('a register page marks the registers tab', r.onPpe === 'tab-reg', r.onPpe);
  check('NCR marks the management tab', r.onNcr === 'tab-mgmt', r.onNcr);
  check('"today" goes to the home queue', r.today === 'dash', r.today);
  check('the strip is fixed under the top bar, never at the bottom', r.tbPos === 'fixed' && r.tbTop === '60px', [r.tbPos, r.tbTop]);
  check('content starts below the strip', parseInt(r.mainPad) >= 104, r.mainPad);
  check('a reporter has no strip and the old top padding', r.repHidden === 'none' && r.repPad === '76px', [r.repHidden, r.repPad]);
  check('a trustee (employee mode) has no strip', r.empHidden === 'none', r.empHidden);
  check('no page error', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
