// The sign-in pull (sbSync) sends at most _SB_POOL requests at a time, the home screen's tables first
// (15/10/2026, Michael: "the app is stuck, it gets in very slowly"; the free Supabase server answered in
// 600-800 ms per table in the minutes of a sign-in, when 43 requests left at once, and in 5-30 ms otherwise).
// Checks: never more than 6 in flight, the first 12 are the home tables, every table is merged once, a failed
// table (null or a rejected promise) does not stop the queue, the home screen is drawn when its tables are in,
// and the pull ends as before (SB_ON, one refresh).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 400) : '')); } };

(async () => {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith('file://') ? r.continue() : r.abort()));
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    window.sdb = function () {};
    let inFlight = 0, maxIn = 0; const started = [], merged = [], events = [];
    let dashCalls = 0, refreshCalls = 0;
    const realDash = window.rDash; window.rDash = function () { dashCalls++; events.push('dash@' + merged.length); };
    window._sbRefresh = function () { refreshCalls++; events.push('refresh@' + merged.length); };
    window._obDrain = function () {}; window._obBadge = function () {};
    window._sbMergePull = function (t) { merged.push(t); };
    window.sbGet = function (t) {
      started.push(t); inFlight++; maxIn = Math.max(maxIn, inFlight);
      return new Promise((res, rej) => setTimeout(() => {
        inFlight--;
        if (t === 'ctr') return rej(new Error('network'));
        res(t === 'auds' ? null : []);
      }, 5 + (t.length % 4) * 3));
    };
    SB_ON = false;
    sbSync(true);
    await new Promise((res) => { const w = () => (refreshCalls ? res() : setTimeout(w, 20)); w(); setTimeout(res, 8000); });
    window.rDash = realDash;
    return { maxIn, started, merged, events, dashCalls, refreshCalls, sbOn: SB_ON, first: _SB_FIRST, pool: _SB_POOL };
  });
  check('never more than 6 requests in flight (was 43 at once)', r.pool === 6 && r.maxIn === 6, r.maxIn);
  check('the home screen tables leave first', r.started.slice(0, r.first.length).join() === r.first.join(), r.started.slice(0, 12));
  check('every table is asked for once (44 since train_plan, 15/10/2026)', r.started.length === 44 && new Set(r.started).size === 44, r.started.length);
  check('a failed table (null, or a rejected request) is skipped, the rest still merge', r.merged.length === 42 && !r.merged.includes('auds') && !r.merged.includes('ctr'), r.merged.length);
  check('the home screen is drawn again once its tables are in, before the end', r.dashCalls === 1 && /^dash@/.test(r.events[0]) && +r.events[0].split('@')[1] < 41, r.events);
  check('the pull ends as before: online, one refresh', r.sbOn === true && r.refreshCalls === 1, [r.sbOn, r.refreshCalls]);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
