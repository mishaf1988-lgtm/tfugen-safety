// A local copy of the site for the desktop install check (README.md): / with the app's manifest, /chat with its own.
import http from 'node:http'; import fs from 'node:fs';
import { chatPage } from '../../tests/harness/_build/chat-page.mjs';
import { chatManifest } from '../../tests/harness/_build/chat.mjs';
const R = new URL('../../', import.meta.url).pathname;
const root = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>Tapugan</title><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon-192.png"></head><body><h1>Tapugan (test root)</h1></body></html>';
http.createServer((q, s) => {
  const u = new URL(q.url, 'http://localhost'); const p = u.pathname;
  const send = (t, b) => { s.writeHead(200, { 'Content-Type': t, 'Cache-Control': 'no-cache' }); s.end(b); };
  if (p === '/') return send('text/html; charset=utf-8', root);
  if (p === '/manifest.webmanifest') return send('application/manifest+json', fs.readFileSync(R + 'manifest.webmanifest'));
  if (p === '/chat') return send('text/html; charset=utf-8', chatPage());
  if (p === '/api/chat' && u.searchParams.get('m') === '1') return send('application/manifest+json', JSON.stringify(chatManifest()));
  if (/^\/[a-z0-9-]+\.png$/.test(p) && fs.existsSync(R + p.slice(1))) return send('image/png', fs.readFileSync(R + p.slice(1)));
  s.writeHead(404); s.end('');
}).listen(8787, () => console.log('up'));
