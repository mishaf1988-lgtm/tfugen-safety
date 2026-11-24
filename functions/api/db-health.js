// Cloudflare Pages Function: can the server reach the database? (24/11/2026, Michael in the questionnaire: "do it: build
// a mail alert", after the morning the server's SUPABASE_SERVICE_ROLE_KEY was replaced by a wrong value and every
// server call got Supabase's 401 "Invalid API key": the WhatsApp assistant stopped and nobody was told. The watchdog
// inside the site keeps its state and its mail connection in the database, so it cannot report this one.)
//
//   GET /api/db-health   ->  200 "db ok"  |  503 "db fail"
//
// Called every 15 minutes from outside by .github/workflows/site-up.yml (a machine path in _middleware.js, so the
// country gate lets GitHub through). No input, no secret in, nothing out but one word: no table name, no status code,
// no Supabase message. One small read with the service key (the same key every server function uses), and the answer
// is kept for CACHE_MS, so calling it often costs the database at most one read a minute per worker.

import { sbFrom } from '../_shared.js';

export const CACHE_MS = 60 * 1000;
export const TIMEOUT_MS = 8000;
let last = { at: 0, ok: false };
let pending = null;   // one probe in flight, shared by the calls that arrive while it runs (security review 24/11/2026)

export async function probe(env, fetchFn = fetch) {
  const key = (env && env.SUPABASE_SERVICE_ROLE_KEY) || '';
  if (!key) return false;
  // a new-style secret key (sb_secret_...) is not a JWT: only apikey (as routine-db.js, 18/11/2026)
  const headers = /^sb_secret_/.test(key) ? { apikey: key } : { apikey: key, Authorization: 'Bearer ' + key };
  try {
    const r = await fetchFn(sbFrom(env) + '/rest/v1/tasks?select=id&limit=1', { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return r.ok;
  } catch (e) {
    return false;
  }
}

export function resetCache() { last = { at: 0, ok: false }; pending = null; }

export async function onRequest({ request, env }, fetchFn = fetch, now = Date.now()) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method', { status: 405 });
  if (!last.at || now - last.at >= CACHE_MS) {
    if (!pending) pending = probe(env, fetchFn).then((ok) => { last = { at: now, ok }; pending = null; return ok; });
    await pending;
  }
  return new Response(last.ok ? 'db ok' : 'db fail', {
    status: last.ok ? 200 : 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
