// Every page at phone width (390px): no button, field or select off the screen, no page
// error (07/10/2026, Michael in a questionnaire: "build it now"). The screen review of
// 07/10/2026 found 3 buttons of a weekly talk off the left edge; a table on a phone is
// cards and does not scroll, so an RTL overflow to the left is not even scrollable.
// Data is made up: one long row in every DB table, plus a published talk with all its buttons.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const pages = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sbIns = () => {}; window.sbUpd = () => {}; window.sdb = () => {}; window.toast = () => {}; window.addLog = () => {};
    window._role = () => 'admin'; window._isAdminUser = () => true; _isAdmin = true; window._currentUser = { username: 'admin' };
    const long = 'תיאור ארוך מאוד של ממצא בטיחות ליד קו הייצור המרכזי, כולל מעבר חסום ושילוט חסר בפינה הצפונית';
    const row = (k) => ({ id: k + '-x1', n: long, d: '2026-10-01', e: '2026-11-01', s: 'פתוח', descr: long, title: long, f: long, loc: 'ייצור, חדר חשמל', dept: 'ייצור', code: 'EQUIP-LONG-CODE-0001', num: 'NCR-0001', ty: 'תאונת עבודה', area: 'ייצור', notes: long, w: 'דנה כהן', r: 'אחראי', u: '2026-10-15', due: '2026-10-15', sev: 'גבוהה', p: 'גבוהה', o: 'דנה כהן', a: 'דנה כהן', type: 'כללי', ok: false, m: '2026-10', t: 1, tour: 'tour1', priority: 'רגיל', status: 'פתוח', assignee: 'דנה כהן' });
    Object.keys(DB).forEach((k) => { if (Array.isArray(DB[k]) && k !== 'hist') DB[k] = [row(k)]; });
    DB.toolbox_talks = [{ id: 'tb1', d: '2026-10-04', title: 'דרך אחת בטיחות', body: 'x', s: 'פורסמה', link_at: new Date().toISOString(), trainer: 'דנה כהן', trainer_qual: 'ממונה בטיחות' }];
    DB.toolbox_reads = [];
    return [...document.querySelectorAll('[id^="pg-"]')].map((x) => x.id.slice(3)).filter((x) => !/^emp-home$|^ptw-view$/.test(x));
  });
  check('found the app pages (30+)', pages.length >= 30, pages);
  for (const p of pages) {
    const e0 = errs.length;
    const bad = await page.evaluate((p) => {
      try { goPage(p); } catch (e) { return ['goPage threw: ' + e.message]; }
      const pg = document.getElementById('pg-' + p); if (!pg) return [];
      return [...pg.querySelectorAll('button,a.btn,select,input:not([type=hidden]),textarea')].filter((x) => {
        const c = x.getBoundingClientRect(); return c.width > 0 && c.height > 0 && x.offsetParent && (c.left < -1 || c.right > window.innerWidth + 1);
      }).map((x) => ((x.textContent || x.placeholder || x.id || x.tagName).trim().slice(0, 20)) + ' ' + Math.round(x.getBoundingClientRect().left) + '..' + Math.round(x.getBoundingClientRect().right));
    }, p);
    check(p + ': every control on screen, no page error', !bad.length && errs.length === e0, { off: bad, errs: errs.slice(e0, e0 + 2) });
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
