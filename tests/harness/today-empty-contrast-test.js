// "Nothing pending" on the dashboard (13/10/2026): the factory-sign redesign gave
// #pg-dash .today-empty a green background (--s-green) but its ✓, "הכל מעודכן" and
// "אין פעולות ממתינות" kept --c-green-700, the same #237f52: an empty green box.
// Found by the contrast check added to visual-audit.js. Every text in that box
// must reach WCAG AA (4.5, or 3 for 24px+ / bold 18.66px+).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    try { rDash(); goPage('dash'); } catch (e) { return { err: e.message }; }
    const box = document.querySelector('#pg-dash .today-empty');
    if (!box) return { none: true };
    const rgb = (s) => s.replace('rgba(', '').replace('rgb(', '').replace(')', '').split(',').map(parseFloat);
    const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const bg = rgb(getComputedStyle(box).backgroundColor);
    return ['.te-ic', '.te-msg', '.te-sub'].map((s) => {
      const el = box.querySelector(s), cs = getComputedStyle(el), fg = rgb(cs.color);
      const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
      return { s, ratio: Math.round(ratio * 100) / 100, need: (px >= 24 || (bold && px >= 18.66)) ? 3 : 4.5, fg: cs.color, bg: getComputedStyle(box).backgroundColor };
    });
  });
  check('the dashboard shows the "nothing pending" box with no data', Array.isArray(r), r);
  if (Array.isArray(r)) for (const x of r) check(x.s + ' readable on the box (ratio ' + x.ratio + ', need ' + x.need + ')', x.ratio >= x.need, x);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
