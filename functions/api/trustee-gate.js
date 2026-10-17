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

import { defaultAllowedOrigins, corsHeaders, jsonResp, isAllowedCaller, ipBucket, sbFrom } from '../_shared.js';
import { accessToken, sendMailTo } from '../_onedrive.js';
import { SITE, SB_LIVE } from '../_shared.js';

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
let GUESS_SB = SB_LIVE; // set from env in onRequest (sbFrom)
// 15/10/2026 (owner: "no hang"): every Supabase call here gives up after 10s.
const SB_MS = 10000;
const guessH = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' });
export async function guessKey(scope, request) {
  const ip = ipBucket(request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip'));
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('guess|' + ip)));
  return 'guess:' + scope + ':' + Array.from(d.slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function guessHit(env, key) {
  try {
    const r = await fetch(GUESS_SB + '/rest/v1/rpc/guess_hit', { method: 'POST', headers: guessH(env), body: JSON.stringify({ p_key: key }), signal: AbortSignal.timeout(SB_MS) });
    if (!r.ok) return 0;
    const n = await r.json();
    return typeof n === 'number' ? n : 0;
  } catch (e) { return 0; }
}
async function guessClear(env, key) {
  try { await fetch(GUESS_SB + '/rest/v1/rpc/guess_clear', { method: 'POST', headers: guessH(env), body: JSON.stringify({ p_key: key }), signal: AbortSignal.timeout(SB_MS) }); } catch (e) { /* the code was right */ }
}
async function guessLocked(env, scope) {
  try {
    const r = await fetch(GUESS_SB + '/rest/v1/server_state?key=eq.guess_locks&select=value', { headers: guessH(env), signal: AbortSignal.timeout(SB_MS) });
    const rows = r.ok ? await r.json() : [];
    let list = []; try { list = JSON.parse((rows[0] && rows[0].value) || '[]'); } catch (e) { list = []; }
    list = (Array.isArray(list) ? list : []).concat([{ at: new Date().toISOString(), s: scope }]).slice(-50);
    await fetch(GUESS_SB + '/rest/v1/server_state?on_conflict=key', { method: 'POST', headers: Object.assign(guessH(env), { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ key: 'guess_locks', value: JSON.stringify(list), updated_at: new Date().toISOString() }), signal: AbortSignal.timeout(SB_MS) });
  } catch (e) { /* the lock holds anyway */ }
}
// A mail to Michael the moment an address is locked (11/10/2026, Michael: "\u05d1\u05e6\u05e2: \u05de\u05d9\u05d9\u05dc \u05dc\u05da \u05d5\u05db\u05e4\u05ea\u05d5\u05e8
// \u05e4\u05ea\u05d9\u05d7\u05d4"): the lock is per address, and HR and the trustees on the factory WiFi share one, so a lock
// may shut out his own people. Which password, when; the unlock is in "\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05d5\u05e1\u05d9\u05e1\u05de\u05d0\u05d5\u05ea". Never the address.
const LOCK_LABEL = { ind: '\u05e1\u05d9\u05e1\u05de\u05ea \u05de\u05e9\u05d0\u05d1\u05d9 \u05d0\u05e0\u05d5\u05e9 (\u05d8\u05d5\u05e4\u05e1 \u05e7\u05dc\u05d9\u05d8\u05d4)', tru: '\u05e1\u05d9\u05e1\u05de\u05ea \u05e0\u05d0\u05de\u05e0\u05d9 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea' };
export function lockMailHtml(scope, atIso) {
  const d = new Date(atIso);
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' }), hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  return '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">'
    + '<p><b>' + (LOCK_LABEL[scope] || scope) + '</b>: 10 \u05e0\u05d9\u05e1\u05d9\u05d5\u05e0\u05d5\u05ea \u05e9\u05d2\u05d5\u05d9\u05d9\u05dd \u05d1\u05e9\u05e2\u05d4 \u05de\u05d0\u05d5\u05ea\u05d4 \u05db\u05ea\u05d5\u05d1\u05ea, \u05d1-' + day + ' \u05d1\u05e9\u05e2\u05d4 ' + hm + '. \u05d4\u05db\u05ea\u05d5\u05d1\u05ea \u05e0\u05e2\u05d5\u05dc\u05d4 \u05dc\u05e9\u05e2\u05d4.</p>'
    + '<p>\u05d0\u05dd \u05d0\u05dc\u05d4 \u05d0\u05e0\u05e9\u05d9\u05dd \u05e9\u05dc\u05db\u05dd (\u05dc\u05de\u05e9\u05dc \u05de\u05d4-WiFi \u05e9\u05dc \u05d4\u05de\u05e4\u05e2\u05dc): \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e4\u05ea\u05d5\u05d7 \u05de\u05d9\u05d3 \u05d1\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d4, "\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd \u05d5\u05e1\u05d9\u05e1\u05de\u05d0\u05d5\u05ea", \u05db\u05e4\u05ea\u05d5\u05e8 "\u05e4\u05ea\u05d7 \u05e2\u05db\u05e9\u05d9\u05d5".</p>'
    + '<p>\u05d0\u05dd \u05d6\u05d4 \u05dc\u05d0 \u05de\u05d5\u05db\u05e8 \u05dc\u05db\u05dd: \u05db\u05d3\u05d0\u05d9 \u05dc\u05d4\u05d7\u05dc\u05d9\u05e3 \u05d0\u05ea \u05d4\u05e1\u05d9\u05e1\u05de\u05d4 \u05d1\u05d0\u05d5\u05ea\u05d5 \u05de\u05e7\u05d5\u05dd.</p>'
    + '<p style="color:#666;font-size:12px">\u05e0\u05e9\u05dc\u05d7 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\u05ea \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05e0\u05d9\u05d4\u05d5\u05dc \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea \u05e9\u05dc ' + SITE.company + '.</p></div>';
}
async function lockMail(env, scope) {
  try {
    const od = await accessToken(env);
    if (!od || !od.email) return;
    await sendMailTo(od.token, [od.email], [], '\u05e0\u05e2\u05d9\u05dc\u05d4 \u05e2\u05dc \u05e0\u05d9\u05d7\u05d5\u05e9 \u05e1\u05d9\u05e1\u05de\u05d4: ' + (LOCK_LABEL[scope] || scope), lockMailHtml(scope, new Date().toISOString()), []);
  } catch (e) { /* the lock holds anyway */ }
}
// n attempts so far in the window, including this one; true = refuse without checking.
// waitUntil (optional, 15/10/2026): the lock record and the mail go on after the answer, so the
// eleventh guess is not held up by Microsoft.
export async function guessGate(env, scope, request, waitUntil) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { key: null, locked: false };
  const key = await guessKey(scope, request);
  const n = await guessHit(env, key);
  if (n === GUESS_LIMIT + 1) {
    const job = guessLocked(env, scope).then(() => lockMail(env, scope));
    if (typeof waitUntil === 'function') waitUntil(job); else await job;
  }
  return { key, locked: n > GUESS_LIMIT };
}
export async function guessOk(env, g) { if (g && g.key) await guessClear(env, g.key); }
let SB = SB_LIVE; // set from env in onRequest (sbFrom)
// The code set in the app: { ok: true, code } ('' = no row or an empty one), or
// { ok: false } when the read itself failed (15/10/2026). Only an EMPTY row falls
// back to TRUSTEE_CODE: a failed read used to look empty, so during a database
// blink the current code was refused and an old, rotated-out one let in.
export async function appCode(env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true, code: '' };
  try {
    const r = await fetch(SB + '/rest/v1/server_state?key=eq.trustee_code&select=value', { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }, signal: AbortSignal.timeout(SB_MS) });
    if (!r.ok) return { ok: false };
    const rows = await r.json();
    if (!Array.isArray(rows)) return { ok: false };
    return { ok: true, code: String((rows[0] && rows[0].value) || '').trim() };
  } catch (e) { return { ok: false }; }
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

