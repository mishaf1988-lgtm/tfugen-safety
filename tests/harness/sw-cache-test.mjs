// Unit test of the REAL /sw.js Cloudflare function (functions/sw.js.js).
// It renders the worker source, then runs that source inside a fake service
// worker global (caches / fetch / events) and drives install, activate and
// fetch. The point of the suite: prove the shell is served from the cache
// without waiting for the network, and that a deploy still reaches the user.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, '../../functions/sw.js.js'), 'utf8');
const mod = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(SRC));

let pass = 0, fail = 0;
const check = (l, c, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

const ORIGIN = 'https://tapugan-safety.pages.dev';

async function render(sha) {
  const res = await mod.onRequest({ env: sha === null ? {} : { CF_PAGES_COMMIT_SHA: sha } });
  return { res, src: await res.text() };
}

// ---- fake Response / Request ----------------------------------------------
let tagSeq = 0;
const resp = (tag, opts) => {
  const o = Object.assign({ ok: true, type: 'basic' }, opts || {});
  const r = { tag: tag + '#' + (++tagSeq), ok: o.ok, type: o.type };
  r.clone = () => Object.assign({}, r);
  return r;
};
const req = (url, opts) => Object.assign({ url: ORIGIN + url, method: 'GET', mode: 'no-cors' }, opts || {});
const nav = (url) => req(url, { mode: 'navigate' });

// ---- fake CacheStorage -----------------------------------------------------
function makeCaches(seed) {
  const store = new Map();
  const cacheOf = (name) => { if (!store.has(name)) store.set(name, new Map()); return store.get(name); };
  Object.keys(seed || {}).forEach((n) => { const c = cacheOf(n); Object.keys(seed[n]).forEach((u) => c.set(ORIGIN + u, seed[n][u])); });

  const hit = (map, url, ignoreSearch) => {
    if (map.has(url)) return map.get(url);
    if (!ignoreSearch) return undefined;
    const p = new URL(url).pathname;
    for (const [k, v] of map) if (new URL(k).pathname === p) return v;
    return undefined;
  };
  const wrap = (name) => ({
    addAll: async (urls) => { const c = cacheOf(name); for (const u of urls) { const r = await api.__fetch(req(u)); if (!r || !r.ok) throw new Error('addAll failed ' + u); c.set(ORIGIN + u, r); } },
    // Cache.add is standard and the worker uses it for the vendor files; the
    // fake had only addAll, so an install that used add threw ReferenceError
    // halfway through and the shell came out half-filled.
    add: async (request) => {
      const c = cacheOf(name);
      const rq = typeof request === 'string' ? req(request) : request;
      const r = await api.__fetch(rq);
      if (!r || !r.ok) throw new Error('add failed ' + rq.url);
      c.set(rq.url.startsWith('http') ? rq.url : ORIGIN + rq.url, r);
    },
    put: async (rq, rs) => { cacheOf(name).set(rq.url, rs); },
    match: async (rq, o) => hit(cacheOf(name), rq.url, !!(o && o.ignoreSearch)),
  });
  const api = {
    __store: store,
    __fetch: null, // set by the harness so addAll goes through the mock network
    open: async (name) => wrap(name),
    keys: async () => Array.from(store.keys()),
    delete: async (name) => store.delete(name),
    match: async (rq, o) => {
      const url = typeof rq === 'string' ? ORIGIN + rq : rq.url;
      const names = o && o.cacheName ? [o.cacheName] : Array.from(store.keys());
      for (const n of names) { const r = hit(cacheOf(n), url, !!(o && o.ignoreSearch)); if (r) return r; }
      return undefined;
    },
  };
  return api;
}

// ---- boot the worker source into a fake global -----------------------------
function boot(src, opts) {
  opts = opts || {};
  const handlers = {};
  const clients = (opts.clients || []).map((id) => ({ id, msgs: [] }));
  const self_ = {
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    skipWaiting: () => { self_.__skipped = true; },
    location: { origin: ORIGIN },
    clients: {
      claim: async () => { self_.__claimed = true; },
      matchAll: async () => clients,
    },
    __clients: clients,
  };
  clients.forEach((c) => { c.postMessage = (m) => c.msgs.push(m); });

  const net = opts.net || (() => Promise.reject(new Error('offline')));
  const calls = [];
  const fetch_ = (rq) => { calls.push(rq.url); return Promise.resolve().then(() => net(rq)); };

  const caches_ = opts.caches || makeCaches();
  caches_.__fetch = fetch_;

  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', 'URL', src)(self_, caches_, fetch_, URL);

  const fire = (type, request) => {
    const e = { request, waits: [], respondWith: (p) => { e.responded = p; }, waitUntil: (p) => { e.waits.push(p); } };
    (handlers[type] || []).forEach((fn) => fn(e));
    return e;
  };
  return { self_, caches_, calls, fire, handlers };
}

const settle = async (e) => { await Promise.all(e.waits.map((p) => Promise.resolve(p).catch(() => {}))); };

// ---------------------------------------------------------------------------
console.log('\n1. the function renders a worker keyed to the deploy');
{
  const { res, src } = await render('abcdef1234567890');
  check('cache name carries the 7-char commit sha', /const CACHE = 'tfgn-abcdef1';/.test(src), src.slice(0, 400));
  check('served as javascript, no-cache, scoped to the root',
    /javascript/.test(res.headers.get('Content-Type')) && /no-cache/.test(res.headers.get('Cache-Control')) && res.headers.get('Service-Worker-Allowed') === '/',
    [res.headers.get('Content-Type'), res.headers.get('Cache-Control'), res.headers.get('Service-Worker-Allowed')]);
  const dev = (await render(null)).src;
  check('no CF env (local preview) falls back to tfgn-dev', /const CACHE = 'tfgn-dev';/.test(dev));
  check('the rendered worker is valid javascript', (() => { try { new Function('self', 'caches', 'fetch', 'URL', src); return true; } catch (err) { return String(err); } })() === true);
}

const { src: SW } = await render('abcdef1234567890');
const CACHE = 'tfgn-abcdef1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/logo.jpg'];

