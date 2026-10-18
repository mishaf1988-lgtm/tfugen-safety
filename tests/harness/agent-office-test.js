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
    ['trig_A1', { name: 'one', room: '\\u05d7\\u05d3\\u05e8 \\u05d4\\u05de\\u05e1\\u05de\\u05db\\u05d9\\u05dd', status: 'done', last_run: '2026-10-17T19:44:49Z' }],
    ['trig_B2', { name: 'two', room: '\\u05d7\\u05d3\\u05e8 \\u05d4\\u05de\\u05e1\\u05de\\u05db\\u05d9\\u05dd', status: 'done', waiting: 'x' }],
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
  const ids = await page.$$eval('button.desk', (bs) => bs.map((b) => b.id));
  check('each desk carries its own id from frozen snapshots', ids.sort().join() === 'desk-trig_A1,desk-trig_B2', ids);
  await page.click('button.desk >> nth=0');
  const open = await page.$$eval('.detail', (ds) => ds.length);
  check('a click opens one desk, not all of them', open === 1, open);
  const href = await page.$eval('.detail .go', (a) => a.href).catch(() => null);
  check('the open desk links to its own agent page', href === 'https://claude.ai/code/routines/trig_A1', href);
  check('no page errors', errors.length === 0, errors);
  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
