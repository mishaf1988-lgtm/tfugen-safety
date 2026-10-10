// GET /app.js: the main script of index.html as its own file (functions/_appjs.js).
import { extractApp, buildOf } from './_appjs.js';

let memo = { build: null, js: null };

export async function onRequest({ request, env }) {
  const build = buildOf(env);
  if (memo.build !== build || memo.js === null) {
    let js = null;
    try {
      const r = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString()));
      if (r.ok) js = extractApp(await r.text());
    } catch (e) { js = null; }
    if (js === null) return new Response('/* app.js unavailable */', { status: 503, headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
    memo = { build, js };
  }
  const v = new URL(request.url).searchParams.get('v');
  return new Response(memo.js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // ?v= is the deploy: the bytes under it never change, so the browser may keep them.
      'Cache-Control': v === build ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
