// Cloudflare Pages Function: connect OneDrive to the server, once.
//
//   POST /api/ms-auth {op:'start'}   admin/manager session -> {url}
//        The app sends the browser to that Microsoft sign-in page.
//   GET  /api/ms-auth?code&state     Microsoft sends the browser back here.
//        We exchange the code, store the refresh token (public.oauth_tokens,
//        service-role only) and send the browser to the app with ?ms=ok.
//   POST /api/ms-auth {op:'status'}  admin/manager -> {configured, connected, email, since}
//
// The state parameter is an HMAC (key = the client secret) over a timestamp,
// a nonce and the manager who started it. A callback without a state we signed
// in the last 15 minutes is refused, so nobody can attach their own Microsoft
// account to the factory's server by sending a manager a link.

import { defaultAllowedOrigins, corsHeaders, jsonResp, requireRole, CF_PROD } from '../_shared.js';
import { odConfigured, authorizeUrl, SCOPES, exchangeCode, saveTokens, tokenRow, hasMail, stateGet, stateSet } from '../_onedrive.js';

const REDIRECT = CF_PROD + '/api/ms-auth';
const STATE_TTL_MS = 15 * 60 * 1000;

function b64url(bytes) {
  let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlText(t) { return b64url(new TextEncoder().encode(t)); }
function unb64urlText(s) {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))));
}
function sameStr(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const NONCE_KEY = 'ms_auth_nonce';
export async function makeState(env, who, now) {
  const n = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const p = b64urlText(JSON.stringify({ t: now || Date.now(), n, u: String(who || '') }));
  return p + '.' + (await hmac(env.ONEDRIVE_CLIENT_SECRET, p));
}
export async function checkState(env, state, now) {
  const parts = String(state || '').split('.');
  if (parts.length !== 2) return false;
  const want = await hmac(env.ONEDRIVE_CLIENT_SECRET, parts[0]);
  if (!sameStr(want, parts[1])) return false;
  let p; try { p = JSON.parse(unb64urlText(parts[0])); } catch (e) { return false; }
  const age = (now || Date.now()) - Number(p.t);
  return age >= 0 && age <= STATE_TTL_MS ? p : false;
}

function back(status, why) {
  const q = status === 'ok' ? '?ms=ok' : '?ms=err&why=' + encodeURIComponent(String(why || '').substring(0, 120));
  return new Response(null, { status: 302, headers: { Location: CF_PROD + '/' + q, 'Cache-Control': 'no-store' } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const allowed = defaultAllowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin, allowed, 'GET,POST,OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (!odConfigured(env)) return back('err', 'server not configured');
    const err = url.searchParams.get('error');
    if (err) return back('err', url.searchParams.get('error_description') || err);
    const code = url.searchParams.get('code'), state = url.searchParams.get('state');
    const sp = code ? await checkState(env, state) : false;
    if (!sp) return back('err', 'invalid or expired sign-in, start again');
    // Security scan 10/10/2026: the state is single-use. Only the nonce of the last "start" an
    // admin asked for is accepted, and it is cleared on first use, so a sign-in link that leaked
    // (or a second tab) cannot replace the connected account.
    const ns = await stateGet(env, [NONCE_KEY]).catch(() => ({}));
    const want = ns[NONCE_KEY] && ns[NONCE_KEY].value;
    if (!want || !sameStr(want, String(sp.n || ''))) return back('err', 'this sign-in link was already used or replaced, start again');
    await stateSet(env, { [NONCE_KEY]: null }).catch(() => {});
    try {
      const t = await exchangeCode(env, code, REDIRECT);
      if (!t.refresh_token) return back('err', 'no refresh token (offline_access missing)');
      const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', { headers: { Authorization: 'Bearer ' + t.access_token } });
      const mj = await me.json().catch(() => ({}));
      const email = (mj && (mj.mail || mj.userPrincipalName)) || 'unknown';
      await saveTokens(env, email, t);
      return back('ok');
    } catch (e) {
      return back('err', (e && e.message) || 'sign-in failed');
    }
  }

  if (request.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405, cors);
  let body = {}; try { body = await request.json(); } catch (e) {}
  const op = String(body.op || '');
  // Security scan 10/10/2026 (Michael: "בצע: אדמין בלבד"): replacing the mailbox the alerts go
  // out from, and the drive every file is written to, is for the admin. Managers still read status.
  const who = await requireRole(request, env, op === 'start' ? ['admin'] : ['admin', 'manager']);
  if (!who.ok) return jsonResp({ error: who.error }, who.status, cors);

  if (op === 'status') {
    if (!odConfigured(env)) return jsonResp({ configured: false, connected: false }, 200, cors);
    try {
      const row = await tokenRow(env);
      return jsonResp({ configured: true, connected: !!(row && row.refresh_token), email: row ? row.user_email : null, since: row ? row.updated_at : null, mail: hasMail(row) }, 200, cors);
    } catch (e) {
      return jsonResp({ configured: true, connected: false, error: String(e.message || e) }, 200, cors);
    }
  }
  if (op === 'start') {
    if (!odConfigured(env)) return jsonResp({ error: 'server not configured: set ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET in Cloudflare' }, 503, cors);
    const state = await makeState(env, who.user && who.user.email);
    await stateSet(env, { [NONCE_KEY]: JSON.parse(unb64urlText(state.split('.')[0])).n });
    const q = new URLSearchParams({
      client_id: env.ONEDRIVE_CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT,
      response_mode: 'query', scope: SCOPES, state, prompt: 'select_account',
    });
    return jsonResp({ url: authorizeUrl(env) + '?' + q.toString() }, 200, cors);
  }
  return jsonResp({ error: 'unknown op' }, 400, cors);
}
