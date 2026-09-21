// Getting back out of a screen.
//
// Michael, 2026-09-21, after installing the app on his home screen: «ואין
// כפתור חזרה במסכים אחורה». He is right, and it is a consequence of the icon:
// a standalone web app has no browser chrome, so there is no back button and
// no address bar, and the left-edge swipe is not something anyone is told
// about. In Safari the browser supplied it and nobody noticed it was missing.
//
// The history was already wired -- goPage pushes a state and popstate
// navigates. What was missing was the affordance.
//
// The one thing to be careful about: history.length also counts whatever the
// browser was showing before the app opened. Going "back" into that from a
// home-screen app means leaving the app, which is why the depth is counted
// rather than read off history.
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

  const boot = () => page.evaluate(() => {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    window._currentUser = { username: 'admin' }; window._isAdmin = true;
    window.toast = function () {}; window.alert = function () {};
    try { _applyRoleGates(); } catch (e) {}
  });
  const state = () => page.evaluate(() => {
    const b = document.getElementById('back-btn');
    return {
      cur: (typeof CUR !== 'undefined') ? CUR : null,
      shown: !!(b && b.offsetParent !== null),
      label: b ? (b.getAttribute('aria-label') || '') : null,
    };
  });

  await boot();

  console.log('\n1. on the home page there is nothing to go back from');
  {
    await page.evaluate(() => goPage('dash'));
    await page.waitForTimeout(80);
    const s = await state();
    check('the app starts on the dashboard', s.cur === 'dash', s);
    check('...and the back button is not shown there', !s.shown, s);
  }

  console.log('\n2. it appears as soon as you go somewhere');
  {
    await page.evaluate(() => goPage('ncr'));
    await page.waitForTimeout(80);
    const s = await state();
    check('on another page it is there', s.shown && s.cur === 'ncr', s);
    check('...and it says what it is, for a screen reader', /חזרה/.test(s.label || ''), s.label);
  }

  console.log('\n3. it actually goes back, one page at a time');
  {
    await page.evaluate(() => { goPage('tasks'); });
    await page.waitForTimeout(80);
    check('three pages deep', (await state()).cur === 'tasks');
    await page.evaluate(() => goBack());
    await page.waitForTimeout(140);
    check('back once lands on the previous page, not on home', (await state()).cur === 'ncr', await state());
    await page.evaluate(() => goBack());
    await page.waitForTimeout(140);
    const s = await state();
    check('back again reaches the dashboard', s.cur === 'dash', s);
    check('...where the button disappears again', !s.shown, s);
  }

  console.log('\n4. with nowhere to go back to, it goes home');
  {
    // A fresh session opened straight onto a page -- from a shortcut, a
    // bookmark, a link. history.back() there walks out of the app.
    const p2 = await ctx.newPage();
    await p2.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await p2.goto(HTML, { waitUntil: 'load' });
    await p2.waitForTimeout(700);
    const r = await p2.evaluate(async () => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      window._currentUser = { username: 'admin' }; window._isAdmin = true;
      window.toast = function () {}; window.alert = function () {};
      try { _applyRoleGates(); } catch (e) {}
      let backCalls = 0;
      const realBack = history.back.bind(history);
      history.back = function () { backCalls++; realBack(); };
      // Simulate landing on a page without having navigated there, in a
      // browser that already had history of its own. Without that second
      // entry, history.length is 1 and trusting it looks identical to
      // counting -- the check would pass against either.
      try { history.pushState({ seed: 1 }, '', '#seed'); } catch (e) {}
      if (typeof CUR !== 'undefined') CUR = 'ncr';
      window._navDepth = 0;
      goBack();
      await new Promise((res) => setTimeout(res, 120));
      history.back = realBack;
      return { backCalls: backCalls, cur: (typeof CUR !== 'undefined') ? CUR : null };
    });
    check('it does NOT call history.back(), which would leave the app', r.backCalls === 0, r);
    check('...it goes to the dashboard instead', r.cur === 'dash', r);
    await p2.close();
  }

  console.log('\n5. the row still fits');
  {
    for (const w of [320, 360, 375, 390]) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.waitForTimeout(100);
      await page.evaluate(() => goPage('ncr'));
      await page.waitForTimeout(80);
      const m = await page.evaluate(() => {
        const tb = document.querySelector('.topbar');
        return { overflow: tb.scrollWidth - tb.clientWidth, n: tb.querySelectorAll('button').length };
      });
      check(w + 'px: the header does not overflow with the extra control', m.overflow === 0, m);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
