// Redesign phase 2 (12/10/2026): the home screen in the "factory sign" language.
// The Today rows draw ISO 7010-style signs for known emoji (yellow triangle warns,
// blue circle is a must-do, green square is safe, red square is fire equipment),
// keep an unknown emoji as it is (escaped), and the sign fonts and colours are loaded.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const warn = _signIcon('⚠️'), must = _signIcon('🔧'), safe = _signIcon('✅'), fire = _signIcon('🧯');
    const odd = _signIcon('<b>x</b>'), keep = _signIcon('📦');
    document.getElementById('login').style.display = 'none'; document.getElementById('app').style.display = 'block';
    window.sdb = function () {}; window._currentUser = { username: 'admin' }; _isAdmin = true;
    const d = new Date(); d.setDate(d.getDate() - 5);
    DB.equip_inspections = [{ id: 'e1', n: 'x', e: d.toISOString().slice(0, 10) }];
    goPage('dash'); try { rDash(); } catch (e) {}
    const root = getComputedStyle(document.documentElement);
    const hdr = document.querySelector('#pg-dash .today-header');
    return {
      warn: /M12 1\.8 23 21\.5H1z/.test(warn) && /--s-yellow/.test(warn),
      must: /<circle cx="12" cy="12" r="11" fill="var\(--s-blue/.test(must),
      safe: /--s-green/.test(safe) && /<rect/.test(safe),
      fire: /--s-red/.test(fire),
      odd, keep,
      rowSvg: !!document.querySelector('#today-items .ti-ic svg.sign-ic'),
      yellow: root.getPropertyValue('--s-yellow').trim(),
      hdrBg: hdr ? getComputedStyle(hdr).backgroundColor : null,
      radius: hdr ? getComputedStyle(document.querySelector('#pg-dash .today-list')).borderRadius : null,
      fonts: /Karantina/.test(document.head.innerHTML) && /IBM\+Plex\+Sans\+Hebrew/.test(document.head.innerHTML),
    };
  });
  check('a warning emoji becomes a yellow triangle', r.warn);
  check('equipment becomes a blue must-do circle', r.must);
  check('done becomes a green square', r.safe);
  check('the extinguisher becomes a red square', r.fire);
  check('unknown text is escaped, not drawn as markup', r.odd === '&lt;b&gt;x&lt;/b&gt;', r.odd);
  check('an emoji with no sign stays as it is', r.keep === '📦', r.keep);
  check('the Today row on the home screen draws the sign', r.rowSvg);
  check('the sign colours are on :root', r.yellow === '#f9a800', r.yellow);
  check('the Today header is sign yellow with square corners', r.hdrBg === 'rgb(249, 168, 0)' && r.radius === '0px', [r.hdrBg, r.radius]);
  check('the sign fonts are requested', r.fonts);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
