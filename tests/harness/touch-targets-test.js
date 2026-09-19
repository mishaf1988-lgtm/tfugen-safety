// Phone QA sweep, 2026-09-19. Two things are pinned here: the row action
// buttons (👁 ✎ 🗑 🖨 ⋯) must be thumb-sized on a touch screen but stay compact
// on a desktop, and no page may scroll sideways or throw at 375px.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const TODAY = new Date().toISOString().substring(0, 10);
// A location name long enough to push any un-clipped layout off the screen.
const L = 'מגדל קירור מזרחי · קומה שנייה · ליד עמדת כיבוי האש';
const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const SEED = {
  ncr: mk(6, (i) => ({ id: 'n' + i, num: 'NCR-' + (1000 + i), d: 'תיאור ' + L, a: L, st: 'פתוח', dt: TODAY, pr: 'גבוה' })),
  near_miss: mk(4, (i) => ({ id: 'm' + i, descr: L, area: L, d: TODAY, typ: 'מעידה' })),
  inc: mk(3, (i) => ({ id: 'i' + i, d: L, dt: TODAY, l: L })),
  // inspection_type so the category chip bar actually renders — it is one of the fixes.
  equip_inspections: mk(5, (i) => ({ id: 'e' + i, code: 'EQ-' + i, n: 'מטף ' + L, e: TODAY, loc: L, inspection_type: i % 2 ? 'מטפים' : 'הידרנטים' })),
  docs: mk(3, (i) => ({ id: 'd' + i, n: 'נוהל ' + L, c: 'בטיחות', e: TODAY })),
  rsk: mk(3, (i) => ({ id: 'r' + i, d: 'סיכון ' + L, a: L, p: 4, sv: 4 })),
  emp: mk(4, (i) => ({ id: 'p' + i, n: 'עובד ' + i, r: 'מפעיל', dep: L })),
  tr: mk(3, (i) => ({ id: 'tr' + i, n: 'הדרכה ' + L, w: 'לב', e: TODAY })),
  ppe: mk(3, (i) => ({ id: 'pp' + i, n: 'נעלי בטיחות ' + L, e: TODAY })),
  ptw: mk(3, (i) => ({ id: 'w' + i, n: 'עבודה חמה ' + L, e: TODAY, st: 'פתוח' })),
  tasks: mk(5, (i) => ({ id: 't' + i, title: 'משימה ' + L, assignee: 'admin', due: TODAY, status: 'פתוח' })),
  trustee_reports: mk(4, (i) => ({ id: 'x' + i, u: 'לב', m: TODAY.substring(0, 7), t: i + 1, d: TODAY, loc: L, ok: i % 2 === 0, f: L, s: i % 2 === 0 ? 'תקין' : 'פתוח', ts: new Date().toISOString() })),
  trustees: [{ id: 'tt1', n: 'לב', dep: L, active: true }],
};
const ROW_PAGES = ['ncr', 'nm', 'inc', 'eqi', 'docs', 'rsk', 'ptw', 'ppe', 'emp', 'tr'];
const ALL_PAGES = 'dash ncr nm inc tasks eqi exp round docs rsk ptw ppe ctr ins drl toolbox trustees aud itp itype leg emp tr hearing wst hzm env easp mr cal loc prj lg users audit agents'.split(' ');

(async () => {
  const browser = await pw.chromium.launch();
  const open = async (w, touch) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 812 }, locale: 'he-IL', hasTouch: !!touch, isMobile: !!touch });
    const page = await ctx.newPage();
    const thrown = [];
    page.on('pageerror', (e) => thrown.push(String(e && e.message || e)));
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto(HTML, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    await page.evaluate((seed) => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      Object.keys(seed).forEach((k) => { DB[k] = seed[k]; });
      window._currentUser = { username: 'admin' }; _isAdmin = true;
      _applyRoleGates();
    }, SEED);
    return { ctx, page, thrown };
  };
  // Smallest row-action button on a page, or null when the page has none.
  const rowBtns = (page, pg) => page.evaluate((pg) => {
    goPage(pg);
    const bs = Array.from(document.querySelectorAll('#pg-' + pg + ' .tbl-wrap tbody td .btn-d'))
      .map((b) => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), txt: (b.textContent || '').trim().slice(0, 3) }; })
      .filter((x) => x.h > 0);
    if (!bs.length) return null;
    return bs.sort((a, b) => (a.h * a.w) - (b.h * b.w))[0];
  }, pg);

  console.log('\n1. on a phone the row actions are thumb-sized');
  {
    const { ctx, page } = await open(375, true);
    const bad = [];
    for (const pg of ROW_PAGES) {
      const b = await rowBtns(page, pg);
      if (!b) { bad.push({ pg: pg, why: 'no row buttons rendered' }); continue; }
      if (b.h < 44 || b.w < 44) bad.push({ pg: pg, btn: b });
    }
    check('all ' + ROW_PAGES.length + ' pages with row actions hit 44×44 at 375px', bad.length === 0, bad);
    // Measure each one while its own page is still showing — reading the rect
    // after goPage() moved on gives 0 and looks like a failure that is not there.
    const extras = await page.evaluate(() => {
      goPage('eqi');
      const chip = document.querySelector('#eqi-cat-chips .chip-tap');
      const chipH = chip ? Math.round(chip.getBoundingClientRect().height) : null;
      goPage('dash'); if (typeof rDash === 'function') rDash();
      const x = document.querySelector('#pg-dash [data-dism]');
      const xH = x ? Math.round(x.getBoundingClientRect().height) : null;
      return { chip: chipH, x: xH };
    });
    check('the equipment category chips reach 44px too', extras.chip >= 44, extras);
    check('the alert dismiss × reaches 44px too', extras.x === null || extras.x >= 44, extras);
    await ctx.close();
  }

  console.log('\n2. on a desktop the tables stay dense — the fix is touch-only');
  {
    const { ctx, page } = await open(1280, false);
    const b = await rowBtns(page, 'ncr');
    check('a mouse still gets the compact 30px row buttons', b && b.h < 44 && b.h >= 28, b);
    await ctx.close();
  }

  console.log('\n3. the sweep itself: every page at 375px');
  {
    const { ctx, page, thrown } = await open(375, true);
    const sideways = [], errs = [];
    for (const pg of ALL_PAGES) {
      const before = thrown.length;
      const r = await page.evaluate((pg) => {
        try { goPage(pg); } catch (e) { return { threw: String(e && e.message) }; }
        return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, has: !!document.getElementById('pg-' + pg) };
      }, pg);
      await page.waitForTimeout(40);
      if (r.threw) errs.push({ pg: pg, threw: r.threw });
      else if (!r.has) errs.push({ pg: pg, missing: true });
      else if (r.over > 1) sideways.push({ pg: pg, over: r.over });
      thrown.slice(before).forEach((e) => errs.push({ pg: pg, err: e }));
    }
    check('none of the ' + ALL_PAGES.length + ' pages scrolls sideways at 375px', sideways.length === 0, sideways);
    check('none of them throws while rendering', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
