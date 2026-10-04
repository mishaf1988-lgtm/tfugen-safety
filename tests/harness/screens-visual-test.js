// Three more modules on a phone (04/10/2026, Michael: "yes" to screen tests like
// toolbox-visual-test.js): hazard tours, trustee reports and equipment. At 375
// pixels: each page, its new-row form, its edit form and its detail view. For
// each: no sideways scroll, nothing off the screen, no button or placeholder cut,
// no raw entity (&#...;), "undefined" or "NaN" in what is shown.
// SHOTS=<dir> also saves a picture of each.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 500) : '')); } };

// Measured inside one root (a modal, or the page): what a person would see.
function measure(sel) {
  const W = window.innerWidth, root = sel ? document.querySelector(sel) : document.body;
  const out = { sw: document.documentElement.scrollWidth, off: [], cut: [], raw: [] };
  if (!root) return { missing: sel };
  const ctx = document.createElement('canvas').getContext('2d');
  root.querySelectorAll('input:not([type=hidden]),select,textarea,button,label,.b,h2,h3,.modal-title,.card-title').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !el.offsetParent) return;
    // Inside a scrolling table box the box is what has to fit.
    const box = el.closest('.tbl-wrap');
    const lim = box ? box.getBoundingClientRect() : { left: 0, right: W };
    if (!box && (r.left < -1 || r.right > W + 1)) out.off.push((el.id || el.tagName + ':' + el.textContent.trim().slice(0, 18)) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (box && (lim.left < -1 || lim.right > W + 1)) out.off.push('tbl-wrap ' + Math.round(lim.left) + '..' + Math.round(lim.right));
    const st = getComputedStyle(el);
    if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 1 && st.overflow !== 'visible') out.cut.push('button:' + el.textContent.trim().slice(0, 20));
    if (el.tagName === 'INPUT' && el.placeholder) {
      ctx.font = st.fontSize + ' ' + st.fontFamily;
      if (ctx.measureText(el.placeholder).width > el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) + 1) out.cut.push('placeholder:' + (el.id || el.name));
    }
  });
  const txt = root.innerText || '';
  (txt.match(/&#\d+;|&[a-z]+;|\bundefined\b|\bNaN\b/g) || []).forEach((x) => out.raw.push(x));
  return out;
}
const fine = (m) => m && !m.missing && m.sw <= 375 && !m.off.length && !m.cut.length && !m.raw.length;

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const shots = process.env.SHOTS || '';
  const shot = async (n) => { if (shots) await page.screenshot({ path: shots + '/scr-' + n + '.png', fullPage: true }); };
  await page.evaluate(() => {
    window._role = () => 'admin'; window._isAdminUser = () => true; window.sdb = function () {}; window.sbIns = function () {}; window.sbUpd = function () {}; window.addLog = function () {};
    window._currentUser = { username: 'admin' };
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    const t = new Date().toISOString().substring(0, 10), now = new Date().toISOString();
    DB.emp = [{ id: 'e1', n: 'דנה כהן', dep: 'ייצור' }, { id: 'e2', n: 'איוון סמירנוב-קוזלובסקי', dep: 'מחלקת אחזקה ותשתיות' }];
    DB.tour_hazards = [
      { id: 'h1', d: t, tour_no: 12, dept: 'ייצור', loc: 'קו מילוי 3 ליד המסוע הראשי והמדרגות לגלריה', descr: 'מגן חסר על שרשרת ההנעה של המסוע, אפשרות לתפיסת יד או בגד בזמן ניקוי הקו בסוף משמרת', sev: 'גבוהה', resp: 'מנהל המחלקה', action: 'להתקין מגן קבוע מרשת ולסמן', due: t, s: 'פתוח', ts: now },
      { id: 'h2', d: '2026-09-01', tour_no: 11, dept: 'אחזקה', loc: 'מחסן', descr: 'משטח שבור', sev: 'נמוכה', s: 'סגור', closed_d: '2026-09-10', ts: now },
    ];
    DB.trustee_reports = [
      { id: 'r1', u: 'איוון סמירנוב-קוזלובסקי', t: 1, d: t, loc: 'מחלקת אחזקה ותשתיות \u00b7 חדר מדחסים', f: 'דלת חירום חסומה במשטחים ובקרטונים, אין גישה חופשית ליציאה בזמן אמת', ok: false, s: 'פתוח', ts: now },
      { id: 'r2', u: 'דנה כהן', t: 2, d: t, ok: true, ts: now },
    ];
    DB.equip_inspections = [
      { id: 'q1', code: 'EQ-0001-LONG', n: 'מלגזה חשמלית 3 טון עם תורן כפול וזרועות מתכווננות', vendor: 'חברת בדיקות ובטיחות ציוד הרמה בע"מ', loc: 'מחסן חומרי גלם צפוני', d: '2026-09-01', e: '2027-09-01', s: 'תקין', ts: now },
      { id: 'q2', code: 'EQ-2', n: 'מדחס', loc: 'חדר מכונות', d: '2025-09-01', e: '2026-09-01', s: 'פג תוקף', ts: now },
    ];
  });

  // [name, page, what to open, root to measure, text that must be on screen]
  const steps = [
    ['tours page', 'thz', null, '#pg-thz', 'מגן חסר'],
    ['tours: new hazard form', 'thz', "openModal('m-thz')", '#m-thz', ''],
    ['tours: edit a hazard', 'thz', "_genEdit('tour_hazards','h1')", '#m-thz', '#thz-descr=מגן חסר'],
    ['tours: hazard detail', 'thz', "showView('tour_hazards','h1')", '#pg-view', 'מגן חסר'],
    ['trustees page', 'trustees', null, '#pg-trustees', 'דלת חירום'],
    ['trustees: new report form', 'trustees', "openModal('m-tru')", '#m-tru', ''],
    ['trustees: one report (the app opens it in the full list)', 'trustees', "showView('trustee_reports','r1')", '#pg-trustees', 'דלת חירום'],
    ['equipment page', 'eqi', null, '#pg-eqi', 'EQ-0001-LONG'],
    ['equipment: new item form', 'eqi', "openModal('m-eqi')", '#m-eqi', ''],
    ['equipment: edit an item', 'eqi', "eqiEdit('q1')", '#m-eqi', '#eqi-n=מלגזה'],
    ['equipment: item detail', 'eqi', "showView('equip_inspections','q1')", '#pg-view', '01/09/2026'],
  ];
  for (const [name, pg, open, root, want] of steps) {
    const err = await page.evaluate(([pg, open]) => {
      try { document.querySelectorAll('.modal').forEach((m) => { if (m.style.display !== 'none') closeModal(m.id); }); goPage(pg); if (open) (0, eval)(open); return null; } catch (e) { return String(e); }
    }, [pg, open]);
    await page.waitForTimeout(300);
    const m = err ? { error: err } : await page.evaluate(measure, root);
    check(name + ': fits, nothing cut', !err && fine(m), m);
    // A green measure over an empty screen proves nothing: the seeded row has to be there.
    if (want) {
      const seen = await page.evaluate(([root, want]) => {
        if (want[0] === '#') { const [id, v] = want.split('='); const el = document.querySelector(id); return el ? el.value : 'no ' + id; }
        return (document.querySelector(root) || {}).innerText || '';
      }, [root, want]);
      check(name + ': shows the seeded row', seen.includes(want.split('=').pop()), seen.slice(0, 120));
    }
    // Dates people read are DD/MM/YYYY (CLAUDE.md); a raw 2026-09-01 in text is a miss.
    const iso = await page.evaluate((root) => ((document.querySelector(root) || {}).innerText || '').match(/\b\d{4}-\d{2}-\d{2}\b/g), root);
    check(name + ': no YYYY-MM-DD date in the text', !iso, iso);
    await shot(name.replace(/[^a-z]+/g, '-'));
  }
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
