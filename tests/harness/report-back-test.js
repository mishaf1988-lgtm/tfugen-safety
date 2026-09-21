// Getting out of a report.
//
// Michael, 2026-09-21, once the PDF finally worked: «מעולה, אין כפתור חזרה
// לדף הקודם». The reports are written into a window of their own, and a window
// opened from a home-screen app has no browser chrome -- no address bar, no
// back arrow. Nine of the ten had no way back at all; the tenth had one in a
// toolbar that scrolls off the top of a long report.
//
// So there is one control now, fixed in the corner of every report. What it
// does depends on how the report was reached, and the three cases are the
// point of this suite: go back if there is a back, close if the window can
// close itself, and otherwise land in the app rather than nowhere.
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const SRC = path.resolve(__dirname, '../../index.html');
const ORIGIN = 'https://tapugan.test';
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // A real report, captured as the app writes it into its window.
  const doc = await page.evaluate(() => {
    window.toast = function () {}; window.alert = function () {};
    const mm = new Date().toISOString().substring(0, 7);
    DB.ncr = [{ id: 'n1', d: mm + '-05', s: 'פתוח', ts: mm + '-05T08:00:00Z' }];
    DB.inc = []; DB.near_miss = []; DB.rounds = []; DB.toolbox = []; DB.trustee_reports = [];
    let out = '';
    const realOpen = window.open;
    window.open = function () {
      return { document: { open: function () {}, close: function () {}, write: function (h) { out += h; } } };
    };
    try { window.safetyTrendReport(); } catch (e) { out = 'ERROR ' + (e && e.message); }
    window.open = realOpen;
    return out;
  });

  // The report the way the app actually produces it: a window opened by
  // script, on a real origin. Both details decide what the button can do --
  // only a script-opened window may close itself, and «go to the app» is a
  // navigation this harness can watch rather than a string it has to trust.
  await ctx.route(ORIGIN + '/**', (r) => {
    const u = r.request().url();
    if (u === ORIGIN + '/report') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: doc });
    if (u === ORIGIN + '/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body>THE APP</body></html>' });
    return r.abort();
  });
  const openReport = async () => {
    const host = await ctx.newPage();
    await host.setViewportSize({ width: 390, height: 844 });
    await host.goto(ORIGIN + '/', { waitUntil: 'load' });
    const [p] = await Promise.all([
      ctx.waitForEvent('page'),
      host.evaluate((o) => { window.open(o + '/report', '_blank'); }, ORIGIN),
    ]);
    await p.waitForLoadState('load');
    await p.setViewportSize({ width: 390, height: 844 });
    p.__host = host;
    return p;
  };
  const closeReport = async (p) => { await p.close().catch(() => {}); await p.__host.close().catch(() => {}); };

  console.log('\n1. every report has a way out');
  {
    const p = await openReport();
    const r = await p.evaluate(() => {
      const b = document.getElementById('rpt-back');
      if (!b) return { missing: true };
      const cs = getComputedStyle(b);
      return {
        label: b.textContent.trim(),
        visible: cs.display !== 'none' && cs.visibility !== 'hidden',
        fixed: cs.position === 'fixed',
        rect: b.getBoundingClientRect().toJSON(),
        print: (document.querySelector('.no-print:not(#rpt-back)') || {}).getBoundingClientRect
          ? document.querySelector('.no-print:not(#rpt-back)').getBoundingClientRect().toJSON() : null,
        vw: innerWidth,
      };
    });
    check('the button is there', !r.missing, r);
    check('...and says what it does, in Hebrew', /חזרה/.test(r.label || ''), r.label);
    check('...pinned to the corner, so a long report cannot scroll it away',
      r.fixed && r.rect.top < 40, { fixed: r.fixed, top: r.rect && r.rect.top });
    // .no-print in these documents pins the print button to left:8px. Without
    // an explicit left:auto the back button inherits it, and a fixed box with
    // both edges set stretches the width of the header -- over the print
    // button, which is the one thing it must not cover.
    check('...a button, not a bar across the header (' + Math.round(r.rect.width) + 'px)',
      r.rect.width < 200, r.rect);
    check('...on the opposite side from the print button',
      r.rect.right > r.vw - 40, { right: r.rect.right, vw: r.vw });
    check('...and not on top of it', !r.print || r.rect.left > r.print.right || r.rect.right < r.print.left,
      { back: r.rect, print: r.print });
    await closeReport(p);
  }

  console.log('\n2. it is not part of the report');
  {
    const p = await openReport();
    const r = await p.evaluate(() => {
      const b = document.getElementById('rpt-back');
      // The PDF builder hides everything marked no-print before capturing.
      const hidden = [].slice.call(document.querySelectorAll('.no-print,.noprint')).indexOf(b) >= 0;
      const printRule = [].slice.call(document.querySelectorAll('style'))
        .some(function (s) { return /@media print[^}]*\{[^}]*#rpt-back/.test(s.textContent); });
      return { hidden: hidden, printRule: printRule };
    });
    check('the PDF leaves it out', r.hidden, r);
    // Not every one of the ten documents styles .no-print outside @media
    // print, so the rule travels with the button instead of being assumed.
    check('...and so does a printed page', r.printRule, r);
    await closeReport(p);
  }

  console.log('\n3. when there is a page behind it, it goes back');
  {
    const p = await openReport();
    const r = await p.evaluate(async () => {
      // The user tapped «פתח את המסמך», the pop-up was blocked, and the PDF
      // replaced the report in this same window. Back means back.
      history.pushState({}, '', '#pdf');
      const calls = [];
      history.back = function () { calls.push('back'); };
      window.close = function () { calls.push('close'); };
      const before = location.href;
      _rptBack();
      await new Promise((r2) => setTimeout(r2, 700));
      return { calls: calls, href: location.href, before: before, len: history.length };
    });
    check('it steps back in history', r.calls[0] === 'back', r);
    check('...and does nothing else: no closing, no jumping to the app',
      r.calls.length === 1, r.calls);
    check('...and stays on the report', p.url() === ORIGIN + '/report#pdf', p.url());
    await closeReport(p);
  }

  console.log('\n4. a window of its own closes itself');
  {
    const p = await openReport();
    const r = await p.evaluate(async () => {
      const calls = [];
      history.back = function () { calls.push('back'); };
      window.close = function () { calls.push('close'); };
      _rptBack();
      await new Promise((r2) => setTimeout(r2, 250));
      return { calls: calls, len: history.length };
    });
    // A freshly opened report window has nowhere to go back to: history.length
    // is 1 and history.back() is a silent no-op. Calling it anyway is the bug
    // this case exists for -- the button would do nothing at all.
    check('nothing to go back to, so it closes the window', r.calls.join() === 'close', r);

    console.log('\n5. and if it cannot close, it lands in the app');
    // window.close() only works on a window script opened. Anywhere else it is
    // silently ignored -- and silence is what Michael reported in the first
    // place. So the last resort is the app itself.
    await p.waitForURL(ORIGIN + '/', { timeout: 3000 }).catch(() => {});
    check('the last resort is the app, not a dead page', p.url() === ORIGIN + '/', p.url());
    const body = await p.evaluate(() => document.body.textContent.trim()).catch(() => '');
    check('...and it really loaded', body === 'THE APP', body);
    await closeReport(p);
  }

  console.log('\n6. all ten reports, not just the one this suite renders');
  {
    const src = fs.readFileSync(SRC, 'utf8');
    const heads = (src.match(/<head><meta charset="[^"]+"><meta name="viewport"[^>]*><script>function _rptMsg/gi) || []).length;
    const backs = (src.match(/function _rptBack\(/g) || []).length;
    check('the handler is in every generated document (' + backs + '/' + heads + ')',
      heads >= 10 && backs === heads, { heads: heads, backs: backs });
    const wired = (src.match(/document\.addEventListener\(\\'DOMContentLoaded\\',_rptBackBtn\)/g) || []).length;
    check('...and every one of them builds the button', wired === heads, { wired: wired, heads: heads });
    // The photo report used to carry its own, in a toolbar that scrolls off
    // the top. Two back buttons that behave differently is worse than one.
    const old = (src.match(/try\{window\.close\(\)\}catch\(e\)\{\}history\.back\(\)/g) || []).length;
    check('and the old scrolling duplicate is gone', old === 0, old + ' left');
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
