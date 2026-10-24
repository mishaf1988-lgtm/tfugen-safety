// /chat-sw.js (24/10/2026): the service worker of the chat icon, only for pop-ups (functions/_push.js sends them).
// Its scope is /chat, so the app's own /sw.js keeps everything else. No cache here: the chat page is always fresh.
// iPhone takes a pop-up only from an icon on the home screen (iOS 16.4 and later), and every push must show one.
export const CHAT_SW = `self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Chat', { body: d.body || '', tag: d.tag || 'chat', renotify: true,
    icon: '/chat-icon-192.png', badge: '/chat-icon-192.png', data: { url: d.url || '/chat' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/chat';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf('/chat') >= 0 && 'focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
`;
export async function onRequest() {
  return new Response(CHAT_SW, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
}
