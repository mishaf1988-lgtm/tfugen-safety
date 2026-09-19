// The console has to be quiet in production. Boot noise is gone for good, the
// background-job traces (backup / mail / OneDrive) now go through dlog() and
// only appear when the safety manager turns them on. Runs on the real
// index.html — dlog is read out of the page, not re-implemented here.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const HTML = 'file://' + path.resolve(__dirname, '../../index.html');
const fs = require('fs');
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

(async () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

  console.log('\n1. the source itself');
  {
    const inline = [];
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/g; let m;
    while ((m = re.exec(src))) if (!/src=/.test(m[1])) inline.push(m[2]);
    check('3 inline script blocks, all still valid javascript', inline.length === 3 && inline.every((b) => { try { new Function(b); return true; } catch (e) { return false; } }), inline.length);
    const logs = inline.join('\n').match(/\bconsole\.log\(/g) || [];
    check('no bare console.log() is left in the app code', logs.length === 0, logs.length);
    const infos = inline.join('\n').match(/\bconsole\.info\(/g) || [];
    check('no bare console.info() either', infos.length === 0, infos.length);
    const warns = (inline.join('\n').match(/\bconsole\.(warn|error)\(/g) || []).length;
    check('the ' + warns + ' console.warn/error diagnostics were left alone', warns >= 120, warns);
    check('the three boot lines are gone (NCR Agent ready / Smart Capture ready / Synced N NCR)',
      !/NCR Agent v4 ready/.test(src) && !/'Smart Capture ready'/.test(src) && !/\[TFUGEN\] Synced /.test(src));
  }

  const browser = await pw.chromium.launch();
  const open = async (url) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL' });
    const page = await ctx.newPage();
    const seen = [];
    const thrown = [];
    page.on('console', (msg) => seen.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (e) => thrown.push(String(e && e.message || e)));
    await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    return { ctx, page, seen, thrown };
  };

  console.log('\n2. a normal open is quiet');
  {
    const { ctx, page, seen } = await open(HTML);
    const noisy = seen.filter((m) => m.type === 'log' || m.type === 'info');
    check('nothing is printed at log/info level on boot', noisy.length === 0, noisy.slice(0, 4));
    const st = await page.evaluate(() => ({ on: window._dbgOn, fn: typeof dlog, toggle: typeof window.tfgnDebug }));
    check('dlog() and tfgnDebug() exist, and debug is off', st.fn === 'function' && st.toggle === 'function' && st.on === false, st);
    const quiet = await page.evaluate(() => { dlog('[backup] should not appear'); return true; });
    await page.waitForTimeout(50);
    check('calling dlog() while it is off prints nothing', quiet && !seen.some((m) => /should not appear/.test(m.text)), seen.map((m) => m.text).slice(0, 3));
    await ctx.close();
  }

  console.log('\n3. turning it on');
  {
    const { ctx, page, seen } = await open(HTML);
    await page.evaluate(() => window.tfgnDebug(true));
    await page.evaluate(() => dlog('[backup-sync] supabase:', 3, 'OneDrive:', 2));
    await page.waitForTimeout(50);
    check('tfgnDebug(true) takes effect straight away, no reload', seen.some((m) => m.type === 'log' && /\[backup-sync\] supabase: 3 OneDrive: 2/.test(m.text)), seen.map((m) => m.text).slice(-3));
    const stored = await page.evaluate(() => localStorage.getItem('tfgn_debug'));
    check('and it is remembered on this device', stored === '1', stored);
    await page.evaluate(() => window.tfgnDebug(false));
    await page.evaluate(() => dlog('[od] silent again'));
    await page.waitForTimeout(50);
    check('tfgnDebug(false) turns it back off and clears the flag', !seen.some((m) => /silent again/.test(m.text)) && (await page.evaluate(() => localStorage.getItem('tfgn_debug'))) === null);
    await ctx.close();
  }

  console.log('\n4. ?debug=1 in the URL works too (for a phone, where there is no console to type in)');
  {
    const { ctx, page, seen } = await open(HTML + '?debug=1');
    const on = await page.evaluate(() => window._dbgOn);
    await page.evaluate(() => dlog('[mail] dispatcher: 2 rules due now'));
    await page.waitForTimeout(50);
    check('?debug=1 switches it on at boot', on === true && seen.some((m) => /dispatcher: 2 rules due now/.test(m.text)), { on });
    await ctx.close();
  }

  console.log('\n5. the app still works with the flag on and off');
  {
    for (const [label, url] of [['off', HTML], ['on', HTML + '?debug=1']]) {
      const { ctx, page, thrown } = await open(url);
      const ok = await page.evaluate(() => {
        document.getElementById('login').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        window._currentUser = { username: 'admin' };
        _applyRoleGates(); goPage('dash');
        return { cur: CUR, rows: document.querySelectorAll('#app .card, #app .kpi, #app .tile').length };
      });
      // Only uncaught exceptions count — the harness blocks the network, so
      // "Failed to load resource" is the test's own doing, not the app's.
      check('debug ' + label + ': the dashboard renders with no uncaught javascript errors', ok.cur === 'dash' && ok.rows > 0 && thrown.length === 0, { ok, thrown: thrown.slice(0, 3) });
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
