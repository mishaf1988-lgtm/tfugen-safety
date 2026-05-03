// TFUGEN Service Worker — minimal shell cache.
// Strategy: network-first for our static assets (so deploys are instant),
// fall back to cache when offline. API/REST calls bypass entirely.

const CACHE = 'tfgn-v35';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/logo.jpg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
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

  e.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/')))
  );
});
