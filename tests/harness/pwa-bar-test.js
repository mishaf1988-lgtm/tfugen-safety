// The install bar on phones (14/11/2026). Michael asked about the App Store
// and Google Play and chose "easy install, free": the app is already a PWA,
// but its only install offer was a button that appears on beforeinstallprompt,
// which iPhone never fires. So an iPhone worker was never told the app can be
// installed. This suite drives the bar with each phone's user agent.
//
// Not covered here, and only a real phone can: that Safari's share sheet
// really says "add to home screen" in Hebrew, and that the icon lands there.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const UA = {
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  crios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  // WhatsApp's in-app viewer on iPhone: a WKWebView, no "Safari/" token.
  wa: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

let browser;
async function open(ua, opts) {
  opts = opts || {};
  const ctx = opts.ctx || await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  if (!opts.ctx && opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto(HTML + (opts.qs || ''), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const bar = (page) => page.evaluate(() => {
  const b = document.getElementById('pwa-bar');
  if (!b) return null;
  return { txt: b.textContent.replace(/\s+/g, ' ').trim(), plat: b.dataset.plat, svg: !!b.querySelector('svg'),
    go: !!document.getElementById('pwa-bar-go'), vis: b.getBoundingClientRect().height > 0 };
});
const STANDALONE_IOS = () => Object.defineProperty(navigator, 'standalone', { get: () => true });
const STANDALONE_MQ = () => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q); };

(async () => {
  browser = await pw.chromium.launch();

  console.log('\n1. iPhone, Safari: the share button, then "add to home screen"');
  {
    const { ctx, page } = await open(UA.safari);
    const b = await bar(page);
    check('the bar is on the login screen', b && b.vis && b.plat === 'ios-safari', b);
    check('...it says: share button, then \'הוסף למסך הבית\'', b && /כפתור השיתוף/.test(b.txt) && /'הוסף למסך הבית'/.test(b.txt), b && b.txt);
    check('...with the share icon drawn', b && b.svg, b);
    await page.screenshot({ path: require('os').tmpdir() + '/pwa-bar-ios.png' });
    // After login it is still there, at the bottom edge, over the app.
    const after = await page.evaluate(() => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      return new Promise((res) => setTimeout(() => {
        const b = document.getElementById('pwa-bar'), r = b && b.getBoundingClientRect();
        const top = r && document.elementFromPoint(r.left + 20, r.top + r.height / 2);
        res({ there: !!b, bottom: r && r.bottom, h: innerHeight, onTop: !!(top && b.contains(top)) });
      }, 300));
    });
    check('after login it is still shown, at the bottom edge and not covered', after.there && Math.abs(after.bottom - after.h) < 1 && after.onTop, after);

    console.log('\n2. closing it is remembered');
    await page.click('#pwa-bar-x');
    check('the close button removes it', !(await bar(page)));
    const again = await open(UA.safari, { ctx });
    check('the next load does not show it', !(await bar(again.page)));
    const stored = await again.page.evaluate(() => +localStorage.getItem('tfgn_pwa_bar_closed'));
    check('...because the close time is stored', stored > Date.now() - 60000, stored);
    // 31 days later it comes back.
    await again.page.evaluate(() => localStorage.setItem('tfgn_pwa_bar_closed', String(Date.now() - 31 * 864e5)));
    const later = await open(UA.safari, { ctx });
    check('after 30 days it is shown again', !!(await bar(later.page)));
    await later.page.click('#pwa-bar-x');

    console.log('\n3. ?install=1 brings it back after closing, and does nothing else');
    const forced = await open(UA.safari, { ctx, qs: '?install=1' });
    const fb = await bar(forced.page);
    check('the install link shows it although it was closed', fb && fb.plat === 'ios-safari', fb);
    const st = await forced.page.evaluate(() => ({ login: getComputedStyle(document.getElementById('login')).display !== 'none', emp: document.body.classList.contains('emp-mode') }));
    check('...and the login screen is the same as without it', st.login && !st.emp, st);
    await ctx.close();
  }

  console.log('\n4. iPhone, another browser: open in Safari');
  for (const k of ['crios', 'wa']) {
    const { ctx, page } = await open(UA[k]);
    const b = await bar(page);
    check(k + ': "פתחו את הקישור בספארי כדי להתקין"', b && b.plat === 'ios-other' && /פתחו את הקישור בספארי כדי להתקין/.test(b.txt) && !b.svg, b);
    await ctx.close();
  }

  console.log('\n5. Android: the real install prompt, or the Chrome menu');
  {
    const { ctx, page } = await open(UA.android);
    let b = await bar(page);
    check('before the browser offers install: the menu instruction, no button', b && b.plat === 'android' && /שלוש הנקודות/.test(b.txt) && /'התקנת אפליקציה'/.test(b.txt) && !b.go, b);
    await page.evaluate(() => {
      window.__prompted = 0;
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => { window.__prompted++; };
      e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    await page.waitForTimeout(100);
    b = await bar(page);
    check('after beforeinstallprompt: an "התקנה" button', b && b.go && /התקנה/.test(b.txt), b);
    await page.click('#pwa-bar-go');
    await page.waitForTimeout(100);
    check('...which calls the browser\'s prompt', (await page.evaluate(() => window.__prompted)) === 1);
    b = await bar(page);
    check('...and after "not now" the bar falls back to the menu instruction', b && !b.go && /שלוש הנקודות/.test(b.txt), b);
    await ctx.close();
  }

  console.log('\n6. already installed, or a computer: nothing');
  {
    let r = await open(UA.safari, { init: STANDALONE_IOS, qs: '?install=1' });
    check('iPhone opened from the home screen (navigator.standalone), even with ?install=1', !(await bar(r.page)));
    await r.ctx.close();
    r = await open(UA.android, { init: STANDALONE_MQ });
    check('Android opened as an app (display-mode: standalone)', !(await bar(r.page)));
    await r.ctx.close();
    r = await open(UA.desktop, { qs: '?install=1' });
    check('desktop, even with ?install=1', !(await bar(r.page)));
    await r.ctx.close();
  }

  console.log('\n7. the code keeps the repo rules');
  {
    const src = require('fs').readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    const block = src.slice(src.indexOf('/* ---- Install bar on phones'), src.indexOf('/* ---- WhatsApp test ---- */'));
    check('the block was found', block.length > 500, block.length);
    check('no raw Hebrew in it (\\uXXXX only)', !/[֐-׿]/.test(block));
    const uses = block.split('\n').map((l, i, a) => ({ l, prev: a[i - 1] || '' })).filter((x) => /localStorage\./.test(x.l));
    check('localStorage is read and written inside try/catch (' + uses.length + ' uses)',
      uses.length === 2 && uses.every((x) => /try\{/.test(x.l) || /try\{\s*$/.test(x.prev)), uses.map((x) => x.l.trim()));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
