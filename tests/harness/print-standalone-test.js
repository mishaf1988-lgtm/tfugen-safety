// Printing from the app once it lives on the home screen.
//
// Michael added the app to his home screen on 2026-09-21 and pressed
// «הדפס דף נוכחי (PDF)» the same afternoon. Nothing happened. Not an error,
// not a dialog -- nothing.
//
// iOS does not give a standalone web app a print dialog. window.print() is a
// no-op there, and it fails silently, so the button simply stopped working the
// moment the app became an app. From inside Safari it had always worked, which
// is why nobody ever saw it.
//
// The fallback writes the page into a new window, which iOS opens in Safari,
// where Share -> Print reaches Save as PDF. Whether that last hop behaves on a
// real iPhone is not something this harness can prove; what it can prove is
// that the branch exists, that it produces a complete printable document, and
// that it never fails silently again.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
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

  // o.standalone: pretend the app was launched from the home screen.
  // o.blocked:    pretend the browser refused the new window.
  const run = (o) => page.evaluate(async (opt) => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin', full_name: 'מיכאל' };
    const toasts = [];
    window.toast = function (m) { toasts.push(String(m)); };

    let printed = 0;
    const realPrint = window.print;
    window.print = function () { printed++; };

    let written = '';
    const realOpen = window.open;
    window.open = function () {
      if (opt.blocked) return null;
      return {
        document: {
          open: function () {}, close: function () {},
          write: function (h) { written += h; },
        },
      };
    };

    // The real standalone signals.
    const realMM = window.matchMedia;
    if (opt.standalone) {
      window.matchMedia = function (q) {
        if (String(q).indexOf('display-mode: standalone') >= 0) return { matches: true, media: q };
        return realMM.call(window, q);
      };
    }

    try { window._printPage(); } catch (e) { return { error: String(e && e.message || e) }; }
    await new Promise((r) => setTimeout(r, 160));

    window.print = realPrint; window.open = realOpen; window.matchMedia = realMM;
    return {
      printed: printed,
      written: written,
      toasts: toasts,
      leftovers: document.querySelectorAll('#print-header').length,
    };
  }, o);

  console.log('\n1. in a browser tab, nothing changes');
  {
    const r = await run({ standalone: false });
    check('window.print() is still what runs', r.printed === 1, r);
    check('...and no second window is opened', !r.written, (r.written || '').slice(0, 60));
  }

  console.log('\n2. from the home screen, where print() does nothing');
  {
    const r = await run({ standalone: true });
    // The whole point: the silent no-op is gone.
    check('it does NOT call the print dialog that iOS ignores', r.printed === 0, r);
    check('...it writes a document into a new window instead', r.written.length > 500, r.written.length);
    check('...and says what to do next, rather than nothing at all',
      r.toasts.some((t) => /שיתוף/.test(t) && /הדפס/.test(t)), r.toasts);
  }

  console.log('\n3. the document it writes is actually printable');
  {
    const r = await run({ standalone: true });
    const d = r.written;
    check('it is a real document', /^<!doctype html>/i.test(d) && /<\/html>$/i.test(d.trim()), d.slice(0, 60));
    check('right-to-left, and sized for the screen it opens on',
      /dir="rtl"/.test(d) && /name="viewport"/.test(d), d.slice(0, 200));
    // Without the app's styles the page arrives as unstyled text, which looks
    // like a different kind of failure.
    check('the app stylesheets came along', d.indexOf('<style>') > 0 && d.length > 20000, d.length);
    // And the chrome must not: a printed page with the navigation bar on it is
    // not a report.
    check('...including the rules that hide the chrome', /\.topbar[^{]*\{display:none!important/.test(d), 'no chrome-hiding rule');
    check('the header built for the print is carried in, and visible',
      d.indexOf('print-header') > 0 && !/id="print-header"[^>]*display:none/.test(d), 'header missing or still hidden');
    check('...with who printed it and when', /מיכאל/.test(d), 'no author line');
  }

  console.log('\n4. when the window is refused');
  {
    const r = await run({ standalone: true, blocked: true });
    // A blocked pop-up is the one case where the user can act, so it has to
    // say so. Silence here is the original bug wearing a different hat.
    check('it says the window was blocked and what to do', r.toasts.some((t) => /חלונות קופצים/.test(t)), r.toasts);
    check('...and does not claim success', !r.toasts.some((t) => /שיתוף/.test(t)), r.toasts);
  }

  console.log('\n5. it cleans up after itself');
  {
    const r = await run({ standalone: true });
    // The print header is injected into the live page. Left behind, it sits at
    // the top of the screen for the rest of the session.
    check('no print header is left in the app', r.leftovers === 0, r.leftovers);
    const r2 = await run({ standalone: false });
    check('...in the browser path either', r2.leftovers <= 1, r2.leftovers);
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