console.log('\n2. install and activate');
{
  const w = boot(SW, { net: (rq) => resp('net' + new URL(rq.url).pathname) });
  const e = w.fire('install');
  await settle(e);
  check('skipWaiting so a new build does not wait for every tab to close', w.self_.__skipped === true);
  check('install fills the shell: ' + SHELL.join(' '), SHELL.every((p) => w.caches_.__store.get(CACHE) && w.caches_.__store.get(CACHE).has(ORIGIN + p)), Array.from((w.caches_.__store.get(CACHE) || new Map()).keys()));
  // supabase-js is the whole login: without it the manager gets a login
  // screen that answers "Supabase \u05d0\u05d9\u05e0\u05d5 \u05d6\u05de\u05d9\u05df" and then erases the message.
  const VENDOR = (SW.match(/const VENDOR = \[([\s\S]*?)\];/) || ['', ''])[1].match(/'([^']+)'/g) || [];
  check('the worker names supabase-js as a vendor file', VENDOR.length === 1 && /supabase-js/.test(VENDOR[0]), VENDOR);
  check('install caches it too, so the first offline open has it', VENDOR.every((u) => w.caches_.__store.get(CACHE).has(u.replace(/'/g, ''))), Array.from(w.caches_.__store.get(CACHE).keys()));

  // A vendor URL that 404s must not take the shell with it.
  {
    const w2 = boot(SW, { net: (rq) => /jsdelivr/.test(rq.url) ? Promise.resolve(new Response('nope', { status: 404 })) : resp('net' + new URL(rq.url).pathname) });
    const e2 = w2.fire('install');
    await settle(e2);
    check('a vendor file that 404s still leaves the shell cached', SHELL.every((p) => w2.caches_.__store.get(CACHE) && w2.caches_.__store.get(CACHE).has(ORIGIN + p)), Array.from((w2.caches_.__store.get(CACHE) || new Map()).keys()));
  }

  // ...and offline it is served from the cache rather than falling back to
  // index.html, which nosniff refuses to execute as a script.
  {
    const vendorUrl = VENDOR[0].replace(/'/g, '');
    const offline = boot(SW, { net: () => Promise.reject(new Error('offline')), caches: w.caches_ });
    const ev = offline.fire('fetch', { url: vendorUrl, method: 'GET', mode: 'no-cors' });
    const got = await Promise.resolve(ev.responded).catch((err) => err);
    check('offline, the cached supabase-js is served', got && got.ok === true, got && (got.message || got.status));
    const missing = boot(SW, { net: () => Promise.reject(new Error('offline')) });
    const ev2 = missing.fire('fetch', { url: ORIGIN + '/some.js', method: 'GET', mode: 'no-cors' });
    const got2 = await Promise.resolve(ev2.responded).then(() => 'served', () => 'rejected');
    check('a script we do not have is refused, not answered with index.html', got2 === 'rejected', got2);
  }
}
{
  const seeded = makeCaches({ 'tfgn-old1': { '/index.html': resp('old') }, 'tfgn-old2': {}, [CACHE]: { '/index.html': resp('new') } });
  const w = boot(SW, { caches: seeded, clients: ['tab-a', 'tab-b'] });
  const e = w.fire('activate');
  await settle(e);
  check('every older cache is dropped, the current one stays', Array.from(seeded.__store.keys()).join() === CACHE, Array.from(seeded.__store.keys()));
  check('clients.claim() so open tabs are controlled at once', w.self_.__claimed === true);
  check('every open tab gets {type:"sw-updated"} — that is the refresh pill', w.self_.__clients.every((c) => c.msgs.length === 1 && c.msgs[0].type === 'sw-updated' && c.msgs[0].cache === CACHE), w.self_.__clients.map((c) => c.msgs));
}

console.log('\n3. the shell is answered from the cache, without waiting for the network');
{
  // The network never settles. If the response still arrives, nothing waited for it.
  let release;
  const hung = new Promise((r) => { release = r; });
  const seeded = makeCaches({ [CACHE]: { '/': resp('cached-index') } });
  const w = boot(SW, { caches: seeded, net: () => hung });
  const e = w.fire('fetch', nav('/'));
  const got = await Promise.race([e.responded, new Promise((r) => setTimeout(() => r('TIMED-OUT'), 50))]);
  check('a navigation is served from the cache while the network is still hanging', got !== 'TIMED-OUT' && /^cached-index/.test(got.tag), got && got.tag);
  check('the refresh is kicked off in the background and held by waitUntil', w.calls.length === 1 && e.waits.length === 1, { calls: w.calls, waits: e.waits.length });
  release(resp('fresh-index'));
  await settle(e);
  check('when the background fetch lands it replaces the cached copy', /^fresh-index/.test(seeded.__store.get(CACHE).get(ORIGIN + '/').tag), seeded.__store.get(CACHE).get(ORIGIN + '/').tag);
}
{
  const seeded = makeCaches({ [CACHE]: { '/': resp('cached-index') } });
  const w = boot(SW, { caches: seeded, net: () => resp('fresh') });
  const e = w.fire('fetch', nav('/?tab=ncr&id=7'));
  const got = await e.responded;
  check('a query string does not miss the cache (ignoreSearch)', /^cached-index/.test(got.tag), got.tag);
  await settle(e);
}
{
  const w = boot(SW, { net: () => resp('from-network') });
  const e = w.fire('fetch', nav('/'));
  const got = await e.responded;
  await settle(e);
  check('cold cache (first ever visit) still goes to the network', /^from-network/.test(got.tag), got.tag);
  check('and that first response is stored for next time', w.caches_.__store.get(CACHE) && w.caches_.__store.get(CACHE).has(ORIGIN + '/'), Array.from((w.caches_.__store.get(CACHE) || new Map()).keys()));
}
{
  const seeded = makeCaches({ [CACHE]: { '/': resp('cached-index') } });
  const w = boot(SW, { caches: seeded }); // offline
  const e = w.fire('fetch', nav('/'));
  const got = await e.responded;
  await settle(e);
  check('offline with a warm cache: the app opens, the failed refresh is swallowed', /^cached-index/.test(got.tag), got && got.tag);
}
{
  const seeded = makeCaches({ [CACHE]: { '/': resp('cached-index') } });
  const w = boot(SW, { caches: seeded }); // offline
  const e = w.fire('fetch', nav('/some/deep/link'));
  const got = await e.responded;
  check('offline on an unknown path falls back to the cached root', got && /^cached-index/.test(got.tag), got && got.tag);
}
{
  const seeded = makeCaches({ [CACHE]: { '/logo.jpg': resp('cached-logo') } });
  const w = boot(SW, { caches: seeded, net: () => resp('net-logo') });
  const e = w.fire('fetch', req('/logo.jpg'));
  const got = await e.responded;
  await settle(e);
  check('/logo.jpg is shell too: cached copy first, refreshed behind it', /^cached-logo/.test(got.tag), got.tag);
}

console.log('\n4. everything that is not the shell behaves exactly as before');
{
  const seeded = makeCaches({ [CACHE]: { '/privacy.html': resp('stale-privacy') } });
  const w = boot(SW, { caches: seeded, net: () => resp('fresh-privacy') });
  const e = w.fire('fetch', req('/privacy.html'));
  const got = await e.responded;
  check('a non-shell file stays network-first even with a stale copy cached', /^fresh-privacy/.test(got.tag), got.tag);
}
{
  const seeded = makeCaches({ [CACHE]: { '/privacy.html': resp('stale-privacy') } });
  const w = boot(SW, { caches: seeded }); // offline
  const got = await (w.fire('fetch', req('/privacy.html'))).responded;
  check('...and offline it still falls back to the cached copy', /^stale-privacy/.test(got.tag), got && got.tag);
}
{
  const w = boot(SW, { net: () => resp('cross', { type: 'cors' }) });
  const e = w.fire('fetch', req('/x.js'));
  await e.responded; await settle(e);
  check('a cross-origin (non-basic) response is never written to the cache', !(w.caches_.__store.get(CACHE) || new Map()).has(ORIGIN + '/x.js'));
}
{
  const w = boot(SW, { net: () => resp('err', { ok: false }) });
  const e = w.fire('fetch', req('/x.js'));
  await e.responded; await settle(e);
  check('a 404/500 is never written to the cache', !(w.caches_.__store.get(CACHE) || new Map()).has(ORIGIN + '/x.js'));
}
{
  const w = boot(SW, { net: () => resp('n') });
  const bypass = [
    ['POST', req('/index.html', { method: 'POST' })],
    ['Supabase REST', { url: 'https://znhjtpcltrxxyfjczgvw.supabase.co/rest/v1/ncr', method: 'GET', mode: 'cors' }],
    ['our /api/*', req('/api/trustee-notify')],
    ['Claude API', { url: 'https://api.anthropic.com/v1/messages', method: 'GET', mode: 'cors' }],
    ['Google fonts css', { url: 'https://fonts.googleapis.com/css2?family=Heebo', method: 'GET', mode: 'cors' }],
  ];
  bypass.forEach(([label, r]) => {
    const e = w.fire('fetch', r);
    check(label + ' is left to the browser (respondWith never called)', e.responded === undefined, label);
  });
}

console.log('\n5. a deploy still reaches the user — the cached shell cannot go permanently stale');
{
  const shared = makeCaches({ 'tfgn-old1234': { '/': resp('build-1') } });
  // old worker is controlling: the open is instant, from the old cache
  const oldW = boot(SW.replace(/tfgn-abcdef1/g, 'tfgn-old1234'), { caches: shared, net: () => resp('build-2') });
  const first = oldW.fire('fetch', nav('/'));
  check('the open right after a deploy is instant, from the previous build', /^build-1/.test((await first.responded).tag));
  await settle(first);
  // /sw.js is no-cache, so the browser picks up the new worker on that same navigation
  const newW = boot(SW, { caches: shared, clients: ['tab-a'], net: () => resp('build-2') });
  await settle(newW.fire('install'));
  const act = newW.fire('activate'); await settle(act);
  check('the new worker pulls the new build into its own cache on install', /^build-2/.test(shared.__store.get(CACHE).get(ORIGIN + '/').tag), shared.__store.get(CACHE).get(ORIGIN + '/').tag);
  check('the old cache is gone, so nothing can serve the old build again', !shared.__store.has('tfgn-old1234'), Array.from(shared.__store.keys()));
  check('the tab is told to show the refresh pill', newW.self_.__clients[0].msgs.some((m) => m.type === 'sw-updated'));
  const after = newW.fire('fetch', nav('/'));
  check('after the user taps the pill the reload serves the new build', /^build-2/.test((await after.responded).tag));
  await settle(after);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