export async function onRequest(context) {
  GUESS_SB = sbFrom(context.env); SB = sbFrom(context.env);
  const { request, env } = context;
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin, allowed, 'POST,OPTIONS');

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  if (!isAllowedCaller(request, allowed)) return jsonResp({ error: 'origin not allowed' }, 403, cors);

  // Since 10/10/2026 the code can be changed from the app (codes.js): server_state
  // 'trustee_code' first, TRUSTEE_CODE in Cloudflare while that row is empty.
  const app = await appCode(env);
  if (!app.ok) {
    return jsonResp({ error: 'try again', message: '\u05d1\u05e2\u05d9\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea \u05d1\u05d1\u05d3\u05d9\u05e7\u05ea \u05d4\u05e7\u05d5\u05d3. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05d3\u05e7\u05d4.' }, 503, cors);
  }
  const expected = (app.code || String(env.TRUSTEE_CODE || '').trim()).toLowerCase();
  if (!expected) {
    // Closed. Says so in words the trustee in front of it can act on.
    return jsonResp({
      error: 'not configured',
      message: '\u05e7\u05d5\u05d3 \u05d4\u05db\u05e0\u05d9\u05e1\u05d4 \u05dc\u05e0\u05d0\u05de\u05e0\u05d9\u05dd \u05e2\u05d3\u05d9\u05d9\u05df \u05dc\u05d0 \u05d4\u05d5\u05d2\u05d3\u05e8. \u05e4\u05e0\u05d4 \u05dc\u05de\u05de\u05d5\u05e0\u05d4 \u05d4\u05d1\u05d8\u05d9\u05d7\u05d5\u05ea.'
    }, 503, cors);
  }

  let code = '';
  try { const b = await request.json(); code = String((b && b.code) || '').trim().toLowerCase(); } catch (e) { code = ''; }

  const gg = await guessGate(env, 'tru', request, typeof context.waitUntil === 'function' ? context.waitUntil.bind(context) : null);
  if (gg.locked) return jsonResp({ error: 'locked', message: '\u05d9\u05d5\u05ea\u05e8 \u05de\u05d3\u05d9 \u05e0\u05d9\u05e1\u05d9\u05d5\u05e0\u05d5\u05ea. \u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1 \u05d1\u05e2\u05d5\u05d3 \u05e9\u05e2\u05d4.' }, 429, cors);
  if (!code || !same(code, expected)) {
    await new Promise((r) => setTimeout(r, WRONG_GUESS_DELAY_MS));
    return jsonResp({
      error: 'wrong code',
      message: '\u05e7\u05d5\u05d3 \u05e9\u05d2\u05d5\u05d9'
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
