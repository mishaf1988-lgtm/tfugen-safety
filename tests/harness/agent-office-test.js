// The agents' office page (project-files/agent-office-page.txt), with the db snapshots the platform
// really delivers: frozen, data() frozen too. 18/10/2026: the page wrote x.id onto data(), the write
// failed silently, every desk was "desk-undefined", a click opened every desk and no agent link showed
// (lesson 115). The fake db below freezes like the real one, so that bug fails here.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const fs = require('fs');

const SRC = path.join(__dirname, '..', '..', 'project-files', 'agent-office-page.txt');
let passed = 0, failed = 0;
const check = (label, cond, detail) => {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.log('  ✗ ' + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
};

const FAKE = `
window.claude = { use: (name) => Promise.resolve(name !== 'db' ? null : {
  collection: () => ({ onSnapshot: (fn) => { setTimeout(() => fn(Object.freeze({ docs: [
    ['trig_A1', { name: 'one', worker: 'W1', order: 1, status: 'done', last_run: '2026-10-17T19:44:49Z' }],
    ['trig_B2', { name: 'two', worker: 'W1', order: 2, status: 'done', waiting: 'x' }],
    ['trig_C3', { name: 'three', worker: 'W2', status: 'fail' }],
  ].map(([id, body]) => { const b = Object.freeze(body); return Object.freeze({ id, exists: true, data: () => b }); }) })), 0); return () => {}; } }),
  doc: () => ({ onSnapshot: () => () => {} }),
}) };`;

(async () => {
  const html = fs.readFileSync(SRC, 'utf8').replace('<script>', '<script>' + FAKE + '</script><script>');
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForSelector('button.desk');
  // 18/10/2026: one desk per worker (a working session), its tasks listed on it.
  const desks = await page.$$eval('button.desk', (bs) => bs.map((b) => [b.getAttribute('data-worker'), b.querySelectorAll('.tasks li').length]));
  check('one desk per worker, each listing its tasks', JSON.stringify(desks.sort()) === JSON.stringify([['W1', 2], ['W2', 1]]), desks);
  await page.click('button.desk[data-worker="W1"]');
  // 18/10/2026: a click docks the chat of that worker under the office; the office stays visible.
  const dock = await page.$eval('#dock', (d) => ({ hidden: d.hidden, title: (d.querySelector('b') || {}).textContent || '' }));
  check('a click docks the chat of one worker under the office', !dock.hidden && /W1/.test(dock.title), dock);
  check('the office stays visible with the chat open', (await page.$$eval('button.desk', (bs) => bs.filter((b) => b.getBoundingClientRect().height > 20).length)) === 2);
  check('no detail card until "details" is pressed', (await page.$$eval('.detail', (ds) => ds.length)) === 0);
  await page.click('#dock .hd button');
  const open = await page.$$eval('.detail', (ds) => ds.length);
  check('"details" opens one worker, not all of them', open === 1, open);
  const hrefs = await page.$$eval('.detail .go', (as) => as.map((a) => a.href));
  check('the open worker links each task to its own agent page (ids from frozen snapshots)', JSON.stringify(hrefs) === JSON.stringify(['https://claude.ai/code/routines/trig_A1', 'https://claude.ai/code/routines/trig_B2']), hrefs);
  check('no page errors', errors.length === 0, errors);
  // 20/10/2026 (Michael, phone: "can't see well on the phone"; "do it: a list, a row per worker"): on a phone
  // each desk is a row with the lamp, the name in large type, the next run, no scene, and the page scrolls.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.setContent(html, { waitUntil: 'load' });
  await phone.waitForSelector('button.desk');
  const rows = await phone.$$eval('button.desk', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(), nm = b.querySelector('.nm');
    return { w: Math.round(r.width), nm: parseFloat(getComputedStyle(nm).fontSize), scene: getComputedStyle(b.querySelector('.scene')).display, lamp: getComputedStyle(b, '::before').backgroundColor }; }));
  check('phone: one full-width row per worker, name in 16px, no scene, a coloured lamp', rows.length === 2 && rows.every((r) => r.w > 330 && r.nm >= 16 && r.scene === 'none' && r.lamp !== 'rgba(0, 0, 0, 0)'), rows);
  check('phone: the page scrolls instead of squeezing', await phone.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'));
  if (process.env.SHOT) await phone.screenshot({ path: process.env.SHOT, fullPage: true });
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desk.setContent(html, { waitUntil: 'load' });
  await desk.waitForSelector('button.desk');
  check('computer: the one-screen office with scenes stays', await desk.$eval('button.desk .scene', (sv) => getComputedStyle(sv).display !== 'none'));
  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
