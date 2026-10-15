// The Cloudflare check before the password (15/10/2026, Michael: "I type the password and it is stuck").
// The widget waited two minutes for a tap on a box at the bottom of the screen and said nothing. Now:
// the box is in the middle, a dark screen with one line says to tap it while Cloudflare wants a tap,
// the line goes when the check is done, and after _TS_WAIT_MS the sign-in goes on with a message.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith('file://') ? r.continue() : r.abort()));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const o = { wait: _TS_WAIT_MS };
    const toasts = []; window.toast = (m) => toasts.push(String(m));
    const hint = () => { const h = document.getElementById('captcha-hint'); return !!h && h.style.display !== 'none' ? h.textContent : ''; };
    // 1. Cloudflare wants a tap: the hint shows; the tap gives a token and the hint goes
    let opts = null;
    window.turnstile = { render(el, op) { opts = op; setTimeout(() => op['before-interactive-callback'](), 10); return 'w1'; }, remove() {} };
    const p1 = _captcha();
    await new Promise((res) => setTimeout(res, 60));
    o.hintOn = hint();
    const el = document.getElementById('captcha'); o.top = el.style.top; o.transform = el.style.transform;
    opts['after-interactive-callback'](); opts.callback('tok-1');
    o.tok = await p1; o.hintAfter = hint();
    // 2. nothing ever comes back: after the wait, no token, a message, and the hint is gone
    _TS_WAIT_MS = 150;
    window.turnstile = { render(el, op) { setTimeout(() => op['before-interactive-callback'](), 10); return 'w2'; }, remove() {} };
    const t0 = Date.now(); o.tok2 = await _captcha(); o.took = Date.now() - t0;
    o.toast = toasts.join('|'); o.hintEnd = hint();
    return o;
  });
  check('waits 30 seconds, not 2 minutes', r.wait === 30000, r.wait);
  check('Cloudflare wants a tap: a line says to tap the box, the box is in the middle of the screen', /לחצו על התיבה/.test(r.hintOn) && r.top === '50%' && /translate\(-50%, -50%\)/.test(r.transform), [r.hintOn, r.top, r.transform]);
  check('after the tap: the token, and the line is gone', r.tok === 'tok-1' && r.hintAfter === '', [r.tok, r.hintAfter]);
  check('no answer: the sign-in goes on without a token after the wait, with a message, the line gone', r.tok2 === null && r.took < 1500 && /לא הסתיימה/.test(r.toast) && r.hintEnd === '', r);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
