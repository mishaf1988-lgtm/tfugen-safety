// Cloudflare Pages Function — the shared code on the trustee screen.
//
// Michael, 2026-09-21, choosing between a real account per trustee and one
// code for everybody: «קוד אחד לכולם בלבד». Told plainly that a shared code
// is a curtain and not a lock -- the trustee's session behind it is still
// anonymous, and anyone who knows how can open one without ever seeing this
// screen -- he chose it anyway. So it is built to be as much of a curtain as
// a curtain can be:
//
//   * The code lives here, in TRUSTEE_CODE on Cloudflare Pages. Never in
//     index.html, where "view source" would print it.
//   * A wrong guess waits before it is refused. Not a rate limit -- a Worker
//     keeps no state between requests without KV -- but a six-digit code at
//     one guess per second per connection is not one guess per millisecond.
//   * Only from Israel, because /_middleware.js sits in front of this path.
//   * Changing TRUSTEE_CODE signs every phone out: the app re-checks the code
//     it remembered each time the trustee screen opens.
//
// Unset TRUSTEE_CODE means closed, not open. Nobody is using the trustee
// screen yet, and a lock that defaults to open is not a lock.

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller } from '../_shared.js';

const WRONG_GUESS_DELAY_MS = 800;

// Same time whatever the mismatch, so the length of the real code is not
// something a stopwatch can learn.
function same(a, b) {
  const x = String(a || ''), y = String(b || '');
  const n = Math.max(x.length, y.length);
  let diff = x.length === y.length ? 0 : 1;
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

export async function onRequest({ request, env }) {
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  const expected = String(env.TRUSTEE_CODE || '').trim();
  if (!expected) {
    // Closed. Says so in words the trustee in front of it can act on.
    return jsonResp({
      error: 'not configured',
      message: 'קוד הכניסה לנאמנים עדיין לא הוגדר. פנה לממונה הבטיחות.'
    }, 503, cors);
  }

  let code = '';
  try { const b = await request.json(); code = String((b && b.code) || '').trim(); } catch (e) { code = ''; }

  if (!code || !same(code, expected)) {
    await new Promise((r) => setTimeout(r, WRONG_GUESS_DELAY_MS));
    return jsonResp({
      error: 'wrong code',
      message: 'קוד שגוי'
    }, 403, cors);
  }
  return jsonResp({ ok: true }, 200, cors);
}
