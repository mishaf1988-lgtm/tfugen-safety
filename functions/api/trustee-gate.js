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
// The guessing lock (10/10/2026, the security review: a wrong guess only waited, and a script in
// parallel could try every six-digit code in hours). Every attempt counts before the code is checked,
// in one atomic upsert (guess_hit, migration 2026-10-10_guess_lock.sql); over GUESS_LIMIT in an hour
// from the same address = refused without a check; the right code clears the count. The first lock
// of an address lands in server_state 'guess_locks', which the weekly mail reports. If the count
// cannot be read the check goes on (the lock must not shut HR out when the database blinks).
// The same block sits in talk.js and trustee-gate.js; a shared module would need a build entry in
// every test that loads either file.
export const GUESS_LIMIT = 10;
const GUESS_SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
const guessH = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' });
export async function guessKey(scope, request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'none';
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guess|' + ip)));
  return 'guess:' + scope + ':' + Array.from(d.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function guessHit(env, key) {
  try {
    const r = await fetch(GUESS_SB + '/rest/v1/rpc/guess_hit', { method: 'POST', headers: guessH(env), body: JSON.stringify({ p_key: key }) });
    if (!r.ok) return 0;
    const n = await r.json();
    return typeof n === 'number' ? n : 0;
  } catch (e) { return 0; }
}
async function guessClear(env, key) {
  try { await fetch(GUESS_SB + '/rest/v1/rpc/guess_clear', { method: 'POST', headers: guessH(env), body: JSON.stringify({ p_key: key }) }); } catch (e) { /* the code was right */ }
}
async function guessLocked(env, scope) {
  try {
    const r = await fetch(GUESS_SB + '/rest/v1/server_state?key=eq.guess_locks&select=value', { headers: guessH(env) });
    const rows = r.ok ? await r.json() : [];
    let list = []; try { list = JSON.parse((rows[0] && rows[0].value) || '[]'); } catch (e) { list = []; }
    list = (Array.isArray(list) ? list : []).concat([{ at: new Date().toISOString(), s: scope }]).slice(-50);
    await fetch(GUESS_SB + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: Object.assign(guessH(env), { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ key: 'guess_locks', value: JSON.stringify(list), updated_at: new Date().toISOString() }) });
  } catch (e) { /* the lock holds anyway */ }
}
// n attempts so far in the window, including this one; true = refuse without checking.
export async function guessGate(env, scope, request) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { key: null, locked: false };
  const key = await guessKey(scope, request);
  const n = await guessHit(env, key);
  if (n === GUESS_LIMIT + 1) await guessLocked(env, scope);
  return { key, locked: n > GUESS_LIMIT };
}
export async function guessOk(env, g) { if (g && g.key) await guessClear(env, g.key); }
const SB = 'https://znhjtpcltrxxyfjczgvw.supabase.co';
async function appCode(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return '';
  try {
    const r = await fetch(SB + '/rest/v1/server_state?key=eq.trustee_code&select=value', { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } });
    if (!r.ok) return '';
    const rows = await r.json();
    return String((Array.isArray(rows) && rows[0] && rows[0].value) || '').trim();
  } catch (e) { return ''; }
}

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

  // Since 10/10/2026 the code can be changed from the app (codes.js): server_state
  // 'trustee_code' first, TRUSTEE_CODE in Cloudflare while that row is empty.
  const expected = (await appCode(env)) || String(env.TRUSTEE_CODE || '').trim();
  if (!expected) {
    // Closed. Says so in words the trustee in front of it can act on.
    return jsonResp({
      error: 'not configured',
      message: 'קוד הכניסה לנאמנים עדיין לא הוגדר. פנה לממונה הבטיחות.'
    }, 503, cors);
  }

  let code = '';
  try { const b = await request.json(); code = String((b && b.code) || '').trim(); } catch (e) { code = ''; }

  const gg = await guessGate(env, 'tru', request);
  if (gg.locked) return jsonResp({ error: 'locked', message: '\u05d9\u05d5\u05ea\u05e8 \u05de\u05d3\u05d9 \u05e0\u05d9\u05e1\u05d9\u05d5\u05e0\u05d5\u05ea. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05e9\u05e2\u05d4.' }, 429, cors);
  if (!code || !same(code, expected)) {
    await new Promise((r) => setTimeout(r, WRONG_GUESS_DELAY_MS));
    return jsonResp({
      error: 'wrong code',
      message: 'קוד שגוי'
    }, 403, cors);
  }
  // Michael, 2026-09-21: «אני רוצה הזנה של קוד כל פעם מחדש», so the default was
  // to ask every time and the phone was never allowed to keep the code.
  // 2026-09-22 he asked for the choice to sit with the trustee instead: a
  // tick box on the gate, unticked by default, so a trustee who wants to stop
  // typing can, and one who does nothing keeps being asked.
  //
  // The plant still gets the final word, because a shared code that every
  // phone keeps is a curtain that never closes: TRUSTEE_REMEMBER=0 forbids
  // remembering outright and the tick box is not offered. Anything else
  // (unset, or 1) lets the trustee decide. `allow` is a permission, not an
  // instruction — the phone stores nothing unless the person ticked the box.
  await guessOk(env, gg);
  const allow = String(env.TRUSTEE_REMEMBER || '') !== '0';
  return jsonResp({ ok: true, remember: allow, allowRemember: allow }, 200, cors);
}
