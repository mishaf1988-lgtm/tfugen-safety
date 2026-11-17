// A phone screenshot of the screen a PR changed (Michael, 17/11/2026, four test rules, rule 1:
// a change in index.html carries a screenshot of the changed screen before it is merged).
//
//   NODE_PATH=$(npm root -g) node tools/pr-shot.js <name> --page <id>
//   NODE_PATH=$(npm root -g) node tools/pr-shot.js <name> --page ncr --js "DB.ncr=[{id:'n1',d:'2026-11-01',s:'x'}];rNcr()"
//   NODE_PATH=$(npm root -g) node tools/pr-shot.js <name> --login          (the login screen, nothing hidden)
//
// The real index.html of the working tree at 390x844 (iPhone width) at 2x, as an admin, with the network
// closed (no real data is read or shown: seed what the screen needs with --js). Writes .shots/<name>.png and
// .shots/<name>.png.json with the sha256 of the index.html that was opened: pr-gate.py refuses a PR whose
// screenshot was taken before the last edit. .shots/ is not committed (.gitignore); the PR description
// names the file in its shot line, and Michael gets the picture in the chat.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i < 0 ? null : (argv[i + 1] || ''); };
const name = argv[0] && !argv[0].startsWith('--') ? argv[0].replace(/[^\w.-]/g, '_') : null;
if (!name) { console.error('usage: node tools/pr-shot.js <name> [--page <id>] [--js "<code>"] [--login] [--full]'); process.exit(2); }
const OUT = path.join(ROOT, '.shots');
const file = path.join(OUT, name + '.png');

(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'));
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route('**/*', (r) => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(700);
  if (!argv.includes('--login')) {
    await page.evaluate(() => {
      document.getElementById('login').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      window.sbIns = function () {}; window.sbUpd = function () {}; window.sdb = function () {}; window.addLog = function () {};
      window._currentUser = { username: 'admin' }; _isAdmin = true;
    });
  }
  const pg = opt('--page');
  if (pg) await page.evaluate((id) => goPage(id), pg);
  const js = opt('--js');
  if (js) await page.evaluate(js);
  await page.waitForTimeout(400);
  // A screenshot of nothing proves nothing: the screen must have something to show.
  const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, '').length);
  if (seen < 20) { console.error('pr-shot: the screen is empty (' + seen + ' characters). Wrong --page, or the screen needs --js to seed it.'); await browser.close(); process.exit(1); }
  if (errors.length) { console.error('pr-shot: the page threw: ' + errors.slice(0, 3).join(' | ')); await browser.close(); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: file, fullPage: argv.includes('--full') });
  await browser.close();
  fs.writeFileSync(file + '.json', JSON.stringify({ index_sha: crypto.createHash('sha256').update(src).digest('hex'), page: pg || (argv.includes('--login') ? 'login' : ''), at: new Date().toISOString() }));
  console.log('pr-shot: ' + path.relative(ROOT, file));
  console.log('צילום: <המסך ומה רואים>, ' + path.relative(ROOT, file).split(path.sep).join('/'));
})().catch((e) => { console.error('pr-shot: ' + (e && e.message || e)); process.exit(1); });
