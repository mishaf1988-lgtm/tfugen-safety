// GET /app.js: the main script of index.html as its own file (functions/_appjs.js).
import { extractApp, buildOf, PARTS } from './_appjs.js';

// One cut per part (main, t1, t2), kept per deploy.
let memo = { build: null, js: {} };

export async function onRequest({ request, env }) {
  const build = buildOf(env);
  const q = new URL(request.url).searchParams;
  const part = q.get('p') || 'main';
  const unavailable = () => new Response('/* app.js unavailable */', { status: 503, headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!Object.prototype.hasOwnProperty.call(PARTS, part)) return unavailable();
  if (memo.build !== build) memo = { build, js: {} };
  if (typeof memo.js[part] !== 'string') {
    let js = null;
    try {
      const r = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString()));
      if (r.ok) js = extractApp(await r.text(), PARTS[part]);
    } catch (e) { js = null; }
    if (js === null) return unavailable();
    memo.js[part] = js;
  }
  const v = q.get('v');
  return new Response(memo.js[part], {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // ?v= is the deploy: the bytes under it never change, so the browser may keep them.
      'Cache-Control': v === build ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
