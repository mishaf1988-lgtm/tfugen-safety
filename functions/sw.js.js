// Cloudflare Pages Function — dynamic service worker.
//
// Replaces the static /sw.js. Returns the SW source with the cache-bust
// token derived from CF_PAGES_COMMIT_SHA, so every deploy gets a fresh
// cache name automatically. No more manual `tfgn-vNN` bumps in PRs.
//
// Why a function instead of a static file:
//   The browser detects a new SW only when /sw.js bytes change. Without
//   build-time substitution we had to manually edit the version string on
//   every deploy. With CF Pages auto-injecting the commit hash, the SW
//   bytes change naturally on every deploy.
//
// Local dev / preview without CF env: BUILD falls back to "dev" so the
// file still parses and runs.

export async function onRequest({ env }) {
  const sha = env.CF_PAGES_COMMIT_SHA || 'dev';
  const BUILD = String(sha).substring(0, 7);

  const SW = `// TFUGEN Service Worker — minimal shell cache.
// Strategy:
//   shell (index.html & friends) — cache-first, refreshed in the background
//   everything else of ours      — network-first, cache as offline fallback
//   API / REST / fonts           — bypassed entirely
// Build: ${BUILD} (auto-injected from CF_PAGES_COMMIT_SHA)

const CACHE = 'tfgn-${BUILD}';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/logo.jpg'];
// supabase-js is the whole login. Without it _sbBoot leaves _sbClient null,
// the boot path falls through to showLogin(), and typing the password answers
// "Supabase \u05d0\u05d9\u05e0\u05d5 \u05d6\u05de\u05d9\u05df" \u2014 a message that erases itself after 2.5s. So a cold
// open with no signal locked the MANAGER out of data already on the device
// (employee mode has no such dependency and got in fine). It is cross-origin,
// so it needs crossorigin="anonymous" on the tag (index.html) to come back as
// a CORS response rather than an opaque one a worker may not cache.
const VENDOR = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0/dist/umd/supabase.js',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all([
      c.addAll(SHELL).catch(() => {}),
      // One at a time: one vendor URL that 404s must not take the shell with it.
      Promise.all(VENDOR.map((u) => c.add(new Request(u, { mode: 'cors' })).catch(() => {}))),
    ]))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // Tell every open tab to reload so they pick up the fresh index.html
      // immediately instead of running the previous (cached) JS until next nav.
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'sw-updated', cache: CACHE })))
  );
});

function isShell(req) {
  if (req.mode === 'navigate') return true;
  try {
    const u = new URL(req.url);
    return u.origin === self.location.origin && SHELL.indexOf(u.pathname) >= 0;
  } catch (err) {
    return false;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = req.url;
  // Bypass: Supabase REST/Storage, our /api/*, Claude direct calls, analytics
  if (
    url.includes('supabase.co') ||
    url.includes('/api/') ||
    url.includes('anthropic.com') ||
    url.includes('googleapis.com')
  ) {
    return;
  }

  // Keep the freshest copy around, but never let a cache error break the page.
  const isVendor = VENDOR.indexOf(url.split('?')[0]) >= 0;
  const store = (resp) => {
    if (resp && resp.ok && (resp.type === 'basic' || (isVendor && resp.type === 'cors'))) {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return resp;
  };

  // index.html is ~1.4MB (250KB over the wire). Network-first made every
  // single open wait for that download, even though the bytes only change on
  // a deploy. Serve the cached shell straight away and refresh it in the
  // background instead — a deploy still reaches the user, because /sw.js is
  // no-cache, the new worker re-fills SHELL on install, and the page shows
  // the "new version" pill the moment that worker activates.
  if (isShell(req)) {
    e.respondWith(
      caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => {
        if (hit) {
          e.waitUntil(fetch(req).then(store).catch(() => {}));
          return hit;
        }
        return fetch(req).then(store).catch(() => caches.match('/'));
      })
    );
    return;
  }

  // A vendor script must come from the cache the moment the network is gone,
  // and must never fall back to index.html: nosniff refuses to execute an
  // HTML document as a script, so the page would break in a way that reads as
  // "the app is broken" rather than "you are offline".
  if (isVendor) {
    e.respondWith(
      caches.match(req, { cacheName: CACHE }).then((hit) => {
        if (hit) { e.waitUntil(fetch(req).then(store).catch(() => {})); return hit; }
        return fetch(req).then(store);
      })
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then(store)
      // Only a navigation may fall back to the shell. A script or a stylesheet
      // served index.html is refused by nosniff and looks like a broken app.
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Promise.reject(new Error('offline')))))
  );
});
`;

  return new Response(SW, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
      'Service-Worker-Allowed': '/'
    }
  });
}
