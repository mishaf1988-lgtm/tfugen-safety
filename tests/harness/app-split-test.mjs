// The app's main script served as /app.js (10/10/2026, Michael: "בצע: הפרדה בשרת"):
// index.html stays the only source; the middleware swaps <script id="app-main"> for
// <script src="/app.js?v=<deploy>">, and functions/app.js.js cuts the same bytes out of the
// deployed index.html. Checked here: the cut is exact, the headers, the swap, the fallback
// to /?inline=1, and that the real page boots in Chromium both ways.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d).slice(0, 300) : '')); } };

const { extractApp, rewriteApp, appSrc, APP_ID } = await import(path.join(ROOT, 'functions/_appjs.js'));
const { onRequest: appJs } = await import(path.join(ROOT, 'functions/app.js.js'));
const { onRequest: mw } = await import(path.join(ROOT, 'functions/_middleware.js'));
const { onRequest: sw } = await import(path.join(ROOT, 'functions/sw.js.js'));
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// A stand-in for Cloudflare's HTMLRewriter, enough for one element handler on script#id.
class FakeRewriter {
  on(sel, h) { this.sel = sel; this.h = h; return this; }
  transform(res) {
    const id = this.sel.split('#')[1], h = this.h;
    const out = res.text().then((t) => t.replace(new RegExp('<script id="' + id + '">[\\s\\S]*?</script>'), () => {
      const attrs = { id }; let inner = null;
      h.element({ setAttribute: (k, v) => { attrs[k] = v; }, setInnerContent: (c) => { inner = c; } });
      return '<script ' + Object.keys(attrs).map((k) => k + '="' + String(attrs[k]).replace(/"/g, '&quot;') + '"').join(' ') + '>' + (inner || '') + '</script>';
    }));
    return new Response(new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(await out)); c.close(); } }), { status: res.status, headers: res.headers });
  }
}

console.log('1. the cut');
const js = extractApp(HTML);
check('index.html has exactly one <script id="app-main">', HTML.split('<script id="' + APP_ID + '">').length === 2);
check('the cut is the whole main script (starts with use strict, over 1MB)', js && js.trimStart().startsWith("'use strict'") && js.length > 1e6, js && js.length);
check('...and ends right before its </script>', js && HTML.indexOf('<script id="app-main">' + js + '</script>') > 0);
check('no script tag: null', extractApp('<html></html>') === null && extractApp('<script id="app-main">x') === null);

console.log('\n2. GET /app.js');
const ENV = { CF_PAGES_COMMIT_SHA: 'abcdef1234', ASSETS: { fetch: async () => new Response(HTML, { headers: { 'Content-Type': 'text/html' } }) } };
let r = await appJs({ request: new Request('https://x/app.js?v=abcdef1'), env: ENV });
check('200, JavaScript, the exact bytes', r.status === 200 && /javascript/.test(r.headers.get('Content-Type')) && (await r.text()) === js);
check('?v= of this deploy: kept a year (immutable)', /immutable/.test(r.headers.get('Cache-Control')));
r = await appJs({ request: new Request('https://x/app.js?v=old0000'), env: ENV });
check('another ?v=: no-cache', r.headers.get('Cache-Control') === 'no-cache');
r = await appJs({ request: new Request('https://x/app.js?v=zzz'), env: { CF_PAGES_COMMIT_SHA: 'ffffff9', ASSETS: { fetch: async () => new Response('nope', { status: 500 }) } } });
check('index.html unreadable: 503, never an HTML body as a script', r.status === 503 && /javascript/.test(r.headers.get('Content-Type')));

console.log('\n3. the page through the middleware');
globalThis.HTMLRewriter = FakeRewriter;
const page = async (p, country = 'IL') => {
  const req = new Request('https://tapugan-safety.pages.dev' + p);
  Object.defineProperty(req, 'cf', { value: { country } });
  return mw({ request: req, env: { CF_PAGES_COMMIT_SHA: 'abcdef1234' }, next: async () => new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) });
};
let t = await (await page('/')).text();
check('"/": the main script is a src to /app.js?v=<deploy>, with the fallback', t.includes('src="' + appSrc('abcdef1') + '"') && t.includes('onerror=') && t.length < HTML.length - 1e6, t.length);
check('...and nothing else in the page changed', t.replace(/<script id="app-main"[^>]*><\/script>/, '') === HTML.replace('<script id="app-main">' + js + '</script>', ''));
t = await (await page('/index.html')).text();
check('"/index.html": swapped too', t.includes('src="/app.js?v='));
t = await (await page('/?inline=1')).text();
check('"/?inline=1": left inline (the fallback)', t === HTML);
check('"/app.js" is a public path', (await page('/app.js')).status === 200);
check('from abroad: still blocked', (await page('/', 'US')).status === 403);
delete globalThis.HTMLRewriter;
check('no HTMLRewriter (Node): the page goes out inline', (await (await page('/')).text()) === HTML);
check('rewriteApp without a rewriter returns the same response', rewriteApp(new Response('x'), 'b', null) instanceof Response);

console.log('\n4. the service worker');
const swText = await (await sw({ env: { CF_PAGES_COMMIT_SHA: 'abcdef1234' } })).text();
check('precaches /app.js of this deploy', swText.includes("'/app.js?v=abcdef1'"));
check('/?inline=1 is never served from the cached shell', /inline=1/.test(swText));

console.log('\n4b. op live (what the night run reads, since the cloud cannot open the site)');
const { liveInfo } = await import(path.join(ROOT, 'functions/api/routine-db.js'));
const LENV = { CF_PAGES_COMMIT_SHA: 'abcdef1234', ASSETS: { fetch: async () => new Response(HTML) } };
globalThis.HTMLRewriter = FakeRewriter;
let li = await liveInfo(new Request('https://x/api/routine-db'), LENV);
check('reports the cut length and that the swap happened', li.ok && li.app_js_bytes === js.length && li.app_swap === true, li);
delete globalThis.HTMLRewriter;
li = await liveInfo(new Request('https://x/api/routine-db'), LENV);
check('...and says so when the swap does not happen', li.app_swap === false, li);

console.log('\n5. the real page in Chromium');
const SPLIT = await (await rewriteApp(new Response(HTML, { headers: { 'Content-Type': 'text/html' } }), 'abcdef1', FakeRewriter)).text();
let appOk = true;
const srv = http.createServer((q, s) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/app.js') { if (!appOk) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' }); return s.end(js); }
  if (u.pathname === '/') { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end(/inline=1/.test(u.search) ? HTML : SPLIT); }
  s.writeHead(404); s.end();
});
await new Promise((ok) => srv.listen(0, ok));
const base = 'http://127.0.0.1:' + srv.address().port;
const browser = await pw.chromium.launch();
const boot = async () => {
  const p = await browser.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.route('**/*', (q) => q.request().url().startsWith(base) ? q.continue() : q.abort());
  await p.goto(base + '/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ url: location.search, db: typeof DB, go: typeof goPage, login: !!document.getElementById('login'), src: !!document.querySelector('script[src^="/app.js"]') }));
  await p.close(); return { s, errs };
};
let b = await boot();
check('split page boots: the app is defined from /app.js', b.s.db === 'object' && b.s.go === 'function' && b.s.login && b.s.src && b.s.url === '', b);
check('...with no page errors', !b.errs.length, b.errs);
appOk = false;
b = await boot();
check('/app.js fails: the page falls back to /?inline=1 and boots', b.s.url === '?inline=1' && b.s.db === 'object' && b.s.go === 'function', b);
await browser.close(); srv.close();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
