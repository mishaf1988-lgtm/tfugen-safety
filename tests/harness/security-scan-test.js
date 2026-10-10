// Security scan 10/10/2026: three places where data reached HTML or a JS string unescaped.
// 1. The trustee "photo after" button put the report id inside onclick="...('id')". esc() turns
//    ' into &#39;, which the browser decodes back before running the handler, so an id with a
//    quote (an anonymous kiosk session may insert any id) ran as script. Now the id is read
//    from the row's data-tru-rep attribute.
// 2. The PTW print window (same origin) wrote every field raw.
// 3. The NCR agent panel wrote the AI's "risk" field raw.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const EVIL = "x');window.__pwned=1;//";
const TAG = '<img src=x onerror="window.__pwned=2">';

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })).newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  console.log('1. trustee "photo after" button');
  const r1 = await page.evaluate((id) => {
    var row = { id: id, t: 1, d: '2026-10-01', ok: false, s: 'פתוח', loc: 'a', f: 'b', u: 'n' };
    window._truIsHazard = function () { return true; };
    var box = document.createElement('div'); box.innerHTML = _truMineRowHtml(row, false); document.body.appendChild(box);
    var got = null; window._truReport = function (t, ref) { got = ref; };
    var b = box.querySelector('button'); if (b) b.click();
    return { html: box.innerHTML, got: got, pwned: window.__pwned || 0, hasBtn: !!b };
  }, EVIL);
  check('the button exists', r1.hasBtn, r1);
  check('a quote in the id does not run as script', r1.pwned === 0, r1);
  check('the click still passes the exact id', r1.got === EVIL, r1);
  check('the id is not inside the onclick', !/onclick="[^"]*x&#39;\)/.test(r1.html), r1.html);

  console.log('\n2. PTW print window');
  const r2 = await page.evaluate((tag) => {
    var out = '';
    window.svPtw = function () {};
    window.open = function () { return { document: { write: function (s) { out += s; }, close: function () {}, open: function () {} }, focus: function () {}, print: function () {} }; };
    var el = document.getElementById('ptw-con'); if (el) el.value = 'c';
    DB.ptw = [{ num: tag, con: tag, sup: tag, area: tag, dep: tag, ph: tag, wkr: tag, desc: tag, types: tag, safety: tag, ts: tag, te: tag, sg1n: tag, sg2n: tag, sg3n: tag, sg4n: tag }];
    try { ptwPrint(); } catch (e) { return { err: String(e) }; }
    return { raw: out.split('<img src=x').length - 1, escaped: out.split('&lt;img src=x').length - 1, len: out.length };
  }, TAG);
  check('every field escaped, none raw', r2.raw === 0 && r2.escaped === 17, r2);

  console.log('\n3. NCR agent: the AI risk field');
  const r3 = await page.evaluate((tag) => _ncrFmt({ risk: tag }, '', 'NCR-1'), TAG);
  check('risk is escaped', !/<img src=x/.test(r3) && /&lt;img src=x/.test(r3), r3);

  check('no page errors', !errs.length, errs);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
