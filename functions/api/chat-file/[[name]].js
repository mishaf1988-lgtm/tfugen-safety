// /api/chat-file/<the file's own name>?f=&e=&s= (25/10/2026, Michael: "the name of the file I try to share is
// another name, not the original"). The phone names a shared file after the last part of the link, so the
// link carries the real name; the file itself is served exactly as /api/chat?f= serves it (signed, safety folder).
import { serveFile } from '../chat.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
  return serveFile(env, new URL(request.url));
}
