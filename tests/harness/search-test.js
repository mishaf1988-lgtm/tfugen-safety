// One search, not two. The app carried both openGlobalSearch() (12 tables,
// named fields, skips sensitive NCRs) and a second Ctrl+K one (7 pools, raw
// row JSON, no sensitivity filter) whose own tooltip pointed at the wrong
// modal. The second is gone; this proves nothing it covered was lost.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const SEED = {
  ncr: [{ id: 'n1', num: 'NCR-0001', d: 'מגשר שבור במחסן', a: 'מחסן' },
        { id: 'n2', num: 'NCR-0002', d: 'תלונה חסויה על מגשר', a: 'משרד', sens: true }],
  rsk: [{ id: 'r1', d: 'עבודה בגובה ליד המגשר', a: 'ייצור', o: 'לב' }],
  tasks: [{ id: 't1', title: 'לתקן מגשר', assignee: 'admin' }],
  docs: [{ id: 'd1', n: 'נוהל מגשרים' }],
  emp: [{ id: 'e1', n: 'מוסא', r: 'מפעיל' }],
  inc: [{ id: 'i1', d: 'נפילה ממגשר' }],
  tr: [{ id: 'tr1', n: 'הדרכת מגשרים', w: 'לב' }],
};

(async () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

  console.log('\n1. the duplicate is gone, root and branch');
  {
    for (const [what, re] of [
      ['openSearch() / closeSearch()', /\b(openSearch|closeSearch)\s*\(/],
      ['_srBuild / _srRun / _srKey / _srOpen', /\b_sr(Build|Run|Key|Open)\b/],
      ['the _hs JSON haystack it memoised on every record', /_hayFor|'_hs'/],
      ['its #m-search / #ov-search markup and CSS', /m-search|ov-search/],
      ['.sr-item / .sr-tag / .sr-txt styles', /\.sr-(item|tag|txt)/],
      ['the _debSrRun debounce', /_debSrRun/],
    ]) check('no trace left of ' + what, !re.test(src), (src.match(re) || [])[0]);
    check('the tooltip that said "(Ctrl+K)" while opening the other modal is gone', !/חיפוש \(Ctrl\+K\)/.test(src) && !/&#1495;&#1497;&#1508;&#1493;&#1513; \(Ctrl\+K\)/.test(src));
  }

  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const boot = async (role) => page.evaluate(({ seed, role }) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    Object.keys(seed).forEach((k) => { DB[k] = seed[k].slice(); });
    window._currentUser = { username: role === 'admin' ? 'admin' : role, role: role };
    _isAdmin = (role === 'admin');
    _applyRoleGates(); goPage('dash');
  }, { seed: SEED, role });

  // openGlobalSearch() blanks the box from a 50ms timeout, so type after it fires.
  const run = async (q) => {
    await page.evaluate(() => openGlobalSearch());
    await page.waitForTimeout(120);
    return page.evaluate((q) => {
      const box = document.getElementById('gsearch-q');
      box.value = q; _gsearchRender();
      return Array.from(document.querySelectorAll('#gsearch-results .gs-item')).map((el) => ({ tbl: el.dataset.stbl, id: el.dataset.sid, txt: el.textContent.replace(/\s+/g, ' ').trim() }));
    }, q);
  };

  console.log('\n2. the surviving search still reaches everything the other one did');
  {
    await boot('admin');
    const hits = await run('מגשר');
    const tbls = hits.map((h) => h.tbl).sort();
    check('one query reaches ncr, rsk, tasks, docs, inc and tr in a single list', ['docs', 'inc', 'ncr', 'ncr', 'rsk', 'tasks', 'tr'].every((t) => tbls.indexOf(t) >= 0), tbls);
    check('סיכונים (rsk) are searchable — they were only in the deleted search before', hits.some((h) => h.tbl === 'rsk' && h.id === 'r1' && /סיכון/.test(h.txt)), hits.filter((h) => h.tbl === 'rsk'));
    const byName = await run('מוסא');
    check('searching an employee name still works', byName.some((h) => h.tbl === 'emp' && h.id === 'e1'), byName);
    const short = await run('מ');
    check('a single character returns nothing (the 2-char floor still holds)', short.length === 0, short);
  }

  console.log('\n3. the sensitivity filter the deleted search did NOT have');
  {
    await boot('admin');
    const asAdmin = await run('מגשר');
    check('an admin sees the sensitive NCR', asAdmin.some((h) => h.tbl === 'ncr' && h.id === 'n2'), asAdmin.filter((h) => h.tbl === 'ncr'));
    await boot('manager');
    const asMgr = await run('מגשר');
    check('a manager does not — and still sees the ordinary one', !asMgr.some((h) => h.id === 'n2') && asMgr.some((h) => h.id === 'n1'), asMgr.filter((h) => h.tbl === 'ncr'));
  }

  console.log('\n4. keyboard navigation, carried over from the search that had it');
  {
    await boot('admin');
    const hits = await run('מגשר');
    const sel = () => page.evaluate(() => { const el = document.querySelector('#gsearch-results .gs-item.sel'); return el ? el.dataset.sid : null; });
    check('the first result starts selected', (await sel()) === hits[0].id, { first: hits[0] });
    const key = (k) => page.evaluate((k) => { _gsKey({ key: k, preventDefault: function () {} }); }, k);
    await key('ArrowDown'); check('↓ moves to the second', (await sel()) === hits[1].id);
    await key('ArrowUp'); check('↑ moves back to the first', (await sel()) === hits[0].id);
    await key('ArrowUp'); check('↑ at the top stays put, it does not wrap or break', (await sel()) === hits[0].id);
    for (let i = 0; i < hits.length + 3; i++) await key('ArrowDown');
    check('↓ past the end stops on the last one', (await sel()) === hits[hits.length - 1].id);
    const opened = await page.evaluate(() => {
      const items = document.querySelectorAll('#gsearch-results .gs-item');
      items.forEach((el) => el.classList.remove('sel'));
      items[0].classList.add('sel');
      _gsKey({ key: 'Enter', preventDefault: function () {} });
      return { modalShut: getComputedStyle(document.getElementById('m-gsearch')).display === 'none', cur: CUR };
    });
    check('Enter closes the search and opens the record', opened.modalShut, opened);
  }

  console.log('\n5. both keyboard shortcuts now reach the one search');
  {
    await boot('admin');
    for (const [label, press] of [['Ctrl+K', { key: 'k', ctrlKey: true }], ['/', { key: '/' }]]) {
      await page.evaluate(() => { const m = document.getElementById('m-gsearch'); m.style.display = 'none'; document.getElementById('ov-gsearch').style.display = 'none'; document.body.style.overflow = ''; });
      await page.evaluate((press) => {
        document.body.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, press)));
      }, press);
      await page.waitForTimeout(120);
      const open = await page.evaluate(() => getComputedStyle(document.getElementById('m-gsearch')).display !== 'none');
      check(label + ' opens the one remaining search', open, { label });
    }
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
