// End-to-end check of the app against the TEST database (tfugen-staging), from the cloud,
// in a real browser (16/10/2026, Michael: "a development and test environment, who runs the
// tests there?" -- Claude does, with this script). Not part of the CI harness: it needs the
// network and a password that exists only for the length of one run.
//
// How: the repo is served on 127.0.0.1, and Chromium resolves e2e.tapugan-safety.pages.dev to
// it. To the page that is a preview host, so index.html picks the test database (_STAGING),
// exactly as on a real Cloudflare preview build; nothing here can reach the live one.
//
// Run:  STAGING_PW=<the password set a moment ago in auth.users of ldzbjbsumzqjyvtpiwqo> node tests/staging/e2e.js
// Then set a new random password again (project-files/staging/README.md).
const http = require('http');
const fs = require('fs');
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }

const ROOT = path.resolve(__dirname, '../..');
const HOST = 'e2e.tapugan-safety.pages.dev';
const TEST_DB = 'ldzbjbsumzqjyvtpiwqo.supabase.co', LIVE_DB = 'znhjtpcltrxxyfjczgvw.supabase.co';
const PASS = process.env.STAGING_PW || '';
let ok = 0, bad = 0;
const check = (l, c, d) => { if (c) { ok++; console.log('  ✓ ' + l); } else { bad++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

(async () => {
  if (!PASS) { console.log('STAGING_PW is not set'); process.exit(2); }
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  }).listen(0, '127.0.0.1');
  await new Promise((r) => srv.on('listening', r));
  const port = srv.address().port;
  const browser = await pw.chromium.launch({ args: ['--host-resolver-rules=MAP ' + HOST + ' 127.0.0.1'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const hosts = new Set(), errors = [];
  page.on('request', (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) {} });
  page.on('pageerror', (e) => errors.push(String(e.message || e)));

  console.log('\n1. the page on a preview host');
  await page.goto('http://' + HOST + ':' + port + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const boot = await page.evaluate(() => ({ st: typeof _STAGING !== 'undefined' && _STAGING, sbu: typeof SBU !== 'undefined' && SBU, title: document.title }));
  check('index.html chose the test database', boot.st === true && boot.sbu === 'https://' + TEST_DB, boot);
  check('the tab title says ניסוי', /^ניסוי - /.test(boot.title), boot.title);

  console.log('\n2. sign-in as claude-test');
  await page.fill('#uname', 'claude-test');
  await page.fill('#pw', PASS);
  await page.evaluate(() => doLogin());
  await page.waitForFunction(() => typeof _sbToken !== 'undefined' && !!_sbToken, null, { timeout: 45000 }).catch(() => {});
  const auth = await page.evaluate(() => ({ token: !!_sbToken, role: (typeof CU !== 'undefined' && CU && CU.role) || null }));
  check('signed in (a session token from the test database)', auth.token, auth);

  console.log('\n3. data from the test database reaches the screens');
  await page.waitForTimeout(6000);
  const data = await page.evaluate(() => {
    const D = (typeof DB !== 'undefined' && DB) || {};
    return { ncr: (D.ncr || []).map((x) => x.id), emp: (D.emp || []).map((x) => x.id), thz: (D.tour_hazards || []).map((x) => x.id) };
  });
  check('NCR: the sample row is loaded', data.ncr.indexOf('ncr-t1') >= 0, data.ncr);
  check('employees: the two sample rows', data.emp.indexOf('emp-t1') >= 0 && data.emp.indexOf('emp-t2') >= 0, data.emp);
  check('tour hazards: the sample row', data.thz.indexOf('th-t1') >= 0, data.thz);

  console.log('\n4. never the live database');
  check('no request went to the live Supabase', !hosts.has(LIVE_DB), [...hosts]);
  check('requests did go to the test Supabase', hosts.has(TEST_DB), [...hosts]);
  check('no page errors', errors.length === 0, errors.slice(0, 5));

  await browser.close(); srv.close();
  console.log('\n' + ok + ' passed, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('E2E ERROR', e); process.exit(2); });
