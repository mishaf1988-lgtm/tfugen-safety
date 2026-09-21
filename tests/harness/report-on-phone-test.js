// Do the printable reports work on the phone they are opened from?
//
// Michael opened «האם אנחנו בטוחים יותר?» on his phone on 2026-09-21 and sent
// the screenshot: the table running off the left edge, the summary pills cut
// in half, and a blank area taller than the screen where the chart should be,
// with the month axis stranded at the bottom of it.
//
// None of that was a layout bug in the report. Every one of these documents is
// written into a new window with `<head><meta charset="utf-8"><title>` and
// nothing else -- no viewport. Mobile Safari lays a page like that out at
// 980px and scales it, which clips the right-to-left content on the left and
// leaves a width:100% SVG with a height of the browser's choosing.
//
// They are A4 documents, and they stay A4 when printed: @page decides that,
// not the viewport tag. The tag only fixes what a person sees on the screen
// they opened it on.
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const ROOT = path.resolve(__dirname, '../..');
const HTML = 'file://' + path.join(ROOT, 'index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

console.log('\n1. every generated document declares a viewport');
{
  // These are built as strings and written into a new window, so the only
  // place to check is the source. A head without a viewport is a document
  // that will be laid out at 980px on every phone in the factory.
  const heads = src.match(/<head><meta charset="utf-8?-?8?"[^>]*>/gi) || [];
  const all = src.match(/<head><meta charset=/gi) || [];
  check('there are generated documents to check (' + all.length + ')', all.length >= 8, all.length);
  const withVp = (src.match(/<head><meta charset="[^"]+"><meta name="viewport"/gi) || []).length;
  check('each one carries a viewport meta right after the charset', withVp === all.length, { all: all.length, withVp: withVp });
  check('...width=device-width, not a fixed number',
    !/name="viewport" content="width=\d/i.test(src), 'a fixed viewport width defeats the point');
  void heads;
}

console.log('\n2. the chart has a size of its own');
{
  // width:100% and nothing else leaves the height to the browser. With an
  // explicit width and height the aspect ratio is unambiguous, and the CSS
  // scales it down responsively.
  const m = src.match(/<svg viewBox="0 0 '\+W\+' '\+H\+'"([^>]*NCR[^>]*)>/);
  check('the trend chart svg was found', !!m, m && m[0]);
  const attrs = (m && m[1]) || '';
  check('it declares width AND height, not width alone', /width="'\+W\+'"/.test(attrs) && /height="'\+H\+'"/.test(attrs), attrs);
  check('...and is still responsive in CSS', /width:100%/.test(attrs) && /height:auto/.test(attrs), attrs);
}

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // Capture the document the report would have written, and lay it out at
  // phone width -- the situation in the screenshot.
  const doc = await page.evaluate(() => {
    window.toast = function () {}; window.alert = function () {};
    DB.ncr = []; DB.inc = []; DB.near_miss = []; DB.rounds = []; DB.toolbox = []; DB.trustee_reports = [];
    let captured = '';
    const realOpen = window.open;
    window.open = function () {
      return {
        document: {
          open: function () {}, close: function () {},
          write: function (h) { captured += h; },
        },
        focus: function () {}, print: function () {}, close: function () {},
      };
    };
    try { window.safetyTrendReport(); } catch (e) { captured = 'ERROR ' + (e && e.message); }
    window.open = realOpen;
    return captured;
  });

  console.log('\n3. laid out at 390px, the way he saw it');
  {
    check('the report produced a document', doc.length > 500 && doc.indexOf('ERROR') !== 0, doc.slice(0, 120));
    const p2 = await ctx.newPage();
    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.setContent(doc, { waitUntil: 'load' });
    await p2.waitForTimeout(200);
    const m = await p2.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      svgH: (function () { const s = document.querySelector('.chart svg'); return s ? Math.round(s.getBoundingClientRect().height) : -1; })(),
      svgW: (function () { const s = document.querySelector('.chart svg'); return s ? Math.round(s.getBoundingClientRect().width) : -1; })(),
      offLeft: [...document.querySelectorAll('table, .summary, .head, .note')]
        .filter((e) => e.getBoundingClientRect().left < -0.5).length,
    }));
    // The clipping, measured: content wider than the screen has nowhere to go
    // but off the left edge in an RTL document.
    check('nothing is wider than the phone', m.docW <= m.vw + 1, m);
    check('...and nothing sits off the left edge', m.offLeft === 0, m);
    // The blank block. 340x150 scaled to the page width is about 150px tall;
    // anything near the height of the screen means the browser guessed.
    check('the chart keeps its shape instead of filling the page',
      m.svgH > 20 && m.svgH < 320, { h: m.svgH, w: m.svgW });
    check('...at roughly the 340:150 ratio it was drawn in',
      Math.abs((m.svgW / m.svgH) - (340 / 150)) < 0.35, { w: m.svgW, h: m.svgH, ratio: +(m.svgW / m.svgH).toFixed(2) });
    await p2.close();
  }

  console.log('\n4. it is still an A4 document');
  {
    // The viewport tag must not have turned a printable report into a web
    // page. @page is what decides the paper.
    check('@page size:A4 survived', /@page\{size:A4/.test(doc), doc.slice(doc.indexOf('@page'), doc.indexOf('@page') + 40));
    check('the signature block is still there', /הוכן על ידי/.test(doc));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
